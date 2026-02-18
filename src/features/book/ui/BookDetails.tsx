import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/model/useAuth";
import type { Book as CardBook } from "../../../entities/book/ui/BookCard";
import { getBookById, getBooks } from "../../../entities/book/api/bookApi";
import type { Book as ApiBook, BookStatus } from "../../../entities/book/model/types";
import {
  createReview,
  deleteReviewById,
  getBookReviews,
} from "../../../entities/review/api/reviewApi";
import type { Review } from "../../../entities/review/model/types";
import {
  cancelReservation,
  getUserActiveReservations,
  reserveBook,
  returnReservation,
  takeReservation,
} from "../../../entities/booking/api/bookingApi";
import type { Reservation } from "../../../entities/booking/model/types";
import {
  optimisticIncrementUnread,
  rollbackOptimisticUnread,
  syncUnreadNotifications,
} from "../../../entities/notification/model/optimisticUnread";
import { useBookingStore } from "../model/bookingStore";
import { resolveCoverUrl } from "../../../shared/lib/media/cover";
import { BookSimilar } from "./BookSimilar";
import styles from "./BookDetails.module.scss";

const REVIEWS_PAGE_SIZE = 5;

const normalizeEmail = (email?: string) => email?.trim().toLocaleLowerCase() ?? "";

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const mapBookToCard = (book: ApiBook): CardBook => ({
  id: book.id,
  title: book.title,
  author: book.author,
  coverUrl: book.coverUrl,
  averageRating: book.averageRating,
  reviewCount: book.reviewCount,
  category: book.category,
  status: book.status,
});

const getErrorStatus = (error: unknown) =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

const getBookStatusClassName = (status?: BookStatus) => {
  switch (status) {
    case "AVAILABLE":
      return styles.statusAvailable;
    case "RESERVED":
      return styles.statusReserved;
    case "TAKEN":
      return styles.statusTaken;
    case "RETURNED":
      return styles.statusReturned;
    default:
      return styles.statusAvailable;
  }
};

const getBookStatusTranslationKey = (status?: BookStatus) => {
  switch (status) {
    case "AVAILABLE":
      return "book.status.available";
    case "RESERVED":
      return "book.status.reserved";
    case "TAKEN":
    case "IN_YOUR_HANDS":
      return "book.status.taken";
    case "RETURNED":
      return "book.status.returned";
    default:
      return "book.status.available";
  }
};

const RatingStars = ({ rating }: { rating: number }) => (
  <div className={styles.stars} aria-hidden="true">
    {Array.from({ length: 5 }).map((_, index) => (
      <span
        key={index}
        className={index < Math.round(rating) ? styles.starFilled : styles.starEmpty}
      >
        ★
      </span>
    ))}
  </div>
);

export const BookDetails = () => {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { id } = useParams();
  const location = useLocation();
  const queryClient = useQueryClient();

  const bookings = useBookingStore((state) => state.bookings);
  const addWish = useBookingStore((state) => state.addWish);
  const removeWish = useBookingStore((state) => state.removeWish);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewValidationError, setReviewValidationError] = useState<string | null>(
    null,
  );
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [visibleReviewsCountByBook, setVisibleReviewsCountByBook] = useState<
    Record<number, number>
  >({});
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<number | null>(null);

  const stateBook = (
    location.state as { book?: CardBook & { location?: string } } | null
  )?.book;
  const routeBookId = id ? Number.parseInt(id, 10) : undefined;
  const bookId =
    routeBookId !== undefined && Number.isFinite(routeBookId)
      ? routeBookId
      : stateBook?.id;
  const hasBookId = typeof bookId === "number" && Number.isFinite(bookId);

  const { data: bookData, isLoading: isBookLoading } = useQuery({
    queryKey: ["book", bookId],
    queryFn: () => getBookById(String(bookId)),
    enabled: hasBookId,
    retry: (failureCount, error) => {
      const status = getErrorStatus(error);
      if (status === 400 || status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const { data: booksData = [] } = useQuery({
    queryKey: ["books"],
    queryFn: getBooks,
  });

  const { data: reviewsData = [], isLoading: isReviewsLoading } = useQuery({
    queryKey: ["book", bookId, "reviews"],
    queryFn: async () => {
      const { data } = await getBookReviews(bookId as number);
      return data;
    },
    enabled: hasBookId,
  });

  const { data: activeReservations = [] } = useQuery({
    queryKey: ["reservations", "active"],
    queryFn: async () => {
      const { data } = await getUserActiveReservations();
      return data;
    },
    enabled: hasBookId,
  });

  const book = useMemo(() => {
    if (bookData) {
      return bookData;
    }

    if (stateBook && hasBookId) {
      return {
        id: bookId,
        title: stateBook.title,
        author: stateBook.author,
        description: "",
        location: stateBook.location,
        coverUrl: stateBook.coverUrl,
        category: stateBook.category,
      } as ApiBook;
    }

    return null;
  }, [bookData, stateBook, bookId, hasBookId]);

  const reservation = useMemo<Reservation | undefined>(() => {
    if (!book) {
      return undefined;
    }

    return activeReservations.find((item) => item.bookId === book.id);
  }, [activeReservations, book]);

  const reviews = useMemo(() => {
    const sorted = [...reviewsData].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    const uniqueEmails = new Set<string>();
    return sorted.filter((review) => {
      const email = normalizeEmail(review.userEmail);
      if (!email) {
        return true;
      }

      if (uniqueEmails.has(email)) {
        return false;
      }

      uniqueEmails.add(email);
      return true;
    });
  }, [reviewsData]);

  const averageRating = useMemo(() => {
    if (typeof book?.averageRating === "number") {
      return book.averageRating;
    }

    if (!reviews.length) {
      return 0;
    }

    const sum = reviews.reduce((acc, item) => acc + item.rating, 0);
    return sum / reviews.length;
  }, [book, reviews]);

  const reviewCount =
    typeof book?.reviewCount === "number" ? book.reviewCount : reviews.length;

  const currentUserEmail = normalizeEmail(user?.email);

  const ownReview = useMemo(
    () => reviews.find((review) => normalizeEmail(review.userEmail) === currentUserEmail),
    [currentUserEmail, reviews],
  );

  const similarBooks = useMemo(() => {
    if (!book) {
      return [];
    }

    const sameCategory = book.category
      ? booksData.filter(
          (item) => item.id !== book.id && item.category === book.category,
        )
      : [];

    const source = sameCategory.length
      ? sameCategory
      : booksData.filter((item) => item.id !== book.id);

    return source.slice(0, 8).map(mapBookToCard);
  }, [book, booksData]);

  const resolveReservationErrorMessage = (error: unknown) => {
    const response = (error as { response?: { data?: unknown; status?: number } } | undefined)
      ?.response;
    const status = response?.status;
    const data = response?.data;
    const rawMessage =
      typeof data === "string"
        ? data
        : typeof data === "object" && data
          ? String(
              (data as { message?: string; error?: string }).message ??
                (data as { message?: string; error?: string }).error ??
                "",
            )
          : "";
    const normalized = rawMessage.toLocaleLowerCase("en-US");

    if (
      normalized.includes("maximum number of reserved books") ||
      normalized.includes("maximum number")
    ) {
      return t("reservation.errors.limitReached");
    }

    if (status === 409) {
      return t("reservation.errors.notAvailable");
    }

    if (status === 400 && rawMessage) {
      return rawMessage;
    }

    return t("reservation.errors.generic");
  };

  const invalidateReservations = () => {
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
    queryClient.invalidateQueries({ queryKey: ["books"] });
    if (book?.id) {
      queryClient.invalidateQueries({ queryKey: ["book", book.id] });
    }
  };

  const reserveMutation = useMutation({
    mutationFn: (targetBookId: number) => reserveBook(targetBookId),
    onMutate: async () => optimisticIncrementUnread(queryClient),
    onSuccess: () => {
      setReservationError(null);
      invalidateReservations();
    },
    onError: (error, _variables, context) => {
      rollbackOptimisticUnread(queryClient, context);
      setReservationError(resolveReservationErrorMessage(error));
    },
    onSettled: async () => {
      await syncUnreadNotifications(queryClient);
    },
  });

  const takeMutation = useMutation({
    mutationFn: (reservationId: number) => takeReservation(reservationId),
    onMutate: async () => optimisticIncrementUnread(queryClient),
    onSuccess: () => {
      setReservationError(null);
      invalidateReservations();
    },
    onError: (error, _variables, context) => {
      rollbackOptimisticUnread(queryClient, context);
      setReservationError(resolveReservationErrorMessage(error));
    },
    onSettled: async () => {
      await syncUnreadNotifications(queryClient);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (reservationId: number) => returnReservation(reservationId),
    onMutate: async () => optimisticIncrementUnread(queryClient),
    onSuccess: () => {
      setReservationError(null);
      invalidateReservations();
    },
    onError: (error, _variables, context) => {
      rollbackOptimisticUnread(queryClient, context);
      setReservationError(resolveReservationErrorMessage(error));
    },
    onSettled: async () => {
      await syncUnreadNotifications(queryClient);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: number) => cancelReservation(reservationId),
    onMutate: async () => optimisticIncrementUnread(queryClient),
    onSuccess: () => {
      setReservationError(null);
      invalidateReservations();
    },
    onError: (error, _variables, context) => {
      rollbackOptimisticUnread(queryClient, context);
      setReservationError(resolveReservationErrorMessage(error));
    },
    onSettled: async () => {
      await syncUnreadNotifications(queryClient);
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: (payload: { bookId: number; rating: number; comment: string }) =>
      createReview(payload.bookId, {
        rating: payload.rating,
        comment: payload.comment,
      }),
    onSuccess: (_, variables) => {
      setReviewValidationError(null);
      setReviewComment("");
      setReviewRating(5);
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["book", variables.bookId] });
      queryClient.invalidateQueries({
        queryKey: ["book", variables.bookId, "reviews"],
      });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (payload: { reviewId: number; bookId: number }) =>
      deleteReviewById(payload.reviewId),
    onMutate: ({ reviewId }) => {
      setDeletingReviewId(reviewId);
    },
    onSuccess: (_, variables) => {
      setReviewValidationError(null);
      setReviewComment("");
      setReviewRating(5);
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["book", variables.bookId] });
      queryClient.invalidateQueries({
        queryKey: ["book", variables.bookId, "reviews"],
      });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onSettled: () => {
      setDeletingReviewId(null);
    },
  });

  useEffect(() => {
    if (!isReviewModalOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsReviewModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isReviewModalOpen]);

  if (!book && isBookLoading) {
    return <section className={styles.details}>{t("common.loading")}</section>;
  }

  if (!book) {
    return <section className={styles.details}>{t("book.notFound")}</section>;
  }

  const status = book.status ?? "AVAILABLE";
  const inWishlist = bookings.some(
    (item) =>
      item.bookId === book.id &&
      item.active &&
      item.readingStatus === "WILL_READ" &&
      !item.bookedAt &&
      !item.borrowedAt,
  );

  const canReserve = status === "AVAILABLE" && !reservation;
  const canTake = Boolean(reservation && !reservation.takenAt);
  const canReturn = Boolean(
    reservation && reservation.takenAt && !reservation.returnedAt,
  );
  const canCancel = Boolean(reservation && !reservation.takenAt);

  const handleWishlistClick = () => {
    if (inWishlist) {
      removeWish(book.id);
      return;
    }

    addWish({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      location: book.location,
      category: book.category,
      averageRating: book.averageRating,
      reviewCount: book.reviewCount,
      status: book.status,
    });
  };

  const openReviewModal = () => {
    createReviewMutation.reset();
    deleteReviewMutation.reset();
    setReviewValidationError(null);
    if (ownReview) {
      setReviewRating(ownReview.rating);
      setReviewComment(ownReview.comment?.trim() ?? "");
    } else {
      setReviewRating(5);
      setReviewComment("");
    }
    setIsReviewModalOpen(true);
  };

  const handleReviewDelete = (reviewId: number) => {
    if (!book) {
      return;
    }

    if (!window.confirm(t("reviews.deleteConfirm"))) {
      return;
    }

    deleteReviewMutation.reset();
    createReviewMutation.reset();
    setReviewValidationError(null);
    deleteReviewMutation.mutate({ reviewId, bookId: book.id });
  };

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const comment = reviewComment.trim();
    if (!comment) {
      setReviewValidationError(t("reviews.commentRequired"));
      return;
    }

    setReviewValidationError(null);
    createReviewMutation.reset();
    createReviewMutation.mutate({
      bookId: book.id,
      rating: reviewRating,
      comment,
    });
  };

  const formatDate = (value?: string) => {
    if (!value) {
      return t("common.notAvailable");
    }

    return new Date(value).toLocaleString(i18n.language, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const coverSrc = resolveCoverUrl(book.coverUrl);
  const reviewStatus = getErrorStatus(createReviewMutation.error);
  const deleteReviewStatus = getErrorStatus(deleteReviewMutation.error);
  const visibleReviewsCount =
    hasBookId
      ? (visibleReviewsCountByBook[bookId as number] ?? REVIEWS_PAGE_SIZE)
      : REVIEWS_PAGE_SIZE;
  const visibleReviews = reviews.slice(0, visibleReviewsCount);
  const hasMoreReviews = reviews.length > visibleReviewsCount;

  return (
    <section className={styles.details}>
      <nav className={styles.breadcrumbs} aria-label={t("book.breadcrumbAria")}>
        <Link to="/catalog">{t("nav.catalog")}</Link>
        <span>›</span>
        <span>{book.category ?? t("book.noCategory")}</span>
        <span>›</span>
        <span>{book.title}</span>
      </nav>

      <div className={styles.hero}>
        <div className={styles.coverPanel}>
          {coverSrc ? (
            <img className={styles.cover} src={coverSrc} alt={book.title} />
          ) : (
            <div className={styles.cover} />
          )}
          <div className={styles.coverFooter}>
            <span
              className={`${styles.statusChip} ${getBookStatusClassName(status)}`}
            >
              {t(getBookStatusTranslationKey(status))}
            </span>
            <span className={styles.locationChip}>
              {t("book.location", { value: book.location ?? t("book.notSpecified") })}
            </span>
          </div>
        </div>

        <div className={styles.mainInfo}>
          <div className={styles.metaTop}>
            <span className={styles.categoryTag}>
              {book.category ?? t("book.noCategory")}
            </span>
            <span className={styles.metaMuted}>
              {t("book.bookId", { id: book.id })}
            </span>
          </div>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.author}>{book.author}</p>

          <div className={styles.ratingRow}>
            <RatingStars rating={averageRating} />
            <strong>{averageRating > 0 ? averageRating.toFixed(1) : "—"}</strong>
            <span>{t("book.reviewsCount", { count: reviewCount })}</span>
          </div>

          <p className={styles.description}>
            {book.description?.trim() || t("book.noDescription")}
          </p>

          <div className={styles.activityRow}>
            <span>{t("reservation.reservedAt", { value: formatDate(reservation?.reservedAt) })}</span>
            <span>{t("reservation.takenAt", { value: formatDate(reservation?.takenAt) })}</span>
            <span>{t("reservation.returnedAt", { value: formatDate(reservation?.returnedAt) })}</span>
          </div>
        </div>

        <aside className={styles.actionsPanel}>
          <button
            type="button"
            className={`${styles.wishlistButton} ${inWishlist ? styles.wishlistActive : ""}`}
            onClick={handleWishlistClick}
          >
            <HeartIcon />
            {inWishlist ? t("wishlist.remove") : t("book.actions.wishlist")}
          </button>

          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionPrimary}`}
            disabled={!canReserve || reserveMutation.isPending}
            onClick={() => reserveMutation.mutate(book.id)}
          >
            {t("book.actions.reserve")}
          </button>

          <button
            type="button"
            className={styles.actionButton}
            disabled={!canTake || takeMutation.isPending}
            onClick={() => reservation && takeMutation.mutate(reservation.id)}
          >
            {t("book.actions.take")}
          </button>

          <button
            type="button"
            className={styles.actionButton}
            disabled={!canReturn || returnMutation.isPending}
            onClick={() => reservation && returnMutation.mutate(reservation.id)}
          >
            {t("book.actions.return")}
          </button>

          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionGhost}`}
            disabled={!canCancel || cancelMutation.isPending}
            onClick={() => reservation && cancelMutation.mutate(reservation.id)}
          >
            {t("book.actions.cancelReservation")}
          </button>

          {reservationError ? <p className={styles.errorText}>{reservationError}</p> : null}

          <p className={styles.helpText}>{t("reservation.help")}</p>
        </aside>
      </div>

      <BookSimilar books={similarBooks} isAuthed={isAuthenticated} />

      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t("reviews.sectionTitle")}</h2>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionPrimary}`}
            onClick={openReviewModal}
          >
            {ownReview ? t("reviews.editAction") : t("reviews.writeAction")}
          </button>
        </div>
        {ownReview ? (
          <p className={styles.mutedText}>{t("reviews.singleReviewHint")}</p>
        ) : null}
      </section>

      <section className={styles.sectionCard}>
        <h2 className={styles.sectionTitle}>{t("reviews.listTitle")}</h2>
        {isReviewsLoading ? (
          <p className={styles.mutedText}>{t("reviews.loading")}</p>
        ) : reviews.length ? (
          <>
            <div className={styles.reviewsList}>
              {visibleReviews.map((review: Review, index) => {
                const isOwnReview =
                  normalizeEmail(review.userEmail) === currentUserEmail;

                return (
                  <article
                    key={`${review.id}-${review.createdAt}-${review.userEmail}-${index}`}
                    className={styles.reviewCard}
                  >
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewMeta}>
                        <p className={styles.reviewAuthor}>
                          {review.userEmail}
                          {isOwnReview ? (
                            <span className={styles.reviewOwnBadge}>{t("reviews.own")}</span>
                          ) : null}
                        </p>
                        <p className={styles.reviewDate}>{formatDate(review.createdAt)}</p>
                      </div>
                      <div className={styles.reviewRating}>
                        <RatingStars rating={review.rating} />
                        <span>{review.rating}/5</span>
                      </div>
                    </div>
                    <p className={styles.reviewComment}>
                      {review.comment?.trim() || t("reviews.noComment")}
                    </p>
                    {isOwnReview ? (
                      <div className={styles.reviewActions}>
                        <button
                          type="button"
                          className={styles.reviewActionButton}
                          onClick={openReviewModal}
                          disabled={deleteReviewMutation.isPending}
                        >
                          {t("reviews.editAction")}
                        </button>
                        <button
                          type="button"
                          className={`${styles.reviewActionButton} ${styles.reviewActionDelete}`}
                          onClick={() => handleReviewDelete(review.id)}
                          disabled={
                            deleteReviewMutation.isPending &&
                            deletingReviewId === review.id
                          }
                        >
                          {deleteReviewMutation.isPending &&
                          deletingReviewId === review.id
                            ? t("reviews.saving")
                            : t("reviews.deleteAction")}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
            {hasMoreReviews ? (
              <button
                type="button"
                className={styles.showMoreButton}
                onClick={() =>
                  setVisibleReviewsCountByBook((prev) => {
                    const key = book.id;
                    const current = prev[key] ?? REVIEWS_PAGE_SIZE;
                    return {
                      ...prev,
                      [key]: current + REVIEWS_PAGE_SIZE,
                    };
                  })
                }
              >
                {t("reviews.showMore")}
              </button>
            ) : null}
          </>
        ) : (
          <p className={styles.mutedText}>{t("reviews.empty")}</p>
        )}
        {deleteReviewStatus ? (
          <p className={styles.errorText}>{t("reviews.deleteError")}</p>
        ) : null}
      </section>

      {isReviewModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onMouseDown={() => setIsReviewModalOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label={ownReview ? t("reviews.editAction") : t("reviews.writeAction")}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {ownReview ? t("reviews.editAction") : t("reviews.writeAction")}
            </h3>

            <form className={styles.reviewForm} onSubmit={handleReviewSubmit}>
              <label className={styles.formField}>
                <span>{t("reviews.ratingField")}</span>
                <select
                  value={reviewRating}
                  onChange={(event) =>
                    setReviewRating(Number.parseInt(event.target.value, 10))
                  }
                >
                  <option value={5}>{t("reviews.rating5")}</option>
                  <option value={4}>{t("reviews.rating4")}</option>
                  <option value={3}>{t("reviews.rating3")}</option>
                  <option value={2}>{t("reviews.rating2")}</option>
                  <option value={1}>{t("reviews.rating1")}</option>
                </select>
              </label>

              <label className={styles.formField}>
                <span>{t("reviews.commentField")}</span>
                <textarea
                  value={reviewComment}
                  onChange={(event) => {
                    setReviewComment(event.target.value);
                    if (reviewValidationError) {
                      setReviewValidationError(null);
                    }
                  }}
                  placeholder={t("reviews.placeholder")}
                  rows={4}
                  maxLength={1200}
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionGhost}`}
                  onClick={() => setIsReviewModalOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className={`${styles.actionButton} ${styles.actionPrimary}`}
                  disabled={createReviewMutation.isPending || !reviewComment.trim()}
                >
                  {createReviewMutation.isPending
                    ? t("reviews.saving")
                    : ownReview
                      ? t("reviews.saveEdit")
                      : t("reviews.submit")}
                </button>
              </div>

              {reviewValidationError ? (
                <p className={styles.errorText}>{reviewValidationError}</p>
              ) : null}
              {reviewStatus === 409 ? (
                <p className={styles.errorText}>{t("reviews.duplicateError")}</p>
              ) : null}
              {reviewStatus && reviewStatus !== 409 ? (
                <p className={styles.errorText}>{t("reviews.submitError")}</p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};
