<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import IconButton from "./IconButton.svelte";
  import SplitResizeHandle from "./SplitResizeHandle.svelte";
  import type { SplitResizeEvent } from "./split-resize.js";

  interface Props {
    open: boolean;
    onclose: () => void;
    ariaLabel: string;
    initialHeight?: string;
    minHeight?: string;
    maxHeight?: string;
    keyboardStep?: number;
    closable?: boolean;
    closeTitle?: string;
    closeAriaLabel?: string;
    class?: string;
    header?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  }

  let {
    open,
    onclose,
    ariaLabel,
    initialHeight = "50vh",
    minHeight = "200px",
    maxHeight = "80vh",
    keyboardStep = 24,
    closable = true,
    closeTitle = "Close panel",
    closeAriaLabel = "Close panel",
    class: className = "",
    header,
    children,
    footer,
  }: Props = $props();

  let requestedHeight = $derived(initialHeight);
  let measuredHeight = $state<number | undefined>();
  let startHeight = 0;

  const observeHeight: Attachment<HTMLElement> = (element) => {
    const update = () => {
      measuredHeight = Math.round(element.getBoundingClientRect().height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  };

  function handleResizeStart(): void {
    startHeight = measuredHeight ?? 0;
  }

  function handleResize(event: SplitResizeEvent): void {
    requestedHeight = `${Math.max(0, startHeight - event.delta)}px`;
  }
</script>

{#if open}
  <section
    class={["kit-bottom-dock", className].filter(Boolean).join(" ")}
    aria-label={ariaLabel}
    style:height={requestedHeight}
    style:min-height={minHeight}
    style:max-height={maxHeight}
    {@attach observeHeight}
  >
    <SplitResizeHandle
      {ariaLabel}
      orientation="vertical"
      {keyboardStep}
      ariaValueNow={measuredHeight}
      onResizeStart={handleResizeStart}
      onResize={handleResize}
      onResizeEnd={handleResize}
    />

    {#if header || closable}
      <div class="kit-bottom-dock__header">
        <div class="kit-bottom-dock__header-content">
          {#if header}
            {@render header()}
          {/if}
        </div>
        {#if closable}
          <IconButton size="sm" title={closeTitle} ariaLabel={closeAriaLabel} onclick={onclose}>
            <XIcon size="14" strokeWidth="2" aria-hidden="true" />
          </IconButton>
        {/if}
      </div>
    {/if}

    <div class="kit-bottom-dock__body">
      {#if children}
        {@render children()}
      {/if}
    </div>

    {#if footer}
      <div class="kit-bottom-dock__footer">
        {@render footer()}
      </div>
    {/if}
  </section>
{/if}

<style>
  .kit-bottom-dock {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
  }

  .kit-bottom-dock__header {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-bottom: var(--border-width) solid var(--border-muted);
    flex-shrink: 0;
  }

  .kit-bottom-dock__header-content {
    flex: 1;
    min-width: 0;
  }

  .kit-bottom-dock__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .kit-bottom-dock__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border-top: var(--border-width) solid var(--border-muted);
    flex-shrink: 0;
  }
</style>
