import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getBooks } from "../../entities/book/api/bookApi";
import { getCategories } from "../../entities/category/api/categoryApi";
import type { Book as ApiBook } from "../../entities/book/model/types";
import { type Book } from "../../entities/book/ui/BookCard";
import { useAuth } from "../../features/auth/model/useAuth";
import { BookCarousel } from "../../widgets/home/BookCarousel";
import styles from "./HomePage.module.scss";

const RAIL_BOOKS_LIMIT = 16;
const SKELETON_ITEMS = 6;

const sortByRecent = (left: ApiBook, right: ApiBook) => right.id - left.id;

type HomeRail = {
  key: string;
  title: string;
  books: Book[];
};

const normalizeCategoryKey = (value?: string) =>
  (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const toCardBook = (book: ApiBook): Book => ({
  id: book.id,
  title: book.title,
  author: book.author,
  coverUrl: book.coverUrl,
  category: book.category,
  averageRating: book.averageRating,
  reviewCount: book.reviewCount,
  status: book.status,
  label: book.status === "AVAILABLE" ? undefined : "unavailable",
});

const HomeSkeleton = () => (
  <div className={styles.skeletonGrid} aria-hidden="true">
    {Array.from({ length: SKELETON_ITEMS }).map((_, index) => (
      <div key={index} className={styles.skeletonCard} />
    ))}
  </div>
);

export const HomePage = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  const {
    data: books = [],
    isLoading: isBooksLoading,
    isError: isBooksError,
  } = useQuery({
    queryKey: ["home", "books"],
    queryFn: getBooks,
    staleTime: 60_000,
  });

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await getCategories();
      return data;
    },
    staleTime: 60_000,
  });

  const rails = useMemo<HomeRail[]>(() => {
    if (!categories.length || !books.length) {
      return [];
    }

    const uniqueCategories: Array<{ key: string; title: string }> = [];
    const seenCategoryKeys = new Set<string>();

    for (const category of categories) {
      const key = normalizeCategoryKey(category.name);
      if (!key || seenCategoryKeys.has(key)) {
        continue;
      }

      seenCategoryKeys.add(key);
      uniqueCategories.push({
        key,
        title: category.name.trim() || category.name,
      });
    }

    const booksByCategory = new Map<string, ApiBook[]>();
    for (const book of books) {
      const key = normalizeCategoryKey(book.category);
      if (!key) {
        continue;
      }

      const items = booksByCategory.get(key);
      if (items) {
        items.push(book);
      } else {
        booksByCategory.set(key, [book]);
      }
    }

    const usedBookIds = new Set<number>();
    const nextRails: HomeRail[] = [];

    for (const category of uniqueCategories) {
      const sourceBooks = booksByCategory.get(category.key);
      if (!sourceBooks?.length) {
        continue;
      }

      const sorted = [...sourceBooks].sort(sortByRecent);
      const localBookIds = new Set<number>();
      const railBooks: Book[] = [];

      for (const book of sorted) {
        if (localBookIds.has(book.id) || usedBookIds.has(book.id)) {
          continue;
        }

        localBookIds.add(book.id);
        usedBookIds.add(book.id);
        railBooks.push(toCardBook(book));

        if (railBooks.length === RAIL_BOOKS_LIMIT) {
          break;
        }
      }

      if (railBooks.length) {
        nextRails.push({
          key: category.key,
          title: category.title,
          books: railBooks,
        });
      }
    }

    return nextRails;
  }, [categories, books]);

  const isLoading = isBooksLoading || isCategoriesLoading;
  const isError = isBooksError || isCategoriesError;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>{t("pages.homeTitle")}</h1>
        <p>{t("home.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className={styles.loadingState}>
          <HomeSkeleton />
          <HomeSkeleton />
          <HomeSkeleton />
        </div>
      ) : isError ? (
        <div className={styles.empty}>{t("errors.booksLoad")}</div>
      ) : (
        rails.length > 0 ? (
          <div className={styles.rails}>
            {rails.map((rail) => (
              <BookCarousel
                key={rail.key}
                title={rail.title}
                books={rail.books}
                isAuthed={isAuthenticated}
                emptyText={t("home.empty")}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>{t("home.empty")}</div>
        )
      )}
    </section>
  );
};

export default HomePage;
