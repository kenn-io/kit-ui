interface Props {
    /** Key glyphs to display, e.g. ["⌘", "K"] or ["Ctrl", "Shift", "P"]. */
    keys: string[];
    /** "keys" gives each key its own cap; "compact" runs glyphs together
     * ("⌘K"); "plus" joins with "+" ("Ctrl+K"). */
    joiner?: "keys" | "compact" | "plus";
    ariaLabel?: string;
}
declare const KbdBadge: import("svelte").Component<Props, {}, "">;
type KbdBadge = ReturnType<typeof KbdBadge>;
export default KbdBadge;
