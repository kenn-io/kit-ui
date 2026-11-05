import type { Component } from "svelte";
export interface PaletteCommand {
    id: string;
    label: string;
    /** Group header the command sorts under. */
    section?: string;
    /** Extra match text (synonyms) — searched but not displayed. */
    keywords?: string;
    /** Shortcut combo displayed as a KbdBadge, e.g. "mod+shift+p". */
    combo?: string;
    disabled?: boolean;
    /** Decorative leading icon, rendered at 16px. */
    icon?: Component;
    children?: PaletteLeaf[];
}
export type PaletteLeaf = Omit<PaletteCommand, "children">;
interface Props {
    /** Whether the palette is showing (bindable). */
    open?: boolean;
    commands: PaletteCommand[];
    /** Run a leaf command (the palette closes first). */
    onrun: (command: PaletteCommand, query: string) => void;
    /** Search text used on each open. */
    initialQuery?: string;
    /** Extra commands following all matches for a non-empty query. */
    fallbacks?: (query: string) => PaletteLeaf[];
    /** Ids shown under `recentLabel` while the query is empty. */
    recentIds?: string[];
    placeholder?: string;
    emptyLabel?: string;
    recentLabel?: string;
    navigateLabel?: string;
    runLabel?: string;
    closeLabel?: string;
    ariaLabel?: string;
    class?: string;
}
declare const CommandPalette: Component<Props, {}, "open">;
type CommandPalette = ReturnType<typeof CommandPalette>;
export default CommandPalette;
