/**
 * General Utilities for Tribely Frontend.
 */

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

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}
