<script lang="ts">
  import type { Snippet } from "svelte";
  import { scrollerOf } from "./virtual.js";

  interface Props {
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Body rows — <tr> elements. */
    children: Snippet;
    /** What scrolls the rows: the table's own wrapper (give it a bounded
     * height), or the page or panel the table sits in. */
    scroll?: "self" | "page";
    /** Keep the header visible while the body scrolls. */
    stickyHeader?: boolean;
    /** Stripe even rows. */
    zebra?: boolean;
    ariaLabel?: string;
    /** Opts this table out of sorting. Every other table must sort:
     * kit-ui-check's `unsorted-table-header` rule requires sortable headers
     * unless this is set. */
    unsorted?: boolean;
    class?: string;
  }

  let {
    header,
    children,
    scroll = "self",
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    class: className = "",
  }: Props = $props();

  let scrolled = $state(false);
  let wide = $state(false);

  // Rows pass under the header once it leaves the table's top edge,
  // whichever container scrolled it there.
  function watchHeader(wrapper: HTMLDivElement) {
    const table = wrapper.firstElementChild as HTMLTableElement;
    const head = table.tHead;
    const scroller = scroll === "self" ? wrapper : scrollerOf(wrapper);
    const target: HTMLElement | Window = scroller === document.scrollingElement ? window : scroller;
    const stuck = () => {
      if (head)
        scrolled = head.getBoundingClientRect().top > table.getBoundingClientRect().top + 0.5;
    };
    stuck();
    target.addEventListener("scroll", stuck, { passive: true });
    return () => target.removeEventListener("scroll", stuck);
  }

  // A page-scrolled wrapper clips without scrolling, so it does not capture
  // the sticky header. Only a table wider than the wrapper (a narrow screen)
  // makes it scroll sideways, which gives up sticking to the page.
  function fitWidth(wrapper: HTMLDivElement) {
    // Environments without layout (jsdom) have no ResizeObserver.
    if (scroll === "self" || typeof ResizeObserver === "undefined") return;
    const table = wrapper.firstElementChild as HTMLTableElement;
    // The clip edge is the padding box, and the table starts after the left
    // padding, so it is clipped once it reaches past the right edge.
    const check = () => {
      const left = parseFloat(getComputedStyle(wrapper).paddingLeft) || 0;
      wide = left + table.offsetWidth > wrapper.clientWidth + 1;
    };
    check();
    // Switching overflow resizes what is observed, so the check waits a
    // frame instead of looping inside the observer callback.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          check();
        });
    });
    observer.observe(wrapper);
    observer.observe(table);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }
</script>

<div
  class={["kit-table-wrapper", className]}
  class:kit-table-wrapper--page={scroll === "page"}
  class:kit-table-wrapper--wide={scroll === "page" && wide}
  {@attach watchHeader}
  {@attach fitWidth}
>
  <table
    class="kit-table"
    class:kit-table--zebra={zebra}
    class:kit-table--sticky={stickyHeader}
    class:kit-table--scrolled={scrolled}
    aria-label={ariaLabel}
  >
    <thead>
      <tr>
        {@render header()}
      </tr>
    </thead>
    <tbody>
      {@render children()}
    </tbody>
  </table>
</div>

<style>
  /* min-width: 0 lets the wrapper shrink in a flex row, so a wide table
   * overflows it and scrolls instead of widening it. */
  .kit-table-wrapper {
    overflow: auto;
    flex: 1;
    min-width: 0;
    min-height: 0;
    box-shadow: var(--shadow-panel, none);
  }

  .kit-table-wrapper--page {
    overflow: clip;
  }

  .kit-table-wrapper--wide {
    overflow: auto;
  }

  .kit-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  .kit-table--sticky thead {
    position: sticky;
    top: 0;
    z-index: 1;
  }

  /* A header stuck to a padded page scroller would stop below the padding,
   * with rows showing above it; the app offsets that padding. */
  .kit-table-wrapper--page > .kit-table--sticky thead {
    top: var(--kit-table-sticky-top, 0);
  }

  /* Rows scrolled beneath the stuck header pass under its shadow. */
  .kit-table--sticky.kit-table--scrolled thead {
    box-shadow: var(--shadow-raised, none);
  }

  .kit-table :global(tbody td) {
    padding: 6px 10px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-muted);
  }

  .kit-table--zebra :global(tbody tr:nth-child(even)) {
    background: var(--bg-inset);
  }

  .kit-table :global(tbody tr:hover) {
    background: var(--bg-surface-hover);
  }
</style>
