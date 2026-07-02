/*
 * Deterministic name → accent color mapping, consolidated from middleman's
 * repo-color.ts and agentsview's projectColor.ts. The default palette is the
 * deduped union of both sources; accents beyond kit-ui's core six carry hex
 * fallbacks (agentsview's light values) so the mapping works even where a
 * consuming app doesn't define them.
 */

export const DEFAULT_HASH_PALETTE: readonly string[] = [
  "var(--accent-blue)",
  "var(--accent-amber)",
  "var(--accent-green)",
  "var(--accent-red)",
  "var(--accent-purple)",
  "var(--accent-teal)",
  "var(--accent-rose, #e11d48)",
  "var(--accent-indigo, #6366f1)",
  "var(--accent-orange, #e09040)",
  "var(--accent-sky, #0284c7)",
  "var(--accent-pink, #ec4899)",
  "var(--accent-coral, #f34e3f)",
  "var(--accent-lime, #65a30d)",
];

const FALLBACK = "var(--text-muted)";

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Picks a stable color for a name (repo, project, user, …). The same name
 * always yields the same palette entry. Empty names fall back to
 * `var(--text-muted)`. */
export function hashColor(name: string, palette: readonly string[] = DEFAULT_HASH_PALETTE): string {
  if (!name || palette.length === 0) return FALLBACK;
  return palette[djb2(name) % palette.length]!;
}
