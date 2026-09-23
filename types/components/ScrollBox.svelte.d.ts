import type { Snippet } from "svelte";
import type { ClassValue, HTMLAttributes } from "svelte/elements";
interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class" | "onscroll"> {
    class?: ClassValue;
    dataTest?: string | undefined;
    label: string;
    onscroll?: ((event: Event) => void) | undefined;
    viewport?: HTMLDivElement | undefined;
    children: Snippet;
}
declare const ScrollBox: import("svelte").Component<Props, {}, "viewport">;
type ScrollBox = ReturnType<typeof ScrollBox>;
export default ScrollBox;
