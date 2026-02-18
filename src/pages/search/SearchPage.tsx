import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCategories } from "../../entities/category/api/categoryApi";
import { getCatalogBooks } from "../../features/catalog/api/catalogApi";
import { useAuth } from "../../features/auth/model/useAuth";
import { getUserReservations } from "../../entities/booking/api/bookingApi";
import { BookCard, type Book } from "../../entities/book/ui/BookCard";
import { Pagination } from "../../shared/ui/Pagination/Pagination";
import styles from "./SearchPage.module.scss";

const PAGE_SIZE = 8;

const buildSearchPath = (query: string, categoryId: string, page = 1) => {
  const params = new URLSearchParams();
  const normalizedQuery = query.trim();

  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }

  if (categoryId !== "all") {
    params.set("categoryId", categoryId);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
};

export const SearchPage = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [isCompactPagination, setIsCompactPagination] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const query = params.get("q")?.trim() ?? "";
  const categoryParam = params.get("categoryId") ?? "all";
  const pageParam = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const parsedCategoryId =
    categoryParam !== "all" && Number.isFinite(Number(categoryParam))
      ? Number(categoryParam)
      : undefined;
  const hasFilters = query.length > 0 || parsedCategoryId !== undefined;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await getCategories();
      return data;
    },
    staleTime: 60_000,
  });

  const {
    data: catalogData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["search", query, parsedCategoryId, page],
    queryFn: () =>
      getCatalogBooks(
        {
          format: "all",
          language: "all",
          searchQuery: query || undefined,
          categoryId: parsedCategoryId,
        },
        "popular",
        page,
        PAGE_SIZE,
      ),
    enabled: hasFilters,
    placeholderData: keepPreviousData,
  });

  const { items = [], total = 0, totalPages = 1 } = catalogData ?? {};
  const currentPage = Math.min(page, totalPages);

  const books: Book[] = items.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    label: book.label,
    coverUrl: book.coverUrl,
    category: book.category,
    averageRating: book.averageRating,
    reviewCount: book.reviewCount,
    status: book.status,
  }));

  const { data: myReservations = [] } = useQuery({
    queryKey: ["reservations", "my"],
    queryFn: async () => {
      const { data } = await getUserReservations();
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const myBookIds = useMemo(
    () => new Set(myReservations.map((item) => item.bookId)),
    [myReservations],
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

  const handleCategoryChange = (value: string) => {
    navigate(buildSearchPath(query, value, 1));
  };

  const handleResetFilters = () => {
    navigate(buildSearchPath(query, "all", 1));
  };

  const pageTitle = query
    ? t("search.resultsFor", { query })
    : t("pages.searchTitle");

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>{pageTitle}</h1>
          <p>{hasFilters ? t("catalog.count", { count: total }) : t("search.startHint")}</p>
        </div>
        <button
          type="button"
          className={styles.filtersToggle}
          onClick={() => setIsFiltersOpen((prev) => !prev)}
          aria-expanded={isFiltersOpen}
        >
          {t("catalog.filters")}
        </button>
      </header>

      {!hasFilters ? (
        <div className={styles.empty}>{t("search.empty")}</div>
      ) : isLoading ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : isError ? (
        <div className={styles.empty}>{t("errors.booksLoad")}</div>
      ) : (
        <>
          <div className={styles.tabs} role="tablist" aria-label={t("pages.searchTitle")}>
            <button type="button" className={`${styles.tab} ${styles.tabActive}`} role="tab">
              {t("search.tabs.books", { count: total })}
            </button>
            <span className={styles.tab} role="tab" aria-disabled="true">
              {t("search.tabs.authors", { count: 0 })}
            </span>
            <span className={styles.tab} role="tab" aria-disabled="true">
              {t("search.tabs.series", { count: 0 })}
            </span>
          </div>

          <div className={styles.layout}>
            <aside className={styles.sidebar} data-open={isFiltersOpen ? "true" : "false"}>
              <div className={styles.sidebarHead}>
                <h2>{t("catalog.filters")}</h2>
                <button type="button" className={styles.resetInline} onClick={handleResetFilters}>
                  {t("catalog.reset")}
                </button>
              </div>

              <div>
                <p className={styles.sidebarTitle}>{t("catalog.genre")}</p>
                <div className={styles.categoryList}>
                  <button
                    type="button"
                    className={
                      categoryParam === "all" ? styles.categoryActive : styles.categoryButton
                    }
                    onClick={() => handleCategoryChange("all")}
                  >
                    {t("catalog.all")}
                  </button>

                  {categories.map((category) => {
                    const categoryValue = String(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={
                          categoryParam === categoryValue
                            ? styles.categoryActive
                            : styles.categoryButton
                        }
                        onClick={() => handleCategoryChange(categoryValue)}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div className={styles.results}>
              {books.length ? (
                <>
                  <div className={styles.grid}>
                    {books.map((book) => (
                      <article key={book.id} className={styles.gridItem}>
                        <BookCard book={book} isAuthed={isAuthenticated} />
                        {myBookIds.has(book.id) ? (
                          <span className={styles.inMyBooks}>{t("search.inMyBooks")}</span>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className={styles.pagination}>
                    <Pagination
                      page={currentPage}
                      totalPages={totalPages}
                      compact={isCompactPagination}
                      onPageChange={(targetPage) =>
                        navigate(buildSearchPath(query, categoryParam, targetPage))
                      }
                      ariaLabel={t("pagination.searchAria")}
                    />
                  </div>
                </>
              ) : (
                <div className={styles.empty}>{t("catalog.empty")}</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SearchPage;
