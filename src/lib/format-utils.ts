/**
 * Centralized Date/Time Formatting Utilities
 *
 * This module provides standardized formatting functions for dates, times,
 * and durations across the application to ensure consistency and DRY code.
 */

// =============================================================================
// Time Formatting (for video timestamps)
// =============================================================================

/**
 * Format seconds to a time string (MM:SS or HH:MM:SS)
 * Used for video timestamps and progress display
 *
 * @example
 * formatTime(65) // "01:05"
 * formatTime(3665) // "01:01:05"
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds to a precise time string with milliseconds (MM:SS.mmm)
 * Used for transcript editing and precise timing
 *
 * @example
 * formatTimePrecise(65.123) // "01:05.123"
 */
export function formatTimePrecise(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.000";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

// =============================================================================
// Duration Formatting
// =============================================================================

/**
 * Format seconds to a duration string (HH:MM:SS or MM:SS)
 * Used for video duration display in metadata
 *
 * @example
 * formatDuration(3665) // "1:01:05"
 * formatDuration(65) // "1:05"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format minutes to a human-readable duration string
 * Used for meeting/recording durations
 *
 * @example
 * formatDurationHuman(90) // "1h 30m"
 * formatDurationHuman(45) // "45 min"
 */
export function formatDurationHuman(minutes: number | null | undefined): string {
  if (!minutes) return "Unknown duration";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format seconds to a human-readable duration string
 * Used when the input is in seconds but needs human-readable output
 *
 * @example
 * formatDurationFromSeconds(5400) // "1h 30m"
 */
export function formatDurationFromSeconds(seconds: number | null | undefined): string {
  if (!seconds) return "Unknown duration";
  const totalMinutes = Math.round(seconds / 60);
  return formatDurationHuman(totalMinutes);
}

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Format a date to a localized date string
 * Used for displaying dates in settings, API keys, etc.
 *
 * @example
 * formatDate(new Date()) // "Dec 31, 2024"
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Never";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Invalid date";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date to a full date-time string
 *
 * @example
 * formatDateTime(new Date()) // "Dec 31, 2024, 11:30 AM"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "Never";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Invalid date";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format a date to a relative time string
 * Used for timestamps like "2 days ago", "Today", etc.
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 86400000)) // "Yesterday"
 * formatRelativeTime(new Date(Date.now() - 86400000 * 3)) // "3 days ago"
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);

  if (days < 0) return "In the future";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

// =============================================================================
// Number Formatting
// =============================================================================

/**
 * Format a number to a compact string with K/M/B suffixes
 * Used for view counts, subscriber counts, etc.
 *
 * @example
 * formatCompactNumber(1500) // "1.5K"
 * formatCompactNumber(2500000) // "2.5M"
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

/**
 * Format bytes to a human-readable file size
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
