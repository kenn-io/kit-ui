const DASH = "—";

/** Formats a millisecond duration as a compact string
 * (e.g. "450ms", "4.0s", "2m 30s", "1h 15m"). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return DASH;
  if (ms < 1_000) return `${Math.trunc(ms)}ms`;
  // Floor to one decimal so values just shy of a minute (e.g. 59_999ms)
  // can't round up to "60.0s" and read like a full minute. toFixed(1)
  // keeps the trailing zero for round seconds (e.g. 4_000 → "4.0s").
  if (ms < 60_000) return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

/* Memoized at module scope: n.toLocaleString() constructs a fresh
 * Intl.NumberFormat per call and this runs per table cell. Lazy so
 * importing this module stays side-effect free. */
let numberFormat: Intl.NumberFormat | undefined;

/** Formats a number with locale thousands separators (e.g. "1,234,567"). */
export function formatNumber(n: number): string {
  numberFormat ??= new Intl.NumberFormat(undefined);
  return numberFormat.format(n);
}

const COMPACT_COUNT_THRESHOLD = 1_000;

interface CountFormats {
  standard: Intl.NumberFormat;
  compact: Intl.NumberFormat;
}

/* One pair of formatters per locale, built on first use; counts render per
 * table cell, and building an Intl.NumberFormat is the expensive part. */
const countFormats = new Map<string, CountFormats>();

/** Formats a count or token total in one shape for a whole app: below 1,000
 * the plain number ("516"), from 1,000 the compact form with exactly one
 * decimal ("7.9K", "18.0K", "1.0M"). The fixed decimal keeps a column of
 * counts aligned, and a column never mixes full and compact forms.
 * `locale` defaults to the browser's; pass the app language to follow it. */
export function formatCount(value: number, locale?: string): string {
  const key = locale ?? "";
  let formats = countFormats.get(key);
  if (!formats) {
    formats = {
      standard: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      compact: new Intl.NumberFormat(locale, {
        notation: "compact",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    };
    countFormats.set(key, formats);
  }
  return Math.abs(value) < COMPACT_COUNT_THRESHOLD
    ? formats.standard.format(value)
    : formats.compact.format(value);
}

/** Formats a token count as a compact string (e.g. "850", "1.2k", "3.5M"). */
export function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = Math.floor(n / 100) / 10;
    return k % 1 === 0 ? `${Math.floor(k)}k` : `${k}k`;
  }
  const m = Math.floor(n / 100_000) / 10;
  return m % 1 === 0 ? `${Math.floor(m)}M` : `${m}M`;
}

/** Formats a USD cost as a compact string
 * (e.g. "<$0.01", "$0.42", "$12.34", "$123"). */
export function formatCost(v: number): string {
  if (v > 0 && v < 0.01) return "<$0.01";
  if (v >= 100) return `$${v.toFixed(0)}`;
  return `$${v.toFixed(2)}`;
}

/** One or two uppercase initials for a person or account name, for an avatar
 * without a picture. Uses the first letter or digit of the first two words;
 * an email address uses its local part, so "jane.doe@example.com" gives "JD".
 * A name with no letters or digits gives its first character, and an empty
 * name gives "?". */
export function formatInitials(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") return "?";
  const at = trimmed.indexOf("@");
  const base = at > 0 ? trimmed.slice(0, at) : trimmed;
  const letters = base
    .split(/[\s._-]+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((char): char is string => char !== undefined);
  if (letters.length === 0) return [...trimmed][0]!.toUpperCase();
  return letters.slice(0, 2).join("").toUpperCase();
}
