<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import { menuRadioGroupContextKey, type MenuRadioGroupContext } from "./menu.js";

  interface Props {
    value: string;
    onchange: (value: string) => void;
    ariaLabel?: string;
    children: Snippet;
  }

  let { value, onchange, ariaLabel, children }: Props = $props();

  const context: MenuRadioGroupContext = {
    get value() {
      return value;
    },
    select: (next) => onchange(next),
  };

  setContext(menuRadioGroupContextKey, context);
</script>

<div class="kit-menu__radio-group" role="group" aria-label={ariaLabel}>
  {@render children()}
</div>

<style>
  .kit-menu__radio-group {
    display: contents;
  }
</style>
