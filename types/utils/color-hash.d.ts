export declare const DEFAULT_HASH_PALETTE: readonly string[];
/** The stable slot `hashColor` picks for a name in a palette of `length`. */
export declare function hashIndex(name: string, length: number): number;
/** Picks a stable color for a name (repo, project, user, …). The same name
 * always yields the same palette entry. Empty names fall back to
 * `var(--text-muted)`. */
export declare function hashColor(name: string, palette?: readonly string[]): string;
