import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookCard, type Book } from "../../entities/book/ui/BookCard";
import { getBooks } from "../../entities/book/api/bookApi";
import type { BookStatus } from "../../entities/book/model/types";
import { getUserReservations } from "../../entities/booking/api/bookingApi";
import type { Reservation } from "../../entities/booking/model/types";
import { Pagination } from "../../shared/ui/Pagination/Pagination";
import styles from "./MyBooksPage.module.scss";

type MyBook = Omit<Book, "status"> & {
  reservation?: Reservation;
  status: "TAKEN" | "RESERVED" | "RETURNED" | "CANCELLED";
};

type MyBookFilter = "all" | "TAKEN" | "RESERVED" | "RETURNED" | "CANCELLED";

const PAGE_SIZE = 8;

const getReservationTimestamp = (reservation: Reservation) =>
  new Date(
    reservation.returnedAt ?? reservation.takenAt ?? reservation.reservedAt ?? 0,
  ).getTime();

const getMyBookStatus = (
  reservation: Reservation,
  bookStatus?: BookStatus,
): "TAKEN" | "RESERVED" | "RETURNED" | "CANCELLED" => {
  const isInHandsByBookStatus =
    bookStatus === "IN_YOUR_HANDS" || bookStatus === "TAKEN";

  if (reservation.returnedAt || reservation.status === "RETURNED") {
    return "RETURNED";
  }

  // Fallback for inconsistent backend state:
  // reservation can stay COMPLETED while the book is already back in library.
  if (reservation.status === "COMPLETED" && !isInHandsByBookStatus) {
    return "RETURNED";
  }

  if (reservation.takenAt || reservation.status === "COMPLETED") {
    return "TAKEN";
  }

  if (reservation.status === "CANCELLED" || reservation.status === "EXPIRED") {
    return "CANCELLED";
  }

  return "RESERVED";
};

const myBookStatusPriority: Record<MyBook["status"], number> = {
  RETURNED: 4,
  TAKEN: 3,
  RESERVED: 2,
  CANCELLED: 1,
};

const pickMoreRelevantReservation = (
  current: Reservation,
  next: Reservation,
) => {
  const currentTimestamp = getReservationTimestamp(current);
  const nextTimestamp = getReservationTimestamp(next);

  if (nextTimestamp > currentTimestamp) {
    return next;
  }

  if (nextTimestamp < currentTimestamp) {
    return current;
  }

  const currentPriority = myBookStatusPriority[getMyBookStatus(current)];
  const nextPriority = myBookStatusPriority[getMyBookStatus(next)];
  if (nextPriority > currentPriority) {
    return next;
  }

  if (nextPriority < currentPriority) {
    return current;
  }

  return next.id >= current.id ? next : current;
};

export const MyBooksPage = () => {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<MyBookFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isCompactPagination, setIsCompactPagination] = useState(false);

  const { data: rawReservations, isLoading } = useQuery({
    queryKey: ["reservations", "my"],
    queryFn: async () => {
      const { data } = await getUserReservations();
      return data;
    },
  });

  const reservations = useMemo(
    () => (Array.isArray(rawReservations) ? rawReservations : []),
    [rawReservations],
  );

  const { data: rawBooks } = useQuery({
    queryKey: ["books"],
    queryFn: getBooks,
  });

  const books = useMemo(
    () => (Array.isArray(rawBooks) ? rawBooks : []),
    [rawBooks],
  );

  const ownedBooks = useMemo<MyBook[]>(() => {
    if (!reservations.length) {
      return [];
    }

    const bookMap = new Map(books.map((item) => [item.id, item]));
    const latestReservationByBook = new Map<number, Reservation>();

    for (const reservation of reservations) {
      const previous = latestReservationByBook.get(reservation.bookId);
      if (!previous) {
        latestReservationByBook.set(reservation.bookId, reservation);
        continue;
      }

      latestReservationByBook.set(
        reservation.bookId,
        pickMoreRelevantReservation(previous, reservation),
      );
    }

    return [...latestReservationByBook.values()]
      .sort((left, right) => getReservationTimestamp(right) - getReservationTimestamp(left))
      .map((reservation) => {
        const book = bookMap.get(reservation.bookId);

        return {
          id: reservation.bookId,
          title: reservation.bookTitle ?? book?.title ?? t("book.untitled"),
          author: book?.author ?? "—",
          coverUrl: book?.coverUrl,
          status: getMyBookStatus(reservation, book?.status),
          reservation,
        } as MyBook;
      });
  }, [books, reservations, t]);

  const list = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
    const byStatus =
      status === "all"
        ? ownedBooks
        : ownedBooks.filter((book) => book.status === status);

    if (!normalizedSearchQuery) {
      return byStatus;
    }

    return byStatus.filter((book) => {
      const title = book.title.toLocaleLowerCase();
      const author = book.author.toLocaleLowerCase();
      return (
        title.includes(normalizedSearchQuery) ||
        author.includes(normalizedSearchQuery)
      );
    });
  }, [ownedBooks, searchQuery, status]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedList = useMemo(
    () => list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, list],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const applyState = () => setIsCompactPagination(mediaQuery.matches);
    applyState();
    mediaQuery.addEventListener("change", applyState);
    return () => mediaQuery.removeEventListener("change", applyState);
  }, []);

  const statusLabel = (value: MyBookFilter | MyBook["status"]) => {
    if (value === "all") {
      return t("my.status.all");
    }

    return t(`my.status.${value.toLocaleLowerCase()}`);
  };

  const formatReservationDate = (value?: string) => {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleDateString(i18n.language);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1>{t("pages.myBooksTitle")}</h1>
        <p>{t("my.subtitle")}</p>
        <input
          type="search"
          placeholder={t("my.searchPlaceholder")}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setPage(1);
          }}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.statusTabs}>
        <button
          type="button"
          className={status === "all" ? styles.tabActive : styles.tab}
          onClick={() => {
            setStatus("all");
            setPage(1);
          }}
        >
          {statusLabel("all")}
        </button>
        <button
          type="button"
          className={status === "TAKEN" ? styles.tabActive : styles.tab}
          onClick={() => {
            setStatus("TAKEN");
            setPage(1);
          }}
        >
          {statusLabel("TAKEN")}
        </button>
        <button
          type="button"
          className={status === "RESERVED" ? styles.tabActive : styles.tab}
          onClick={() => {
            setStatus("RESERVED");
            setPage(1);
          }}
        >
          {statusLabel("RESERVED")}
        </button>
        <button
          type="button"
          className={status === "RETURNED" ? styles.tabActive : styles.tab}
          onClick={() => {
            setStatus("RETURNED");
            setPage(1);
          }}
        >
          {statusLabel("RETURNED")}
        </button>
        <button
          type="button"
          className={status === "CANCELLED" ? styles.tabActive : styles.tab}
          onClick={() => {
            setStatus("CANCELLED");
            setPage(1);
          }}
        >
          {statusLabel("CANCELLED")}
        </button>
      </div>

      <div className={styles.grid}>
        {isLoading ? (
          <div>{t("common.loading")}</div>
        ) : list.length ? (
          pagedList.map((book) => (
            <div
              key={book.reservation?.id ?? `book-${book.id}`}
              className={styles.card}
            >
              <BookCard book={book as unknown as Book} isAuthed />
              <div className={styles.cardMeta}>
                <span className={styles.cardStatus}>{statusLabel(book.status)}</span>
                {book.reservation?.reservedAt ? (
                  <span>
                    {t("my.reservedAt")}: {formatReservationDate(book.reservation.reservedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div>{t("my.empty")}</div>
        )}
      </div>

      {list.length > 0 && totalPages > 1 ? (
        <div className={styles.pagination}>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            compact={isCompactPagination}
            onPageChange={setPage}
            ariaLabel={t("pagination.myBooksAria")}
          />
        </div>
      ) : null}
    </section>
  );
};

export default MyBooksPage;
