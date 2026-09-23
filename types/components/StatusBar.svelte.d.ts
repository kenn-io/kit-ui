import type { Snippet } from "svelte";
interface Props {
    left: Snippet;
    center?: Snippet;
    right?: Snippet;
    /** Sections clip their content by default so long text truncates inside
     * the 24px bar. Pass "visible" when a snippet anchors a popover (see the
     * Popovers section in the docs) — overflow management is then the app's
     * responsibility. */
    overflow?: "hidden" | "visible";
}
declare const StatusBar: import("svelte").Component<Props, {}, "">;
type StatusBar = ReturnType<typeof StatusBar>;
export default StatusBar;
