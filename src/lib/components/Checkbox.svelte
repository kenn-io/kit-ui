<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Checked state (bindable). */
    checked?: boolean;
    /** Tri-state "some children selected" dash (middleman's TreeCheckbox).
     * Purely visual on top of `checked`; the consumer owns clearing it. */
    indeterminate?: boolean;
    disabled?: boolean;
    /** Label text after the box; use `children` for rich label content. */
    label?: string | undefined;
    id?: string;
    name?: string;
    /** Submitted form value when checked (native default "on"). */
    value?: string;
    /** Native constraint validation — the form won't submit unchecked. */
    required?: boolean;
    /** Accessible name when there is no visible label. */
    ariaLabel?: string;
    /** Points at hint/error text elsewhere in the form. */
    ariaDescribedby?: string;
    onchange?: (checked: boolean) => void;
    class?: string;
    children?: Snippet;
  }

  let {
    checked = $bindable(false),
    indeterminate = false,
    disabled = false,
    label = undefined,
    id = undefined,
    name = undefined,
    value = undefined,
    required = false,
    ariaLabel = undefined,
    ariaDescribedby = undefined,
    onchange = undefined,
    class: className = "",
    children,
  }: Props = $props();
</script>

<label class={["kit-checkbox", className]} class:kit-checkbox--disabled={disabled}>
  <input
    class="kit-checkbox__input"
    type="checkbox"
    bind:checked
    {disabled}
    {id}
    {name}
    {value}
    {required}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedby}
    onchange={() => onchange?.(checked)}
    {@attach (el) => {
      // `indeterminate` is a DOM property, not an attribute — sync it so
      // the :indeterminate pseudo-class (which draws the dash) tracks the
      // prop. Attachments re-run when their dependencies change.
      el.indeterminate = indeterminate && !checked;
    }}
  />
  <span class="kit-checkbox__box" aria-hidden="true">
    <svg class="kit-checkbox__glyph kit-checkbox__glyph--check" viewBox="0 0 16 16" fill="none">
      <path d="M4 8.5l2.6 2.6L12 5.4" />
    </svg>
    <svg class="kit-checkbox__glyph kit-checkbox__glyph--dash" viewBox="0 0 16 16" fill="none">
      <path d="M4.5 8h7" />
    </svg>
  </span>
  {#if label !== undefined || children}
    <span class="kit-checkbox__label">
      {#if label !== undefined}{label}{/if}
      {#if children}{@render children()}{/if}
    </span>
  {/if}
</label>

<style>
  .kit-checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    cursor: pointer;
    position: relative;
  }

  .kit-checkbox--disabled {
    cursor: not-allowed;
    opacity: var(--opacity-disabled);
  }

  /* The real input is invisible but stretched over the whole label as
   * the hit target (not pointer-events: none — that would make the drawn
   * box intercept programmatic clicks and break test drivers' hit-target
   * checks). The drawn box carries the focus ring. */
  .kit-checkbox__input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
    z-index: 1;
  }

  /* middleman's TreeCheckbox recipe: 16px box, 1.5px edge, 5px corner.
   * Radius follows the theme but is capped so pebble's 10px --radius-sm
   * can't turn the box into a blob; the border floor keeps the edge
   * readable at this size when a theme thins --border-width. */
  .kit-checkbox__box {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    box-sizing: border-box;
    background: var(--bg-surface);
    border: max(1.5px, var(--border-width)) solid var(--border-default);
    border-radius: min(var(--radius-sm), 5px);
    transition:
      background-color var(--transition-fast) var(--transition-ease, ease),
      border-color var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-checkbox:hover .kit-checkbox__input:not(:disabled) + .kit-checkbox__box {
    border-color: var(--accent-blue);
  }

  .kit-checkbox:active .kit-checkbox__input:not(:disabled) + .kit-checkbox__box {
    transform: var(--press-transform);
  }

  .kit-checkbox__input:checked + .kit-checkbox__box,
  .kit-checkbox__input:indeterminate + .kit-checkbox__box {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
  }

  .kit-checkbox__input:focus-visible + .kit-checkbox__box {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  /* Delegated-focus exception to the global ring rule: the real input is
   * invisible (its own outline dies with opacity: 0), so the drawn box
   * carries the ring — and must also mirror the high-contrast widening
   * that :root.high-contrast applies to :focus-visible elements. */
  :global(:root.high-contrast) .kit-checkbox__input:focus-visible + .kit-checkbox__box {
    outline-width: 3px;
    outline-offset: 2px;
  }

  /* Glyphs are surface-colored so they contrast against the accent fill
   * in both modes — the solid-button ink discipline. */
  .kit-checkbox__glyph {
    position: absolute;
    width: 12px;
    height: 12px;
    stroke: var(--bg-surface);
    stroke-width: var(--icon-stroke, 2);
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity var(--transition-fast) var(--transition-ease, ease),
      transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-checkbox__input:checked + .kit-checkbox__box .kit-checkbox__glyph--check,
  .kit-checkbox__input:indeterminate + .kit-checkbox__box .kit-checkbox__glyph--dash {
    opacity: 1;
    transform: scale(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-checkbox__box,
    .kit-checkbox__glyph {
      transition: none;
    }
  }

  .kit-checkbox__label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    min-width: 0;
  }
</style>
