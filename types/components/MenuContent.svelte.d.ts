import { type Snippet } from "svelte";
interface Props {
    ariaLabel: string;
    class?: string;
    children: Snippet;
}
declare const MenuContent: import("svelte").Component<Props, {}, "">;
type MenuContent = ReturnType<typeof MenuContent>;
export default MenuContent;
