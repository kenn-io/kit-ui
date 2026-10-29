import type { Snippet } from "svelte";
interface Props {
    title: string;
    /** Muted line under the title. */
    description?: string;
    /** Heading level of the title. Pages use 1; a header inside a pane can use 2 or 3. */
    level?: 1 | 2 | 3;
    /** Rendered above the title, typically a back link or breadcrumbs. */
    before?: Snippet;
    /** Trailing controls or status, aligned with the bottom of the title block. */
    actions?: Snippet;
}
declare const PageHeader: import("svelte").Component<Props, {}, "">;
type PageHeader = ReturnType<typeof PageHeader>;
export default PageHeader;
