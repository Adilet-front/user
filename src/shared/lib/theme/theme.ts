export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "office_lib_theme";
export const DEFAULT_THEME: AppTheme = "light";

const isBrowser = () => typeof window !== "undefined";

const isAppTheme = (value: string | null): value is AppTheme =>
  value === "light" || value === "dark";

export const readTheme = (): AppTheme => {
  if (!isBrowser()) {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isAppTheme(storedTheme)) {
    return storedTheme;
  }

  return DEFAULT_THEME;
};

export const writeTheme = (theme: AppTheme) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const applyTheme = (theme: AppTheme) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("data-theme", theme);
};

export const initTheme = (): AppTheme => {
  const theme = readTheme();
  applyTheme(theme);
  return theme;
};
