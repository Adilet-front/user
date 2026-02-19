import { useCallback, useEffect, useState } from "react";
import {
  type AppTheme,
  THEME_STORAGE_KEY,
  applyTheme,
  readTheme,
  writeTheme,
} from "./theme";

const isTheme = (value: string | null): value is AppTheme =>
  value === "light" || value === "dark";

export const useTheme = () => {
  const [theme, setTheme] = useState<AppTheme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
    writeTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      if (isTheme(event.newValue)) {
        setTheme(event.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDarkTheme: theme === "dark",
  };
};
