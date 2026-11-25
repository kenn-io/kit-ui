<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, HTMLAttributes } from "svelte/elements";
  import {
    overlayScrollbars,
    type OverlayScrollbarAxis,
    type OverlayScrollbarInset,
    type OverlayScrollbarVisibility,
  } from "../utils/overlay-scrollbars.js";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "class" | "onscroll"> {
    class?: ClassValue;
    dataTest?: string | undefined;
    label: string;
    /** Which axes scroll and render overlay thumbs. Default `"y"`. */
    axis?: OverlayScrollbarAxis;
    /** When overlay thumbs appear: `"auto"` (hover/scroll/drag), `"always"`, or `"never"`. */
    visibility?: OverlayScrollbarVisibility;
    /** Top inset for the vertical thumb (e.g. below a sticky header). */
    insetTop?: OverlayScrollbarInset;
    /** Bottom inset for the vertical thumb. */
    insetBottom?: OverlayScrollbarInset;
    /** Left inset for the horizontal thumb. */
    insetLeft?: OverlayScrollbarInset;
    /** Right inset for the horizontal thumb. */
    insetRight?: OverlayScrollbarInset;
    /** Corner clearance in px, or `"auto"` to follow computed border radii. */
    cornerRadius?: number | "auto";
    onscroll?: ((event: Event) => void) | undefined;
    viewport?: HTMLDivElement | undefined;
    children: Snippet;
  }

  let {
    class: className = "",
    dataTest,
    label,
    axis = "y",
    visibility = "auto",
    insetTop = 0,
    insetBottom = 0,
    insetLeft = 0,
    insetRight = 0,
    cornerRadius = "auto",
    onscroll,
    viewport = $bindable(),
    children,
    ...rest
  }: Props = $props();

  let root = $state<HTMLDivElement>();
</script>

<div class={["kit-scrollbox", className]} data-test={dataTest} bind:this={root}>
  <!-- Scrollable regions need keyboard access. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    tabindex="0"
    {...rest}
    class={[
      "kit-scrollbox__viewport",
      axis === "x" && "kit-scrollbox__viewport--x",
      axis === "both" && "kit-scrollbox__viewport--both",
    ]}
    aria-label={label}
    bind:this={viewport}
    {onscroll}
    role="region"
    {@attach overlayScrollbars({
      axis,
      visibility,
      insetTop,
      insetBottom,
      insetLeft,
      insetRight,
      cornerRadius,
      host: root,
    })}
  >
    <div class="kit-scrollbox__content">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .kit-scrollbox {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .kit-scrollbox__viewport {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .kit-scrollbox__viewport--x {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .kit-scrollbox__viewport--both {
    overflow: auto;
  }

  .kit-scrollbox__content {
    min-height: 100%;
  }
</style>
