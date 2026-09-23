/** Compact diff counts: 999 → "999", 12345 → "12.3k", 2_000_000 → "2M". */
export declare function formatDiffStat(value: number): string;
interface Props {
    additions: number;
    deletions: number;
    /** Fade a side when it's zero. */
    dimZeros?: boolean;
}
declare const DiffStats: import("svelte").Component<Props, {}, "">;
type DiffStats = ReturnType<typeof DiffStats>;
export default DiffStats;
