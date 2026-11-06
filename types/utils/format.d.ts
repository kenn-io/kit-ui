/** Formats a millisecond duration as a compact string
 * (e.g. "450ms", "4.0s", "2m 30s", "1h 15m"). */
export declare function formatDuration(ms: number): string;
/** Formats a number with locale thousands separators (e.g. "1,234,567"). */
export declare function formatNumber(n: number): string;
/** Formats a count or token total in one shape for a whole app: below 1,000
 * the plain number ("516"), from 1,000 the compact form with exactly one
 * decimal ("7.9K", "18.0K", "1.0M"). The fixed decimal keeps a column of
 * counts aligned, and a column never mixes full and compact forms.
 * `locale` defaults to the browser's; pass the app language to follow it. */
export declare function formatCount(value: number, locale?: string): string;
/** Formats a token count as a compact string (e.g. "850", "1.2k", "3.5M"). */
export declare function formatTokenCount(n: number): string;
/** Formats a USD cost as a compact string
 * (e.g. "<$0.01", "$0.42", "$12.34", "$123"). */
export declare function formatCost(v: number): string;
