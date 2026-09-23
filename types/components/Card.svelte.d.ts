import type { ChipTone } from "./Chip.svelte";
export type CardLevel = "inset" | "default" | "raised";
export type CardPadding = "none" | "sm" | "md";
export type CardTone = ChipTone;
import type { Snippet } from "svelte";
interface Props {
    /** Hierarchy level: `inset` (well inside another surface), `default`
     * (list tiles, timeline cards), `raised` (page-level panel). */
    level?: CardLevel;
    padding?: CardPadding;
    /** Uppercase mini-label above/beside the title (e.g. an event type). */
    eyebrow?: string | undefined;
    /** Accent for the eyebrow, using the Chip tone vocabulary. */
    eyebrowTone?: CardTone | undefined;
    title?: string | undefined;
    /** Right-aligned muted text in the header row (e.g. a timestamp). */
    meta?: string | undefined;
    /** Renders an <a> instead of a <div>; implies the hover affordance.
     * Mutually exclusive with onclick — if both are passed, href wins. */
    href?: string | undefined;
    /** Renders a <button> instead of a <div>; implies the hover affordance. */
    onclick?: ((event: MouseEvent) => void) | undefined;
    /** For choice-card sets (theme pickers, plan selectors): marks this card
     * as the active choice. Renders aria-pressed on the button variant,
     * aria-current on the anchor variant, and the accent border + tint;
     * on a static card it is visual-only (prefer a clickable variant). */
    selected?: boolean | undefined;
    ariaLabel?: string | undefined;
    class?: string;
    /** Trailing header content — icon buttons, chips. */
    actions?: Snippet;
    children?: Snippet;
    /** Divided from the body by a muted rule. */
    footer?: Snippet;
}
declare const Card: import("svelte").Component<Props, {}, "">;
type Card = ReturnType<typeof Card>;
export default Card;
