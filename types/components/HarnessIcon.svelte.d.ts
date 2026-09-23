import { type HarnessIconId } from "./harness-icon.js";
interface Props {
    harness: HarnessIconId;
    /** Accessible name; defaults to the harness brand name. */
    label?: string;
    /** Hide from assistive tech when adjacent text already names the harness. */
    decorative?: boolean;
    /** Icon size in px; every glyph is square. */
    size?: number;
    class?: string;
}
declare const HarnessIcon: import("svelte").Component<Props, {}, "">;
type HarnessIcon = ReturnType<typeof HarnessIcon>;
export default HarnessIcon;
