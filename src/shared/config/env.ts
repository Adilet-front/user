/**
 * Конфиг из переменных окружения (Vite: import.meta.env.VITE_*).
 * apiBaseUrl — бэкенд API; coverBaseUrl — базовый URL обложек книг.
 */
type EnvConfig = {
  apiBaseUrl: string;
  coverBaseUrl: string;
};

export const getEnv = (): EnvConfig => {
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.VITE_API_URL ??
    "http://localhost:8080"
  ).trim();

  const coverBaseUrl = (import.meta.env.VITE_COVER_BASE_URL ?? "").trim();

  return {
    apiBaseUrl,
    coverBaseUrl,
  };
};
