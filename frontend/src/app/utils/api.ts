import axios from "axios";

/**
 * Resolve backend URL.
 *
 * Priority:
 * 1. Production environment variable
 * 2. Current browser hostname (same WiFi)
 * 3. Localhost fallback for SSR
 */
const getBaseUrl = () => {
  // Production
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Browser
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Always use HTTP for local development.
    // FastAPI is not serving HTTPS locally.
    return `http://${hostname}:8000`;
  }

  // SSR fallback
  return "http://127.0.0.1:8000";
};

const api = axios.create({
  baseURL: getBaseUrl(),

  // Increased timeout for slower mobile WiFi
  timeout: 10000,

  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("tribely_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Handle expired authentication
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error?.response?.status === 401) {
      localStorage.removeItem("tribely_token");

      // Prevent redirect loop
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?session=expired";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
