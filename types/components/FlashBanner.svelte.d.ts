import { type FlashTone } from "../stores/flash.svelte.js";
interface Props {
    /** Distance from the top of the viewport, e.g. below an app header. */
    top?: string;
    /** Screen-reader severity prefixes per tone — tone must not be
     * color-only, so for semantic tones an empty override falls back to
     * the English default rather than suppressing the prefix. Only
     * `neutral` (no tone signal to convey) stays prefix-less. */
    toneLabels?: Partial<Record<FlashTone, string>>;
}
declare const FlashBanner: import("svelte").Component<Props, {}, "">;
type FlashBanner = ReturnType<typeof FlashBanner>;
export default FlashBanner;
