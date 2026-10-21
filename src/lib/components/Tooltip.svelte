<script lang="ts">
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { TABBABLE_SELECTOR } from "../utils/focus-trap.js";
  import { autoReposition } from "../utils/popover.js";
  import { floatingPopoverPosition } from "./floatingPosition.js";

  interface Props {
    /** Simple text tooltip; for rich content use the `content` snippet. */
    text?: string;
    content?: Snippet;
    /** The trigger the tooltip describes. */
    children: Snippet;
    /** Add tabindex so a non-interactive trigger (plain text/icon) is
     * keyboard-reachable. Leave false when the child is already focusable
     * (button, link, input). */
    focusable?: boolean;
    /** Horizontal placement against the trigger. `center` (default) puts
     * the bubble straight under or over it. The arrow always points at the
     * trigger's center, even when the viewport edge pushes the bubble aside. */
    align?: "start" | "center" | "end";
    openDelayMs?: number;
    closeDelayMs?: number;
    /** Extra classes on the popover panel. */
    class?: string;
  }

  let {
    text = undefined,
    content = undefined,
    children,
    focusable = false,
    align = "center",
    openDelayMs = 250,
    closeDelayMs = 100,
    class: className = "",
  }: Props = $props();

  const tooltipID = $props.id();
  const ARROW_INSET = 12;

  let open = $state(false);
  let side = $state<"top" | "bottom">("bottom");
  let popoverStyle = $state("");
  let triggerEl = $state<HTMLSpanElement>();
  let popoverEl = $state<HTMLDivElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function position(): Promise<void> {
    await tick();
    if (!triggerEl || !popoverEl) return;
    const trigger = triggerEl.getBoundingClientRect();
    const width = popoverEl.offsetWidth;
    const { left, top } = floatingPopoverPosition({
      trigger,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      popoverWidth: width,
      popoverHeight: popoverEl.offsetHeight,
      align,
      triggerGap: 8,
    });
    // Keep the arrow clear of the bubble's rounded corners.
    const arrowX = Math.min(
      Math.max((trigger.left + trigger.right) / 2 - left, ARROW_INSET),
      width - ARROW_INSET,
    );
    popoverStyle = `left: ${left}px; top: ${top}px; --kit-tooltip-arrow-x: ${arrowX}px`;
    side = top < trigger.top ? "top" : "bottom";
  }

  function show(immediate = false): void {
    clearTimer();
    if (open) return;
    if (immediate || openDelayMs <= 0) {
      open = true;
      void position();
      return;
    }
    timer = setTimeout(() => {
      open = true;
      void position();
    }, openDelayMs);
  }

  function hide(immediate = false): void {
    clearTimer();
    if (!open) return;
    if (immediate || closeDelayMs <= 0) {
      open = false;
      return;
    }
    timer = setTimeout(() => {
      open = false;
    }, closeDelayMs);
  }

  // The description belongs on the element that takes focus: the wrapped
  // control, or the wrapper itself when `focusable` makes it the stop.
  $effect(() => {
    if (!open || !triggerEl) return;
    const target =
      (focusable ? null : triggerEl.querySelector<HTMLElement>(TABBABLE_SELECTOR)) ?? triggerEl;
    const ids = (target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
    target.setAttribute("aria-describedby", [...ids, tooltipID].join(" "));
    return () => {
      const rest = (target.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id !== "" && id !== tooltipID);
      if (rest.length > 0) target.setAttribute("aria-describedby", rest.join(" "));
      else target.removeAttribute("aria-describedby");
    };
  });

  $effect(() => {
    if (!open) return;

    // No outside-dismiss — tooltips close by leaving the trigger; Escape
    // and the show/hide timers stay tooltip-specific.
    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") hide(true);
    }

    // Dynamic tooltip content resizes the bubble — reposition.
    const stopRepositioning = autoReposition(
      () => [popoverEl, triggerEl],
      () => void position(),
    );

    document.addEventListener("keydown", handleKeydown);
    return () => {
      stopRepositioning();
      document.removeEventListener("keydown", handleKeydown);
      clearTimer();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<!-- WAI-ARIA tooltip pattern: the wrapper is not itself interactive — it only
     mirrors hover/focus of the described content, and `focusable` adds
     tabindex precisely when the wrapped child has no focusable element. -->
<span
  class="kit-tooltip-trigger"
  bind:this={triggerEl}
  tabindex={focusable ? 0 : undefined}
  onmouseenter={() => show()}
  onmouseleave={() => hide()}
  onfocusin={() => show(true)}
  onfocusout={() => hide(true)}
>
  {@render children()}
</span>

{#if open}
  <div
    id={tooltipID}
    class={["kit-tooltip", "kit-popover-card", className]}
    role="tooltip"
    data-side={side}
    style={popoverStyle}
    bind:this={popoverEl}
    onmouseenter={() => show(true)}
    onmouseleave={() => hide()}
  >
    {#if content}
      {@render content()}
    {:else if text}
      {text}
    {/if}
  </div>
{/if}

<style>
  .kit-tooltip-trigger {
    display: inline-flex;
    min-width: 0;
    vertical-align: middle;
  }

  .kit-tooltip-trigger:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .kit-tooltip {
    position: fixed;
    z-index: var(--z-tooltip);
    width: max-content;
    max-width: min(280px, calc(100vw - 32px));
    padding: var(--space-4) var(--space-5);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.45;
  }

  /* Arrow — mirrors the DiffSummaryChip precedent; flips with data-side
     and points at the trigger's center (--kit-tooltip-arrow-x). */
  .kit-tooltip::before {
    content: "";
    position: absolute;
    left: calc(var(--kit-tooltip-arrow-x, 50%) - 4px);
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
    background: var(--bg-surface);
  }

  .kit-tooltip[data-side="bottom"]::before {
    top: -5px;
    border-left: 1px solid var(--border-default);
    border-top: 1px solid var(--border-default);
  }

  .kit-tooltip[data-side="top"]::before {
    bottom: -5px;
    border-right: 1px solid var(--border-default);
    border-bottom: 1px solid var(--border-default);
  }

  /* Touch devices have no hover; tooltips still appear on focus. */
</style>
