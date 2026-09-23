import { type Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { ClassValue } from "svelte/elements";
interface ChildProps {
    attachment: Attachment<HTMLButtonElement>;
}
interface Props {
    ariaLabel?: string;
    title?: string;
    disabled?: boolean;
    class?: ClassValue;
    children?: Snippet;
    child?: Snippet<[ChildProps]>;
}
declare const MenuTrigger: import("svelte").Component<Props, {}, "">;
type MenuTrigger = ReturnType<typeof MenuTrigger>;
export default MenuTrigger;
