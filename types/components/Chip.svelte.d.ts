export type ChipSize = "xs" | "sm" | "md";
export type ChipTone = "muted" | "neutral" | "success" | "warning" | "danger" | "info" | "merged" | "canceled" | "workspace";
import type { Snippet } from "svelte";
interface Props {
    size?: ChipSize;
    tone?: ChipTone;
    dot?: boolean;
    interactive?: boolean;
    uppercase?: boolean;
    title?: string | undefined;
    style?: string | undefined;
    expanded?: boolean | undefined;
    disabled?: boolean;
    class?: string;
    ariaLabel?: string | undefined;
    dataTestid?: string | undefined;
    onclick?: ((event: MouseEvent) => void) | undefined;
    children?: Snippet | undefined;
    trailing?: Snippet | undefined;
}
declare const Chip: import("svelte").Component<Props, {}, "">;
type Chip = ReturnType<typeof Chip>;
export default Chip;
