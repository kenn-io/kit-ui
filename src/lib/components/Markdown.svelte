<script lang="ts">
  import { renderMarkdown, type MarkdownRenderer } from "../utils/markdown.js";

  interface Props {
    /** Markdown source. */
    source: string;
    /** App-configured renderer from `createMarkdownRenderer()` (custom
     * extensions, fence interceptors). Defaults to the plain pipeline. */
    renderer?: MarkdownRenderer;
    class?: string;
  }

  let { source, renderer = undefined, class: className = "" }: Props = $props();

  let html = $state("");

  // Async render: fences highlight once their grammar chunk loads. The
  // previous document stays visible during a re-render (no flash), and a
  // stale resolution never overwrites a newer one.
  $effect(() => {
    const effectSource = source;
    const render = renderer?.render ?? renderMarkdown;
    let cancelled = false;
    void render(effectSource).then(
      (result) => {
        if (!cancelled) html = result;
      },
      (error: unknown) => {
        // Rendering failed outright (not a highlight fallback — those
        // resolve with plain fences). Keep the previous document rather
        // than going blank, but make the failure visible.
        console.error("[kit-ui] markdown render failed", error);
      },
    );
    return () => {
      cancelled = true;
    };
  });
</script>

<div class={["kit-markdown", className]}>
  {@html html}
</div>

<style>
  .kit-markdown {
    font-size: var(--font-size-md);
    line-height: 1.6;
    color: var(--text-primary);
    overflow-wrap: break-word;
  }

  .kit-markdown :global(> :first-child) {
    margin-top: 0;
  }

  .kit-markdown :global(> :last-child) {
    margin-bottom: 0;
  }

  .kit-markdown :global(h1),
  .kit-markdown :global(h2),
  .kit-markdown :global(h3),
  .kit-markdown :global(h4),
  .kit-markdown :global(h5),
  .kit-markdown :global(h6) {
    margin: 1.2em 0 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }

  .kit-markdown :global(h1) {
    font-size: var(--font-size-2xl);
  }

  .kit-markdown :global(h2) {
    font-size: var(--font-size-xl);
  }

  .kit-markdown :global(h3) {
    font-size: var(--font-size-lg);
  }

  .kit-markdown :global(h4),
  .kit-markdown :global(h5),
  .kit-markdown :global(h6) {
    font-size: var(--font-size-md);
  }

  .kit-markdown :global(p),
  .kit-markdown :global(ul),
  .kit-markdown :global(ol),
  .kit-markdown :global(blockquote),
  .kit-markdown :global(table),
  .kit-markdown :global(pre) {
    margin: 0.6em 0;
  }

  .kit-markdown :global(ul),
  .kit-markdown :global(ol) {
    padding-left: 1.6em;
  }

  .kit-markdown :global(li + li) {
    margin-top: 0.2em;
  }

  .kit-markdown :global(a) {
    color: var(--accent-blue);
    text-decoration: none;
  }

  .kit-markdown :global(a:hover) {
    text-decoration: underline;
  }

  .kit-markdown :global(blockquote) {
    padding: 0 0 0 var(--space-5);
    border-left: 3px solid var(--border-default);
    color: var(--text-secondary);
  }

  .kit-markdown :global(hr) {
    margin: 1em 0;
    border: 0;
    border-top: 1px solid var(--border-muted);
  }

  .kit-markdown :global(img) {
    max-width: 100%;
  }

  .kit-markdown :global(table) {
    border-collapse: collapse;
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  .kit-markdown :global(th),
  .kit-markdown :global(td) {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-muted);
    text-align: left;
  }

  .kit-markdown :global(th) {
    font-weight: 600;
    background: var(--bg-inset);
  }

  .kit-markdown :global(code) {
    font-family: var(--font-mono);
    font-size: 0.92em;
  }

  /* Inline code only — fenced code sits inside pre. */
  .kit-markdown :global(:not(pre) > code) {
    padding: 1px var(--space-2);
    background: var(--bg-inset);
    border-radius: var(--radius-sm);
  }

  .kit-markdown :global(pre) {
    padding: var(--space-5) var(--space-6);
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    line-height: 1.55;
    overflow-x: auto;
  }

  /* Dual-theme shiki (see CodeBlock): token colors come from the
   * --shiki-light/--shiki-dark custom properties; the surface stays on
   * kit-ui tokens. */
  .kit-markdown :global(pre.shiki span) {
    color: var(--shiki-light);
    background-color: transparent;
  }

  :global(html.dark) .kit-markdown :global(pre.shiki span) {
    color: var(--shiki-dark);
  }

  .kit-markdown :global(input[type="checkbox"]) {
    margin-right: var(--space-2);
  }
</style>
