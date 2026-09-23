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
}
interface Props {
    /** Whether the palette is showing (bindable). */
    open?: boolean;
    commands: PaletteCommand[];
    /** Run a command (the palette closes first). */
    onrun: (command: PaletteCommand) => void;
    /** Ids shown under `recentLabel` while the query is empty. */
    recentIds?: string[];
    placeholder?: string;
    emptyLabel?: string;
    recentLabel?: string;
    ariaLabel?: string;
    class?: string;
}
declare const CommandPalette: import("svelte").Component<Props, {}, "open">;
type CommandPalette = ReturnType<typeof CommandPalette>;
export default CommandPalette;
