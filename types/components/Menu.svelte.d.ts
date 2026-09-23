import { type Snippet } from "svelte";
import { type MenuAlign } from "./menu.js";
interface Props {
    open?: boolean;
    align?: MenuAlign;
    onopenchange?: (open: boolean) => void;
    class?: string;
    children: Snippet;
}
declare const Menu: import("svelte").Component<Props, {}, "open">;
type Menu = ReturnType<typeof Menu>;
export default Menu;
