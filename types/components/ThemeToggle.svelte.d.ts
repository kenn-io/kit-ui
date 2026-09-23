interface Props {
    /** "cycle" = one icon button cycling light → dark → system (header
     * chrome); "segmented" = a three-way selector (settings pages). */
    variant?: "cycle" | "segmented";
    size?: "sm" | "md";
    lightLabel?: string;
    darkLabel?: string;
    systemLabel?: string;
    /** aria-label template for the cycle button; `{mode}` and `{nextMode}`
     * are replaced with the current/next mode's labels. Action-oriented by
     * default so users know pressing it changes the theme. */
    cycleLabel?: string;
    /** Group label for the segmented variant's radiogroup. */
    ariaLabel?: string;
    /** Segmented variant only: stretch to the container width. */
    block?: boolean;
    class?: string;
}
declare const ThemeToggle: import("svelte").Component<Props, {}, "">;
type ThemeToggle = ReturnType<typeof ThemeToggle>;
export default ThemeToggle;
