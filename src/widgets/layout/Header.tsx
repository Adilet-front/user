import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserActiveReservations } from "../../entities/booking/api/bookingApi";
import { getUnreadNotificationsCount } from "../../entities/notification/api/notificationApi";
import { useAuth } from "../../features/auth/model/useAuth";
import { resolveAvatarUrl } from "../../shared/lib/media/avatar";
import { useSearchSuggestions } from "../../shared/lib/search/useSearchSuggestions";
import styles from "./Header.module.scss";

type HeaderDropdown = "my-books" | "profile";
const DROPDOWN_CLOSE_DELAY = 650;

export const Header = () => {
  const { t } = useTranslation();
  const { isAuthenticated, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<HeaderDropdown | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const dropdownCloseTimerRef = useRef<number | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const canUseDom = typeof document !== "undefined";
  const resolvedAvatarUrl = resolveAvatarUrl(user?.avatarUrl);
  const avatarSrc = avatarLoadFailed ? null : resolvedAvatarUrl;

  const { data: activeReservations = [] } = useQuery({
    queryKey: ["reservations", "active"],
    queryFn: async () => {
      const { data } = await getUserActiveReservations();
      return data;
    },
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  const { data: unreadNotificationsCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: getUnreadNotificationsCount,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const {
    suggestions,
    isLoading: isSuggestionsLoading,
    isError: isSuggestionsError,
  } = useSearchSuggestions({
    term: query,
    isAuthed: isAuthenticated,
    isActive: isSearchOpen,
  });

  useEffect(() => {
    if (!canUseDom) {
      return;
    }
    document.body.classList.toggle("search-open", isSearchOpen);
    return () => {
      document.body.classList.remove("search-open");
    };
  }, [isSearchOpen, canUseDom]);

  const clearDropdownCloseTimer = useCallback(() => {
    if (dropdownCloseTimerRef.current) {
      window.clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
  }, []);

  const openDropdown = useCallback(
    (dropdown: HeaderDropdown) => {
      clearDropdownCloseTimer();
      setActiveDropdown(dropdown);
    },
    [clearDropdownCloseTimer],
  );

  const toggleDropdown = useCallback(
    (dropdown: HeaderDropdown) => {
      clearDropdownCloseTimer();
      setActiveDropdown((current) => (current === dropdown ? null : dropdown));
    },
    [clearDropdownCloseTimer],
  );

  const scheduleDropdownClose = useCallback(
    (dropdown: HeaderDropdown) => {
      clearDropdownCloseTimer();
      dropdownCloseTimerRef.current = window.setTimeout(() => {
        setActiveDropdown((current) => (current === dropdown ? null : current));
        dropdownCloseTimerRef.current = null;
      }, DROPDOWN_CLOSE_DELAY);
    },
    [clearDropdownCloseTimer],
  );

  const closeDropdowns = useCallback(() => {
    clearDropdownCloseTimer();
    setActiveDropdown(null);
  }, [clearDropdownCloseTimer]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
      if (dropdownCloseTimerRef.current) {
        window.clearTimeout(dropdownCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canUseDom || !activeDropdown) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && actionsRef.current?.contains(target)) {
        return;
      }
      closeDropdowns();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeDropdown, canUseDom, closeDropdowns]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [resolvedAvatarUrl]);

  const submitSearch = (term: string) => {
    const normalized = term.trim();
    if (!normalized) {
      return;
    }
    setIsSearching(true);
    setIsSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(normalized)}`);
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      setIsSearching(false);
    }, 900);
  };

  const handleSignOut = () => {
    if (!confirm(t("header.signOutConfirm"))) {
      return;
    }
    signOut();
    navigate("/");
  };

  const activeReservationCount = activeReservations.length;
  const hasUnreadNotifications = unreadNotificationsCount > 0;
  const effectiveDropdown =
    !isAuthenticated && activeDropdown === "profile" ? null : activeDropdown;

  return (
    <>
      <header
        className={styles.header}
        data-search-open={isSearchOpen ? "true" : "false"}
      >
        {isSearchOpen ? (
          <div
            className={styles.headerOverlay}
            aria-hidden="true"
            onMouseDown={() => setIsSearchOpen(false)}
          />
        ) : null}
        <div className={styles.row}>
          <div className={styles.left}>
            <button
              className={styles.burger}
              type="button"
              onClick={() =>
                setIsMenuOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    closeDropdowns();
                  }
                  return next;
                })
              }
              aria-expanded={isMenuOpen}
              aria-label={t("header.toggleMenu")}
              data-open={isMenuOpen ? "true" : "false"}
            >
              <span />
              <span />
              <span />
            </button>
            <Link to="/" className={styles.logo}>
              {t("appName")}
            </Link>
            <NavLink to="/catalog" className={styles.catalogButton}>
              {t("header.catalogButton")}
            </NavLink>
          </div>

          <form
            className={styles.search}
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch(query);
            }}
            onFocusCapture={() => {
              if (isAuthenticated) {
                closeDropdowns();
                setIsSearchOpen(true);
              }
            }}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(nextTarget)) {
                setIsSearchOpen(false);
              }
            }}
          >
            <input
              type="search"
              placeholder={t("search.placeholder")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
            <button
              className={styles.searchSubmit}
              type="submit"
              data-loading={isSearching ? "true" : "false"}
            >
              {isSearching ? (
                <span className={styles.searchLoader} aria-hidden="true" />
              ) : null}
              <span className={styles.searchLabel}>
                {t("search.submitButton")}
              </span>
            </button>
            {isSearchOpen && isAuthenticated ? (
              <div className={styles.searchDropdown}>
                {isSuggestionsLoading ? (
                  <p className={styles.searchEmpty}>
                    {t("search.suggestionsLoading")}
                  </p>
                ) : isSuggestionsError ? (
                  <p className={styles.searchEmpty}>
                    {t("search.suggestionsError")}
                  </p>
                ) : suggestions.length ? (
                  suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={styles.searchItem}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery(suggestion.query);
                        submitSearch(suggestion.query);
                      }}
                    >
                      <span className={styles.searchItemMain}>
                        <span className={styles.searchItemPrimary}>
                          {suggestion.primary}
                        </span>
                        <span className={styles.searchItemType}>
                          {suggestion.kind === "author"
                            ? t("search.suggestionTypeAuthor")
                            : t("search.suggestionTypeBook")}
                        </span>
                      </span>
                      <span className={styles.searchItemSecondary}>
                        {suggestion.kind === "author"
                          ? t("search.suggestionAuthorHint")
                          : suggestion.secondary}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className={styles.searchEmpty}>
                    {t("search.suggestionsEmpty")}
                  </p>
                )}
              </div>
            ) : null}
          </form>

          <div className={styles.actions} ref={actionsRef}>
            <div
              className={styles.navDropdown}
              onMouseEnter={() => openDropdown("my-books")}
              onMouseLeave={() => scheduleDropdownClose("my-books")}
              onFocusCapture={() => openDropdown("my-books")}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!event.currentTarget.contains(nextTarget)) {
                  scheduleDropdownClose("my-books");
                }
              }}
            >
              <button
                type="button"
                className={styles.navSummary}
                data-open={effectiveDropdown === "my-books" ? "true" : "false"}
                aria-expanded={effectiveDropdown === "my-books"}
                onClick={() => toggleDropdown("my-books")}
              >
                {t("nav.myBooks")}
                {isAuthenticated && activeReservationCount > 0 ? (
                  <span className={styles.counterBadge}>
                    {activeReservationCount}
                  </span>
                ) : null}
              </button>
              <div
                className={styles.navMenu}
                data-open={effectiveDropdown === "my-books" ? "true" : "false"}
                aria-hidden={
                  effectiveDropdown === "my-books" ? "false" : "true"
                }
              >
                <NavLink to="/my" onClick={closeDropdowns}>
                  {t("nav.myBooks")}
                </NavLink>
                <NavLink to="/wishlist" onClick={closeDropdowns}>
                  {t("nav.wishlist")}
                </NavLink>
              </div>
            </div>

            {!isAuthenticated ? (
              <Link to="/auth/login" className={styles.loginButton}>
                {t("nav.login")}
              </Link>
            ) : (
              <div
                className={styles.profileMenu}
                onMouseEnter={() => openDropdown("profile")}
                onMouseLeave={() => scheduleDropdownClose("profile")}
                onFocusCapture={() => openDropdown("profile")}
                onBlurCapture={(event) => {
                  const nextTarget = event.relatedTarget as Node | null;
                  if (!event.currentTarget.contains(nextTarget)) {
                    scheduleDropdownClose("profile");
                  }
                }}
              >
                <button
                  type="button"
                  className={styles.profileSummary}
                  data-open={effectiveDropdown === "profile" ? "true" : "false"}
                  aria-expanded={effectiveDropdown === "profile"}
                  aria-label={t("nav.profile")}
                  onClick={() => toggleDropdown("profile")}
                >
                  {avatarSrc ? (
                    <img
                      className={styles.profileAvatar}
                      src={avatarSrc}
                      alt=""
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <span className={styles.profileAvatar} aria-hidden="true" />
                  )}
                  {hasUnreadNotifications ? (
                    <span className={styles.counterBadge}>
                      {unreadNotificationsCount}
                    </span>
                  ) : null}
                </button>
                <div
                  className={styles.profileDropdown}
                  data-open={effectiveDropdown === "profile" ? "true" : "false"}
                  aria-hidden={
                    effectiveDropdown === "profile" ? "false" : "true"
                  }
                >
                  <NavLink to="/profile" onClick={closeDropdowns}>
                    {t("nav.profile")}
                  </NavLink>
                  <NavLink to="/profile/notifications" onClick={closeDropdowns}>
                    {t("header.notifications")}
                    {hasUnreadNotifications ? (
                      <span className={styles.inlineCounter}>
                        {unreadNotificationsCount}
                      </span>
                    ) : null}
                  </NavLink>
                  <button
                    type="button"
                    className={styles.profileLogout}
                    onClick={() => {
                      closeDropdowns();
                      handleSignOut();
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className={styles.mobilePanel}
          data-open={isMenuOpen ? "true" : "false"}
        >
          <nav className={styles.mobileNav}>
            <NavLink to="/catalog" onClick={() => setIsMenuOpen(false)}>
              {t("nav.catalog")}
            </NavLink>
            <NavLink to="/my" onClick={() => setIsMenuOpen(false)}>
              {t("nav.myBooks")}
              {isAuthenticated && activeReservationCount > 0 ? (
                <span className={styles.inlineCounter}>
                  {activeReservationCount}
                </span>
              ) : null}
            </NavLink>
            <NavLink to="/wishlist" onClick={() => setIsMenuOpen(false)}>
              {t("nav.wishlist")}
            </NavLink>
          </nav>
          <div className={styles.mobileActions}>
            {!isAuthenticated ? (
              <Link
                to="/auth/login"
                className={styles.mobileLoginButton}
                onClick={() => setIsMenuOpen(false)}
              >
                {t("nav.login")}
              </Link>
            ) : (
              <>
                <div className={styles.mobileProfileCard}>
                  {avatarSrc ? (
                    <img
                      className={styles.mobileProfileAvatar}
                      src={avatarSrc}
                      alt=""
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div className={styles.mobileProfileAvatar} />
                  )}
                </div>
                <div className={styles.mobileProfileLinks}>
                  <NavLink to="/profile" onClick={() => setIsMenuOpen(false)}>
                    {t("nav.profile")}
                  </NavLink>
                  <NavLink
                    to="/profile/notifications"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t("header.notifications")}
                    {hasUnreadNotifications ? (
                      <span className={styles.inlineCounter}>
                        {unreadNotificationsCount}
                      </span>
                    ) : null}
                  </NavLink>
                </div>
                <button
                  type="button"
                  className={styles.mobileLogoutButton}
                  onClick={handleSignOut}
                >
                  {t("nav.logout")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      {isSearchOpen && canUseDom
        ? createPortal(
            <div
              className={styles.searchOverlay}
              aria-hidden="true"
              onMouseDown={() => setIsSearchOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
};
