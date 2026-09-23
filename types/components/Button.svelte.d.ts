export type ButtonTone = "neutral" | "success" | "danger" | "info" | "workflow";
export type ButtonSurface = "outline" | "soft" | "solid";
export type ButtonSize = "sm" | "md" | "lg";
import type { Snippet } from "svelte";
interface Props {
    tone?: ButtonTone;
    surface?: ButtonSurface;
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    title?: string | undefined;
    ariaLabel?: string | undefined;
    ariaDescribedby?: string | undefined;
    label?: string;
    shortLabel?: string;
    ariaExpanded?: boolean;
    class?: string;
    onclick?: ((event: MouseEvent) => void) | undefined;
    children?: Snippet;
    trailing?: Snippet;
}
declare const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
export default Button;
