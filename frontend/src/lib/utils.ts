import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date into a modern, easy-to-read timestamp like "Sep 21, 2025 • 2:30 PM".
 * Accepts Date or string (ISO).
 */
export function formatDateTime(value?: string | Date | null) {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return format(d, "MMM d, yyyy • h:mm a");
  } catch {
    return String(value);
  }
}

/**
 * Friendly relative time like "2 hours ago" for very recent events, falling back to formatted date.
 */
export function formatDateRelative(value?: string | Date | null) {
  if (!value) return "";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    // For today/yesterday use relative phrasing, otherwise show formatted date
    const diff = Math.abs(Date.now() - d.getTime());
    // If within 7 days show relative
    if (diff < 1000 * 60 * 60 * 24 * 7) {
      return formatDistanceToNow(d, { addSuffix: true });
    }
    return formatDateTime(d);
  } catch {
    return String(value);
  }
}
