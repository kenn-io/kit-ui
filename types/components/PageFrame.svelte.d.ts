import type { Snippet } from "svelte";
interface Props {
    title: string;
    description?: string;
    brandName?: string;
    logoSrc?: string;
    logoAlt?: string;
    headingId?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
}
declare const PageFrame: import("svelte").Component<Props, {}, "">;
type PageFrame = ReturnType<typeof PageFrame>;
export default PageFrame;
