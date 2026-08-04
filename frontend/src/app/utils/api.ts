import { apiClient } from "@/lib/api-client";

/**
 * Unified Axios instance delegating directly to ApiClient singleton.
 * Shares common request/response interceptors, headers, and token management across the frontend.
 */
const api = apiClient.instance;

export default api;

