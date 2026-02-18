import { getEnv } from "../../config/env";

const DEFAULT_AVATAR_BASE_URL = "http://localhost:9000/avatars/";
const DEFAULT_AVATAR_ICON_URL =
  "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/person-circle.svg";

const normalizeLegacyMinioUrl = (value: string) => {
  if (!value.startsWith("http://localhost:9001/browser/avatars/")) {
    return value;
  }

  return value.replace(
    "http://localhost:9001/browser/avatars/",
    "http://localhost:9000/avatars/",
  );
};

const normalizeMinioHost = (value: string) => {
  if (value.startsWith("http://minio:9000/")) {
    return value.replace("http://minio:9000/", "http://localhost:9000/");
  }

  if (value.startsWith("https://minio:9000/")) {
    return value.replace("https://minio:9000/", "http://localhost:9000/");
  }

  if (value.startsWith("//minio:9000/")) {
    return value.replace("//minio:9000/", "http://localhost:9000/");
  }

  if (value.startsWith("minio:9000/")) {
    return value.replace("minio:9000/", "http://localhost:9000/");
  }

  return value;
};

const isAbsoluteUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

const ensureTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

export const resolveAvatarUrl = (avatarUrl?: string | null) => {
  if (!avatarUrl?.trim()) {
    return DEFAULT_AVATAR_ICON_URL;
  }

  const normalized = normalizeLegacyMinioUrl(normalizeMinioHost(avatarUrl.trim()));
  if (isAbsoluteUrl(normalized)) {
    return normalized;
  }

  const coverBaseUrl = getEnv().coverBaseUrl.trim();
  const base = coverBaseUrl
    ? coverBaseUrl.replace(/\/book-covers\/?$/i, "/avatars/")
    : DEFAULT_AVATAR_BASE_URL;
  const path = normalized.replace(/^\/+/, "");

  if (path.startsWith("avatars/")) {
    return `http://localhost:9000/${path}`;
  }

  return `${ensureTrailingSlash(base)}${path}`;
};
