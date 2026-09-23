interface Props {
    code: string;
    /** Fence language ("ts", "python") — omitted/unknown renders plain. */
    language?: string;
    /** Header label; defaults to the language. Set to show a filename. */
    title?: string;
    /** Render a line-number gutter. */
    lineNumbers?: boolean;
    /** Initial soft-wrap state (bindable — the header button toggles it). */
    wrap?: boolean;
    /** Hide the wrap toggle (wrap still applies as a static prop). */
    wrapToggle?: boolean;
    /** Hide the copy button. */
    copyable?: boolean;
    /** Cap the body height (scrolls beyond), e.g. "320px". */
    maxHeight?: string;
    copyLabel?: string;
    wrapLabel?: string;
    class?: string;
}
declare const CodeBlock: import("svelte").Component<Props, {}, "wrap">;
type CodeBlock = ReturnType<typeof CodeBlock>;
export default CodeBlock;
