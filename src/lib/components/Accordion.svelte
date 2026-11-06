<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import { accordionContext, type AccordionContext } from "./accordion-context.js";

  interface Props {
    /** Keep at most one item open: opening an item closes the others.
     * Uses the native `<details name>` group, so it needs no script. */
    exclusive?: boolean;
    /** Group name for `exclusive`; generated when omitted. */
    name?: string;
    /** Disclosure items. */
    children: Snippet;
    class?: string;
  }

  let { exclusive = false, name = undefined, children, class: className = "" }: Props = $props();

  const uid = $props.id();
  const fallbackName = `kit-accordion-${uid}`;
  setContext<AccordionContext>(accordionContext, {
    get name() {
      return exclusive ? (name ?? fallbackName) : undefined;
    },
  });
</script>

<div class="kit-accordion {className}">{@render children()}</div>

<style>
  .kit-accordion {
    min-width: 0;
    overflow: hidden;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
  }
</style>
