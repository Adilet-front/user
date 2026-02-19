import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserActiveReservations } from "../../entities/booking/api/bookingApi";
import { getUnreadNotificationsCount } from "../../entities/notification/api/notificationApi";
import { useAuth } from "../../features/auth/model/useAuth";
import type { AppLanguage } from "../../app/i18n/resources";
import { resolveAvatarUrl } from "../../shared/lib/media/avatar";
import { useSearchSuggestions } from "../../shared/lib/search/useSearchSuggestions";
import { useTheme } from "../../shared/lib/theme/useTheme";
import styles from "./Header.module.scss";

type HeaderDropdown = "my-books" | "profile";
const DROPDOWN_CLOSE_DELAY = 650;
const LANGUAGE_CLOSE_DELAY = 320;
const LANGUAGE_OPTIONS: AppLanguage[] = ["ru", "en", "kg"];

const resolveLanguageCode = (value?: string): AppLanguage => {
  if (value === "ru" || value === "en" || value === "kg") {
    return value;
  }

  const normalized = value?.split("-")[0];
  if (normalized === "ru" || normalized === "en" || normalized === "kg") {
    return normalized;
  }

  return "ru";
};

export const Header = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, signOut, user } = useAuth();
  const { isDarkTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<HeaderDropdown | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const searchTimerRef = useRef<number | null>(null);
  const dropdownCloseTimerRef = useRef<number | null>(null);
  const languageCloseTimerRef = useRef<number | null>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const canUseDom = typeof document !== "undefined";
  const resolvedAvatarUrl = resolveAvatarUrl(user?.avatarUrl);
  const avatarSrc = avatarLoadFailed ? null : resolvedAvatarUrl;
  const currentLanguage = resolveLanguageCode(i18n.resolvedLanguage ?? i18n.language);

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

  const clearLanguageCloseTimer = useCallback(() => {
    if (languageCloseTimerRef.current) {
      window.clearTimeout(languageCloseTimerRef.current);
      languageCloseTimerRef.current = null;
    }
  }, []);

  const openDropdown = useCallback(
    (dropdown: HeaderDropdown) => {
      clearDropdownCloseTimer();
      clearLanguageCloseTimer();
      setIsLanguageMenuOpen(false);
      setActiveDropdown(dropdown);
    },
    [clearDropdownCloseTimer, clearLanguageCloseTimer],
  );

  const toggleDropdown = useCallback(
    (dropdown: HeaderDropdown) => {
      clearDropdownCloseTimer();
      clearLanguageCloseTimer();
      setIsLanguageMenuOpen(false);
      setActiveDropdown((current) => (current === dropdown ? null : dropdown));
    },
    [clearDropdownCloseTimer, clearLanguageCloseTimer],
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

  const openLanguageMenu = useCallback(() => {
    clearLanguageCloseTimer();
    clearDropdownCloseTimer();
    setActiveDropdown(null);
    setIsLanguageMenuOpen(true);
  }, [clearDropdownCloseTimer, clearLanguageCloseTimer]);

  const toggleLanguageMenu = useCallback(() => {
    clearLanguageCloseTimer();
    clearDropdownCloseTimer();
    setActiveDropdown(null);
    setIsLanguageMenuOpen((current) => !current);
  }, [clearDropdownCloseTimer, clearLanguageCloseTimer]);

  const scheduleLanguageMenuClose = useCallback(() => {
    clearLanguageCloseTimer();
    languageCloseTimerRef.current = window.setTimeout(() => {
      setIsLanguageMenuOpen(false);
      languageCloseTimerRef.current = null;
    }, LANGUAGE_CLOSE_DELAY);
  }, [clearLanguageCloseTimer]);

  const closeMenus = useCallback(() => {
    clearDropdownCloseTimer();
    clearLanguageCloseTimer();
    setActiveDropdown(null);
    setIsLanguageMenuOpen(false);
  }, [clearDropdownCloseTimer, clearLanguageCloseTimer]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
      }
      if (dropdownCloseTimerRef.current) {
        window.clearTimeout(dropdownCloseTimerRef.current);
      }
      if (languageCloseTimerRef.current) {
        window.clearTimeout(languageCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canUseDom || (!activeDropdown && !isLanguageMenuOpen)) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && actionsRef.current?.contains(target)) {
        return;
      }
      closeMenus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeDropdown, canUseDom, closeMenus, isLanguageMenuOpen]);

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
  const themeToggleLabel = isDarkTheme
    ? t("header.themeToggleToLight")
    : t("header.themeToggleToDark");
  const currentThemeLabel = isDarkTheme
    ? t("header.themeDark")
    : t("header.themeLight");

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
                    closeMenus();
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
                closeMenus();
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
                          {t("search.suggestionTypeBook")}
                        </span>
                      </span>
                      <span className={styles.searchItemSecondary}>
                        {suggestion.secondary}
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
                <NavLink to="/my" onClick={closeMenus}>
                  {t("nav.myBooks")}
                </NavLink>
                <NavLink to="/wishlist" onClick={closeMenus}>
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
                  <NavLink to="/profile" onClick={closeMenus}>
                    {t("nav.profile")}
                  </NavLink>
                  <NavLink to="/profile/notifications" onClick={closeMenus}>
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
                      closeMenus();
                      handleSignOut();
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className={styles.themeToggle}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
              onClick={toggleTheme}
            >
              <span className={styles.themeToggleIcon} aria-hidden="true">
                {isDarkTheme ? "🌙" : "☀️"}
              </span>
            </button>

            <div
              className={styles.languageMenu}
              onMouseEnter={openLanguageMenu}
              onMouseLeave={scheduleLanguageMenuClose}
              onFocusCapture={openLanguageMenu}
              onBlurCapture={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!event.currentTarget.contains(nextTarget)) {
                  scheduleLanguageMenuClose();
                }
              }}
            >
              <button
                type="button"
                className={styles.languageSummary}
                data-open={isLanguageMenuOpen ? "true" : "false"}
                aria-expanded={isLanguageMenuOpen}
                aria-label={t("header.language")}
                onClick={toggleLanguageMenu}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm7 9h-3a15 15 0 0 0-1.05-5 7.03 7.03 0 0 1 4.05 5ZM12 5c.9 1.2 1.7 3.08 1.95 5h-3.9c.25-1.92 1.05-3.8 1.95-5ZM9.05 7A15 15 0 0 0 8 12H5a7.03 7.03 0 0 1 4.05-5ZM5 13h3c.13 1.84.5 3.54 1.05 5A7.03 7.03 0 0 1 5 13Zm7 6c-.9-1.2-1.7-3.08-1.95-5h3.9c-.25 1.92-1.05 3.8-1.95 5Zm2.95-1a15 15 0 0 0 1.05-5h3a7.03 7.03 0 0 1-4.05 5Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div
                className={styles.languageDropdown}
                data-open={isLanguageMenuOpen ? "true" : "false"}
                aria-hidden={isLanguageMenuOpen ? "false" : "true"}
              >
                {LANGUAGE_OPTIONS.map((languageCode) => (
                  <button
                    key={languageCode}
                    type="button"
                    className={
                      languageCode === currentLanguage
                        ? styles.languageOptionActive
                        : styles.languageOption
                    }
                    onClick={() => {
                      i18n.changeLanguage(languageCode);
                      closeMenus();
                    }}
                  >
                    <span>{t(`header.languages.${languageCode}`)}</span>
                    {languageCode === currentLanguage ? (
                      <span className={styles.languageCheck} aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
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
            <div className={styles.mobileLanguage}>
              <span className={styles.mobileLanguageLabel}>
                {t("header.language")}
              </span>
              <div className={styles.mobileLanguageButtons}>
                {LANGUAGE_OPTIONS.map((languageCode) => (
                  <button
                    key={languageCode}
                    type="button"
                    className={
                      languageCode === currentLanguage
                        ? styles.mobileLanguageButtonActive
                        : styles.mobileLanguageButton
                    }
                    onClick={() => i18n.changeLanguage(languageCode)}
                  >
                    {t(`header.languages.${languageCode}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.mobileTheme}>
              <span className={styles.mobileThemeLabel}>{t("header.theme")}</span>
              <button
                type="button"
                className={styles.mobileThemeButton}
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
              >
                <span className={styles.mobileThemeIcon} aria-hidden="true">
                  {isDarkTheme ? "🌙" : "☀️"}
                </span>
                <span>{currentThemeLabel}</span>
              </button>
            </div>
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
