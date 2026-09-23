import type { Snippet } from "svelte";
interface Props {
    ariaLabel?: string | undefined;
    class?: string;
    children?: Snippet;
}
declare const Timeline: import("svelte").Component<Props, {}, "">;
type Timeline = ReturnType<typeof Timeline>;
export default Timeline;
