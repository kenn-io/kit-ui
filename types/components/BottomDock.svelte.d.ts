import type { Snippet } from "svelte";
interface Props {
    open: boolean;
    onclose: () => void;
    ariaLabel: string;
    initialHeight?: string;
    height?: string;
    onHeightChange?: (height: string) => void;
    minHeight?: string;
    maxHeight?: string;
    keyboardStep?: number;
    closable?: boolean;
    closeTitle?: string;
    closeAriaLabel?: string;
    class?: string;
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
}
declare const BottomDock: import("svelte").Component<Props, {}, "">;
type BottomDock = ReturnType<typeof BottomDock>;
export default BottomDock;
