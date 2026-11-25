interface Props {
    /** Current search text (bindable). */
    query?: string;
    /** Matches for `query`; only those found so far when `resultsComplete` is `false`. */
    matchCount: number;
    /** Whether `matchCount` is final; when `false` the total shows a trailing `+`. */
    resultsComplete?: boolean;
    /** 0-based index of the current match; displayed 1-based. */
    currentIndex: number;
    /** Advance to the next match (Enter, down button). */
    onnext?: () => void;
    /** Go to the previous match (Shift+Enter, up button). */
    onprev?: () => void;
    /** Dismiss the bar (Escape, close button). */
    onclose?: () => void;
    /** Called with the new query on every keystroke. */
    oninput?: (query: string) => void;
    /** Focus the input when the bar mounts (default true). */
    autofocus?: boolean;
    /** pinned (default): full-width strip flush with the top edge of the
     * find-target container — square corners, bottom border only, no
     * shadow. floating: IDE-style card inset at the container's top-right
     * (the container needs position: relative); this is where the
     * popover shadow treatment lives. */
    variant?: "pinned" | "floating";
    placeholder?: string;
    /** Counter template; `{current}` and `{total}` are replaced. Without
     * `{total}`, an incomplete floor is appended: `Match 1 (3+)`. */
    matchCountLabel?: string;
    /** Spoken counter while results are incomplete; `{count}` is the visible text. */
    partialCountLabel?: string;
    noMatchesLabel?: string;
    ariaLabel?: string;
    inputAriaLabel?: string;
    previousLabel?: string;
    nextLabel?: string;
    closeLabel?: string;
}
declare const FindBar: import("svelte").Component<Props, {}, "query">;
type FindBar = ReturnType<typeof FindBar>;
export default FindBar;
