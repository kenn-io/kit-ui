import { type Snippet } from "svelte";
import { type MenuAlign, type MenuAnchorPoint } from "./menu.js";
interface Props {
    open?: boolean;
    align?: MenuAlign;
    /** Opens the content at a viewport point instead of below a trigger (context menus). */
    anchor?: MenuAnchorPoint | undefined;
    /** Receives focus when a trigger-less menu closes, such as the right-clicked row. */
    returnFocus?: HTMLElement | undefined;
    onopenchange?: (open: boolean) => void;
    class?: string;
    children: Snippet;
}
declare const Menu: import("svelte").Component<Props, {}, "open">;
type Menu = ReturnType<typeof Menu>;
export default Menu;
