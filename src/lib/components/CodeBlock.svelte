<script lang="ts">
  import WrapTextIcon from "@lucide/svelte/icons/wrap-text";
  import { escapeHtml, highlightCode } from "../utils/markdown.js";
  import CopyButton from "./CopyButton.svelte";
  import IconButton from "./IconButton.svelte";

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

  let {
    code,
    language = undefined,
    title = undefined,
    lineNumbers = false,
    wrap = $bindable(false),
    wrapToggle = true,
    copyable = true,
    maxHeight = undefined,
    copyLabel = "Copy code",
    wrapLabel = "Toggle line wrap",
    class: className = "",
  }: Props = $props();

  let highlighted = $state<string | null>(null);

  // Highlight asynchronously (grammar chunks load on demand); the plain
  // escaped fallback renders immediately and on unknown/over-budget code.
  $effect(() => {
    highlighted = null;
    if (!language) return;
    const effectCode = code;
    const effectLang = language;
    let cancelled = false;
    void highlightCode(effectCode, effectLang).then((html) => {
      if (!cancelled) highlighted = html;
    });
    return () => {
      cancelled = true;
    };
  });

  // Mirror shiki's classic structure (pre > code > span.line per line) so
  // the line-number gutter works identically for plain fallback output.
  const plainHtml = $derived.by(() => {
    const lines = code.split("\n");
    // A fence's trailing newline would render as a spurious empty last line.
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    const body = lines
      .map((line) => `<span class="line">${escapeHtml(line)}</span>`)
      .join("\n");
    return `<pre class="kit-code-block__plain"><code>${body}</code></pre>`;
  });

  const label = $derived(title ?? language);
  const showHeader = $derived(label !== undefined || copyable || wrapToggle);
</script>

<div
  class={["kit-code-block", className]}
  class:kit-code-block--wrap={wrap}
  class:kit-code-block--line-numbers={lineNumbers}
>
  {#if showHeader}
    <div class="kit-code-block__header">
      <span class="kit-code-block__label">{label ?? ""}</span>
      <div class="kit-code-block__actions">
        {#if wrapToggle}
          <IconButton
            size="sm"
            ariaLabel={wrapLabel}
            ariaPressed={wrap}
            onclick={() => (wrap = !wrap)}
          >
            <WrapTextIcon size="14" strokeWidth="2" aria-hidden="true" />
          </IconButton>
        {/if}
        {#if copyable}
          <CopyButton text={code} ariaLabel={copyLabel} title={copyLabel} />
        {/if}
      </div>
    </div>
  {/if}
  <div class="kit-code-block__body" style:max-height={maxHeight}>
    {@html highlighted ?? plainHtml}
  </div>
</div>

<style>
  .kit-code-block {
    background: var(--bg-inset);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .kit-code-block__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-5);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-code-block__label {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kit-code-block__actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .kit-code-block__body {
    overflow: auto;
  }

  .kit-code-block__body :global(pre) {
    margin: 0;
    padding: var(--space-5) var(--space-6);
    background: transparent;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    line-height: 1.55;
    color: var(--text-primary);
  }

  .kit-code-block__body :global(code) {
    font-family: inherit;
    font-size: inherit;
  }

  /* Dual-theme shiki: colors live in --shiki-light/--shiki-dark custom
   * properties (defaultColor: false); the theme class picks the side.
   * The block surface stays on kit-ui tokens, not shiki's theme bg. */
  .kit-code-block__body :global(pre.shiki span) {
    color: var(--shiki-light);
    background-color: transparent;
  }

  :global(html.dark) .kit-code-block__body :global(pre.shiki span) {
    color: var(--shiki-dark);
  }

  .kit-code-block--wrap .kit-code-block__body :global(pre) {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .kit-code-block--line-numbers .kit-code-block__body :global(code) {
    counter-reset: kit-code-line;
  }

  .kit-code-block--line-numbers .kit-code-block__body :global(.line)::before {
    counter-increment: kit-code-line;
    content: counter(kit-code-line);
    display: inline-block;
    width: 2.5em;
    margin-right: var(--space-5);
    text-align: right;
    color: var(--text-muted);
    user-select: none;
  }
</style>
