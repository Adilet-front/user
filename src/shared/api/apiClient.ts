import axios from "axios";
import { getEnv } from "../config/env";
import { clearTokens, getAccessToken } from "../lib/auth/token";

const isBrowser = () => typeof window !== "undefined";
const API_BASE_URL = getEnv().apiBaseUrl.replace(/\/+$/, "");

const redirectToLogin = () => {
  if (!isBrowser()) {
    return;
  }

  const authPaths = new Set([
    "/auth/login",
    "/auth/register",
    "/auth/reset-password",
  ]);
  if (!authPaths.has(window.location.pathname)) {
    window.location.assign("/auth/login");
  }
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearTokens();
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);
