export type SidebarToggleState = "expanded" | "collapsed";
import type { ClassValue } from "svelte/elements";
interface Props {
    state?: SidebarToggleState;
    /** What is being toggled, for the accessible label ("Collapse sidebar"). */
    label?: string;
    onclick?: ((event: MouseEvent) => void) | undefined;
    class?: ClassValue;
}
declare const SidebarToggle: import("svelte").Component<Props, {}, "">;
type SidebarToggle = ReturnType<typeof SidebarToggle>;
export default SidebarToggle;
