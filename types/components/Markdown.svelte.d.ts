import { type MarkdownRenderer } from "../utils/markdown.js";
interface Props {
    /** Markdown source. */
    source: string;
    /** App-configured renderer from `createMarkdownRenderer()` (custom
     * extensions, fence interceptors). Defaults to the plain pipeline. */
    renderer?: MarkdownRenderer;
    class?: string;
}
declare const Markdown: import("svelte").Component<Props, {}, "">;
type Markdown = ReturnType<typeof Markdown>;
export default Markdown;
