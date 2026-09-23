interface Props {
    /** Key glyphs to display, e.g. ["⌘", "K"] or ["Ctrl", "Shift", "P"]. */
    keys: string[];
    /** Separator between keys: "compact" renders them run together (mac
     * style, "⌘K"); "plus" joins with "+" ("Ctrl+K"). */
    joiner?: "compact" | "plus";
    ariaLabel?: string;
}
declare const KbdBadge: import("svelte").Component<Props, {}, "">;
type KbdBadge = ReturnType<typeof KbdBadge>;
export default KbdBadge;
