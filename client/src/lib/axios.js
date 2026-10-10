import axios from "axios";
import { getToken, clearToken } from "./tokenStorage";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.skipAuthHandler &&
      getToken()
    ) {
      clearToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

/**
 * Normalizes any axios/network error into:
 * { message: string, code: string, details?: array, status?: number }
 */
export function normalizeError(error) {
  if (error.response?.data?.error) {
    const e = error.response.data.error;
    return {
      message: e.message || "Something went wrong",
      code: e.code || "ERROR",
      details: e.details,
      status: error.response.status,
    };
  }
  if (error.request) {
    return {
      message:
        "Unable to reach the server. Check your connection and try again.",
      code: "NETWORK_ERROR",
    };
  }
  return {
    message: error.message || "Something went wrong",
    code: "CLIENT_ERROR",
  };
}

export function fieldErrorsFrom(normalized) {
  const map = {};
  if (normalized?.details) {
    for (const d of normalized.details) {
      if (d.field && !map[d.field]) map[d.field] = d.message;
    }
  }
  return map;
}
