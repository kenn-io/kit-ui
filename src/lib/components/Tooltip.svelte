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
  // The element that took keyboard focus inside the trigger, if any.
  let focusTarget = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A press on the trigger means the control is in use, often opening
  // a menu or list the bubble would cover. Keep the tooltip shut until the
  // pointer leaves or focus moves on.
  let pressed = false;

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

  function describedIDs(target: HTMLElement): string[] {
    return (target.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  }

  function addDescription(target: HTMLElement): void {
    const ids = describedIDs(target);
    if (!ids.includes(tooltipID)) {
      target.setAttribute("aria-describedby", [...ids, tooltipID].join(" "));
    }
  }

  function removeDescription(target: HTMLElement): void {
    const rest = describedIDs(target).filter((id) => id !== tooltipID);
    if (rest.length > 0) target.setAttribute("aria-describedby", rest.join(" "));
    else target.removeAttribute("aria-describedby");
  }

  function handleFocusIn(event: FocusEvent): void {
    const target = focusable ? triggerEl : event.target;
    if (pressed) {
      if (target instanceof HTMLElement) focusTarget = target;
      return;
    }
    if (target instanceof HTMLElement) {
      focusTarget = target;
      // Before assistive technology hears about the focus, not after the
      // next render.
      addDescription(target);
    }
    show(true);
  }

  function handleFocusOut(event: FocusEvent): void {
    focusTarget = null;
    // Clicking from one wrapped control to another keeps the press's hide.
    const next = event.relatedTarget;
    if (!(next instanceof Node && triggerEl?.contains(next))) pressed = false;
    hide(true);
  }

  function handlePointerDown(): void {
    pressed = true;
    hide(true);
  }

  function handleMouseLeave(): void {
    pressed = false;
    hide();
  }

  // The description belongs on the element that has focus. A hover-opened
  // tooltip describes the first control it wraps, or the wrapper itself when
  // `focusable` makes it the tab stop.
  $effect(() => {
    if (!open || !triggerEl) return;
    const target =
      focusTarget ??
      (focusable ? null : triggerEl.querySelector<HTMLElement>(TABBABLE_SELECTOR)) ??
      triggerEl;
    addDescription(target);
    // A wrapped control that rewrites its own aria-describedby, such as a
    // field showing a validation message, would otherwise drop the id.
    const observer = new MutationObserver(() => addDescription(target));
    observer.observe(target, { attributes: true, attributeFilter: ["aria-describedby"] });
    return () => {
      observer.disconnect();
      removeDescription(target);
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
  onmouseleave={handleMouseLeave}
  onpointerdown={handlePointerDown}
  onfocusin={handleFocusIn}
  onfocusout={handleFocusOut}
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
