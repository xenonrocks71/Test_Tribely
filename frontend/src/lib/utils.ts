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

export function parseSafeUtcDate(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  let clean = String(dateStr).trim();
  if (!clean) return new Date();

  // If format like "2026-09-18 06:15:00", replace space with "T"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(clean)) {
    clean = clean.replace(/\s+/, "T");
  }
  // If missing timezone suffix ("Z" or offset "+XX:XX" or "-XX:XX"), append "Z" because backend database stores UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(clean)) {
    clean += "Z";
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const date = parseSafeUtcDate(dateStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
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

export function formatPostActualTime(submittedAt?: string, fallbackStr?: string): {
  displayTime: string;
  fullDateTooltip: string;
} {
  try {
    const d = parseSafeUtcDate(submittedAt || fallbackStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - d.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    const isToday = d.toDateString() === now.toDateString();

    let relativeStr = "";
    if (diffMins < 1) {
      relativeStr = "Just now";
    } else if (diffMins < 60) {
      relativeStr = `${diffMins}m ago`;
    } else if (diffHours < 24 && isToday) {
      relativeStr = `${diffHours}h ago`;
    }

    let displayTime = "";
    if (isToday) {
      displayTime = relativeStr ? `${timeStr} (${relativeStr})` : `${timeStr} · Today`;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        displayTime = `Yesterday at ${timeStr}`;
      } else {
        displayTime = `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
      }
    }

    return {
      displayTime,
      fullDateTooltip: d.toLocaleString([], {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
    };
  } catch {
    return { displayTime: "Today", fullDateTooltip: "" };
  }
}

