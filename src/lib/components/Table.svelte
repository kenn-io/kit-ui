<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Header cells — <TableHeaderCell> (or <th>) elements. */
    header: Snippet;
    /** Body rows — <tr> elements. */
    children: Snippet;
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
    stickyHeader = true,
    zebra = true,
    ariaLabel = undefined,
    class: className = "",
  }: Props = $props();

  let scrolled = $state(false);
  let contained = $state(false);

  // A sticky header sticks to the nearest scroll container. A wrapper that
  // can scroll would capture it even when the page does all the scrolling,
  // so the wrapper scrolls only while the table overflows it: a bounded
  // height, or a table wider than the screen. Otherwise it clips without
  // scrolling and the header sticks to the page.
  function fit(wrapper: HTMLDivElement) {
    const table = wrapper.firstElementChild as HTMLTableElement;
    const head = table.tHead;
    const check = () => {
      contained =
        table.offsetHeight > wrapper.clientHeight + 1 ||
        table.offsetWidth > wrapper.clientWidth + 1;
    };
    // Rows pass under the header once it leaves the table's top edge,
    // whichever container scrolled it there.
    const stuck = () => {
      if (head)
        scrolled = head.getBoundingClientRect().top > table.getBoundingClientRect().top + 0.5;
    };
    check();
    stuck();
    window.addEventListener("scroll", stuck, { capture: true, passive: true });
    // Environments without layout (jsdom) have no ResizeObserver; the wrapper
    // keeps its initial state there.
    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("scroll", stuck, { capture: true });
    }
    // Switching overflow resizes what is observed, so the check waits a
    // frame instead of looping inside the observer callback.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame === 0)
        frame = requestAnimationFrame(() => {
          frame = 0;
          check();
          stuck();
        });
    });
    observer.observe(wrapper);
    observer.observe(table);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", stuck, { capture: true });
    };
  }
</script>

<div
  class={["kit-table-wrapper", className]}
  class:kit-table-wrapper--contained={contained}
  {@attach fit}
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
  /* min-width: 0 lets the wrapper shrink in a flex row: a clipping item
   * otherwise grows to its content, so a wide table would never overflow
   * it and switch it to scrolling. */
  .kit-table-wrapper {
    overflow: clip;
    flex: 1;
    min-width: 0;
    min-height: 0;
    box-shadow: var(--shadow-panel, none);
  }

  .kit-table-wrapper--contained {
    overflow: auto;
  }

  .kit-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }

  /* A header that sticks to a padded page scroller would stop below the
   * padding, with rows showing above it; the app offsets that padding. */
  .kit-table--sticky thead {
    position: sticky;
    top: var(--kit-table-sticky-top, 0);
    z-index: 1;
  }

  /* The page offset is for the page's padding; a wrapper that scrolls has
   * none, so its header sticks to its top edge. */
  .kit-table-wrapper--contained > .kit-table--sticky thead {
    top: 0;
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
