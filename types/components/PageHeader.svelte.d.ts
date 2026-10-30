import type { Snippet } from "svelte";
interface Props {
    /** Heading text, or a snippet for a title with markup such as inline code or an edit field. */
    title: string | Snippet;
    /** Muted line under the title, as text or a snippet with markup. */
    description?: string | Snippet;
    /** Heading level of the title. Pages use 1; a header inside a pane can use 2 or 3. */
    level?: 1 | 2 | 3;
    /** Title size, independent of the heading level. */
    size?: "large" | "medium" | "small";
    /** Lets the title take focus from script, for moving focus to it after a view change. */
    focusable?: boolean;
    /** The rendered heading element. */
    titleElement?: HTMLHeadingElement | undefined;
    /** Rendered above the title, typically a back link or breadcrumbs. */
    before?: Snippet;
    /** Beside the title on its line, typically a status chip or label. */
    trailing?: Snippet;
    /** Trailing controls or status, aligned with the bottom of the title block. */
    actions?: Snippet;
}
declare const PageHeader: import("svelte").Component<Props, {}, "titleElement">;
type PageHeader = ReturnType<typeof PageHeader>;
export default PageHeader;
