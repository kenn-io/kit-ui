<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import { copyToClipboard } from "../utils/clipboard.js";

  interface Props {
    /** When provided, the button copies this text itself and manages the
     * copied indicator. Omit it (and pass `copied` + `onclick`) to control
     * the copy behavior from the parent. */
    text?: string;
    copied?: boolean;
    ariaLabel?: string;
    copiedAriaLabel?: string;
    title?: string;
    copiedTitle?: string;
    /** Hide until the parent is hovered (requires the parent to reveal
     * `.kit-copy-btn` on hover); default false — always visible. */
    revealOnHover?: boolean;
    onclick?: (event: MouseEvent) => void | Promise<void>;
    class?: string;
  }

  let {
    text = undefined,
    copied = false,
    ariaLabel = "Copy",
    copiedAriaLabel = "Copied",
    title = "Copy",
    copiedTitle = "Copied",
    revealOnHover = false,
    onclick = undefined,
    class: className = "",
  }: Props = $props();

  let internalCopied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const showCopied = $derived(text !== undefined ? internalCopied : copied);

  async function handleClick(event: MouseEvent): Promise<void> {
    if (text !== undefined) {
      const ok = await copyToClipboard(text);
      if (ok) {
        internalCopied = true;
        if (resetTimer !== undefined) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          internalCopied = false;
        }, 1500);
      }
    }
    await onclick?.(event);
  }
</script>

<button
  type="button"
  class={["kit-copy-btn", { "kit-copy-btn--reveal": revealOnHover }, className]}
  aria-label={showCopied ? copiedAriaLabel : ariaLabel}
  title={showCopied ? copiedTitle : title}
  onclick={handleClick}
>
  {#if showCopied}
    <CheckIcon size="14" strokeWidth="2.4" aria-hidden="true" />
  {:else}
    <CopyIcon size="14" strokeWidth="2" aria-hidden="true" />
  {/if}
</button>

<style>
  .kit-copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm, 4px);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition:
      opacity var(--transition-fast),
      background var(--transition-fast),
      color var(--transition-fast);
    flex-shrink: 0;
  }

  .kit-copy-btn--reveal {
    opacity: 0;
  }

  .kit-copy-btn--reveal:focus-visible {
    opacity: 1;
  }

  @media (hover: none) {
    .kit-copy-btn--reveal {
      opacity: 1;
    }
  }

  .kit-copy-btn:hover {
    background: var(--bg-surface-hover);
    color: var(--text-secondary);
  }

  .kit-copy-btn:active {
    transform: scale(0.92);
  }
</style>
