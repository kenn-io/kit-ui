const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;

/* Formatters are memoized at module scope: every toLocale*String call
 * constructs a fresh Intl.DateTimeFormat (locale resolution + ICU setup),
 * these run per table row, and the browser locale can't change within a
 * page load. Lazy so importing this module stays side-effect free. */
let monthDayFormat: Intl.DateTimeFormat | undefined;
let timestampFormat: Intl.DateTimeFormat | undefined;

/** Formats an ISO timestamp as a human-friendly relative time. */
export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";

  const date = new Date(isoString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < MINUTE) return "just now";
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}m ago`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}h ago`;
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}d ago`;

  monthDayFormat ??= new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return monthDayFormat.format(date);
}

/** Formats an ISO timestamp as a readable date/time string. */
export function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  timestampFormat ??= new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return timestampFormat.format(new Date(isoString));
}

/** Truncates a string with an ellipsis. */
export function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}
