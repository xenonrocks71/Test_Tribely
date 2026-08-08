import { apiClient } from "@/lib/api-client";

/**
 * Unified Axios instance delegating directly to ApiClient singleton.
 * Shares common request/response interceptors, headers, and token management across the frontend.
 */
const api = apiClient.instance;

export function formatErrorMessage(detail: any, defaultMsg: string = "An error occurred"): string {
  if (!detail) return defaultMsg;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item && typeof item.msg === "string") return item.msg;
        if (item && typeof item.message === "string") return item.message;
        return null;
      })
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join(", ");
  }
  if (typeof detail === "object" && detail !== null) {
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.detail === "string") return detail.detail;
    if (typeof detail.msg === "string") return detail.msg;
  }
  return defaultMsg;
}

export default api;


