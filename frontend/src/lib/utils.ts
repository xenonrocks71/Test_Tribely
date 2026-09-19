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

/**
 * Bulletproof parser that ensures any UTC date string from PostgreSQL, SQLite, or backend API
 * is accurately interpreted in UTC before being converted to user local device time.
 */
export function parseSafeUtcDate(dateStr?: string | Date | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;

  let clean = String(dateStr).trim();
  if (!clean) return new Date();

  // If purely numeric string (timestamp in ms or s)
  if (/^\d{10,13}$/.test(clean)) {
    const num = Number(clean);
    return new Date(clean.length === 10 ? num * 1000 : num);
  }

  // Handle "DD/MM/YYYY, HH:MM:SS" (common Python strftime legacy output)
  const dmyMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  }

  // If format like "2026-09-18 06:15:00", replace space with "T"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(clean)) {
    clean = clean.replace(/\s+/, "T");
  }

  // If missing timezone suffix ("Z" or offset "+XX:XX" or "-XX:XX"), append "Z" because database stores UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(clean)) {
    clean += "Z";
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format accurate date and time in the user's browser local timezone.
 * Handles "Today, 10:58 PM", "Yesterday, 10:58 PM", or "Sep 18, 10:58 PM".
 */
export function formatActualDateTime(dateStr?: string | Date | null, fallbackStr?: string): string {
  if (!dateStr && !fallbackStr) return "Recent";
  try {
    const d = parseSafeUtcDate(dateStr || fallbackStr);
    if (isNaN(d.getTime())) return fallbackStr || "Recent";
    const now = new Date();
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }

    const isSameYear = d.getFullYear() === now.getFullYear();
    const dateStrFormatted = d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      ...(isSameYear ? {} : { year: "numeric" }),
    });

    return `${dateStrFormatted}, ${timeStr}`;
  } catch {
    return fallbackStr || "Recent";
  }
}

/**
 * Full verbose date and time string with timezone name for accuracy tooltips.
 */
export function formatFullDateTimeTooltip(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = parseSafeUtcDate(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}

export function formatTimeAgo(dateStr?: string | Date | null): string {
  if (!dateStr) return "Recent";
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
    return String(dateStr);
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
        timeZoneName: "short",
      }),
    };
  } catch {
    return { displayTime: "Today", fullDateTooltip: "" };
  }
}
