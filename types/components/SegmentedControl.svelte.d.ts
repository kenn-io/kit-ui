export type SegmentedControlTone = "info" | "success" | "warning" | "danger";
export interface SegmentedControlOption {
    value: string;
    label: string;
    title?: string;
    disabled?: boolean;
    /** Per-segment semantic accent. In the borderless variant a toned
     * segment tints its ink and border even while inactive; when active
     * it takes the full tone band. Untoned segments keep the default
     * accent when active. */
    tone?: SegmentedControlTone;
}
import type { Snippet } from "svelte";
interface Props {
    options: SegmentedControlOption[];
    value: string;
    onchange: (value: string) => void;
    /** Accessible name for the group. */
    ariaLabel?: string;
    /** Custom segment content (icons, counts, icon+text) rendered in
     * place of the label text. `option.label` stays the accessible name
     * — it becomes the button's aria-label — so icon-only segments keep
     * a readable name for assistive tech. */
    segment?: Snippet<[SegmentedControlOption, boolean]>;
    /** Stretch to the container width, segments sharing space equally. */
    block?: boolean;
    /** boxed (default): inset pad with a floating surface pill.
     * borderless: flat strip of flush segments, the active one tinted
     * with the accent. Segments draw their own borders, so the border
     * around the active segment takes the accent-tinted color (the Modal
     * tone-border fixup) instead of a uniform outer line fighting the
     * selection. */
    variant?: "boxed" | "borderless";
    disabled?: boolean;
    class?: string;
}
declare const SegmentedControl: import("svelte").Component<Props, {}, "">;
type SegmentedControl = ReturnType<typeof SegmentedControl>;
export default SegmentedControl;
