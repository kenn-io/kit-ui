<script module lang="ts">
  export type SidebarToggleState = "expanded" | "collapsed";
</script>

<script lang="ts">
  import PanelLeftCloseIcon from "@lucide/svelte/icons/panel-left-close";
  import PanelLeftOpenIcon from "@lucide/svelte/icons/panel-left-open";
  import type { ClassValue } from "svelte/elements";

  interface Props {
    state?: SidebarToggleState;
    /** What is being toggled, for the accessible label ("Collapse sidebar"). */
    label?: string;
    onclick?: ((event: MouseEvent) => void) | undefined;
    class?: ClassValue;
  }

  let {
    state = "expanded",
    label = "sidebar",
    onclick,
    class: className = undefined,
  }: Props = $props();

  const ToggleIcon = $derived(state === "collapsed" ? PanelLeftOpenIcon : PanelLeftCloseIcon);
  const action = $derived(state === "collapsed" ? "Expand" : "Collapse");
  const accessibleLabel = $derived(`${action} ${label}`);
</script>

<button
  class={["kit-sidebar-toggle", `kit-sidebar-toggle--${state}`, className]}
  {onclick}
  title={accessibleLabel}
  aria-label={accessibleLabel}
  type="button"
>
  <ToggleIcon size="14" strokeWidth="1.5" aria-hidden="true" />
</button>

<style>
  .kit-sidebar-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: transparent;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);
  }

  .kit-sidebar-toggle:hover {
    color: var(--text-primary);
    background: var(--bg-surface-hover);
  }

  :global(.kit-sidebar-toggle--compact) {
    width: 22px;
    height: 22px;
  }

  :global(.kit-sidebar-toggle--push) {
    margin-left: auto;
  }
  /* Normalized keyboard focus (gyp8): one ring token, :focus-visible only. */
  :global(.kit-sidebar-toggle):focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }
</style>
