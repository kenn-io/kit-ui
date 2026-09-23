/** Formats a millisecond duration as a compact string
 * (e.g. "450ms", "4.0s", "2m 30s", "1h 15m"). */
export declare function formatDuration(ms: number): string;
/** Formats a number with locale thousands separators (e.g. "1,234,567"). */
export declare function formatNumber(n: number): string;
/** Formats a token count as a compact string (e.g. "850", "1.2k", "3.5M"). */
export declare function formatTokenCount(n: number): string;
/** Formats a USD cost as a compact string
 * (e.g. "<$0.01", "$0.42", "$12.34", "$123"). */
export declare function formatCost(v: number): string;
