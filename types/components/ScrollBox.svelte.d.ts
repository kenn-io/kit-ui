import type { Snippet } from "svelte";
import type { ClassValue, HTMLAttributes } from "svelte/elements";
import { type OverlayScrollbarAxis, type OverlayScrollbarInset, type OverlayScrollbarVisibility } from "../utils/overlay-scrollbars.js";
interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class" | "onscroll"> {
    class?: ClassValue;
    dataTest?: string | undefined;
    label: string;
    /** Which axes scroll and render overlay thumbs. Default `"y"`. */
    axis?: OverlayScrollbarAxis;
    /** When overlay thumbs appear: `"auto"` (hover/scroll/drag), `"always"`, or `"never"`. */
    visibility?: OverlayScrollbarVisibility;
    /** Top inset for the vertical thumb (e.g. below a sticky header). */
    insetTop?: OverlayScrollbarInset;
    /** Bottom inset for the vertical thumb. */
    insetBottom?: OverlayScrollbarInset;
    /** Left inset for the horizontal thumb. */
    insetLeft?: OverlayScrollbarInset;
    /** Right inset for the horizontal thumb. */
    insetRight?: OverlayScrollbarInset;
    /** Corner clearance in px, or `"auto"` to follow computed border radii. */
    cornerRadius?: number | "auto";
    onscroll?: ((event: Event) => void) | undefined;
    viewport?: HTMLDivElement | undefined;
    children: Snippet;
}
declare const ScrollBox: import("svelte").Component<Props, {}, "viewport">;
type ScrollBox = ReturnType<typeof ScrollBox>;
export default ScrollBox;
