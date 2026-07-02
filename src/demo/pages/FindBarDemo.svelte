<script lang="ts">
  import Button from "../../lib/components/Button.svelte";
  import FindBar from "../../lib/components/FindBar.svelte";
  import DemoSection from "../DemoSection.svelte";

  const lines = [
    "Read src/lib/stores/session.svelte.ts",
    "Edit src/lib/components/RangePicker.svelte",
    "Bash bun run check",
    "Read docs/components/range-picker.md",
    "Edit src/lib/components/FindBar.svelte",
    "Bash bun test checks/rules.test.ts",
    "Write docs/components/find-bar.md",
    "Read src/demo/App.svelte",
  ];

  // One independent find-state per demo section.
  function createFindState() {
    let visible = $state(true);
    let query = $state("");
    let currentIndex = $state(0);

    const matches = $derived.by(() => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return lines.flatMap((line, i) => (line.toLowerCase().includes(q) ? [i] : []));
    });
    // Clamp so shrinking the match list never leaves the index out of range.
    const safeIndex = $derived(
      matches.length === 0 ? 0 : Math.min(currentIndex, matches.length - 1),
    );
    const activeLine = $derived(matches.length > 0 ? matches[safeIndex] : -1);

    return {
      get visible() {
        return visible;
      },
      set visible(v: boolean) {
        visible = v;
      },
      get query() {
        return query;
      },
      set query(v: string) {
        query = v;
      },
      get matches() {
        return matches;
      },
      get safeIndex() {
        return safeIndex;
      },
      get activeLine() {
        return activeLine;
      },
      reset() {
        currentIndex = 0;
      },
      next() {
        if (matches.length === 0) return;
        currentIndex = (safeIndex + 1) % matches.length;
      },
      prev() {
        if (matches.length === 0) return;
        currentIndex = (safeIndex - 1 + matches.length) % matches.length;
      },
    };
  }

  const pinned = createFindState();
  const floating = createFindState();
</script>

<DemoSection
  title="Pinned (default)"
  description="The bar spans the top edge of the find-target container as a flush strip — square corners, bottom border only, no shadow (browser find-bar style). The bar owns only the input and navigation; the consumer computes matches and moves a highlight. Enter advances, Shift+Enter goes back, Escape closes. Try searching 'read'."
  code={`<div class="content-card">
  <FindBar
    bind:query
    matchCount={matches.length}
    currentIndex={safeIndex}
    onnext={next}
    onprev={prev}
    onclose={() => (visible = false)}
    oninput={() => (currentIndex = 0)}
  />
  <!-- searched content -->
</div>`}
>
  <div class="find-demo">
    {#if pinned.visible}
      <FindBar
        bind:query={pinned.query}
        matchCount={pinned.matches.length}
        currentIndex={pinned.safeIndex}
        onnext={() => pinned.next()}
        onprev={() => pinned.prev()}
        onclose={() => (pinned.visible = false)}
        oninput={() => pinned.reset()}
      />
    {:else}
      <div class="find-demo__reopen">
        <Button size="sm" label="Reopen find bar" onclick={() => (pinned.visible = true)} />
      </div>
    {/if}
    <ul class="find-demo__list">
      {#each lines as line, i (line)}
        <li
          class="find-demo__line"
          class:match={pinned.matches.includes(i)}
          class:current={i === pinned.activeLine}
        >
          {line}
        </li>
      {/each}
    </ul>
  </div>
</DemoSection>

<DemoSection
  title="Floating (IDE style)"
  description="variant=&quot;floating&quot; insets a shadowed card at the top-right of the searched region (the container needs position: relative) — the editor find-widget pattern. The card overlays content without shifting it; this demo reserves top padding only so the first lines stay readable, which real integrations don't need. This is the variant that carries the popover shadow chrome."
  code={`<div class="content-card" style="position: relative">
  <FindBar variant="floating" bind:query … />
  <!-- searched content -->
</div>`}
>
  <div class="find-demo find-demo--positioned">
    {#if floating.visible}
      <FindBar
        variant="floating"
        autofocus={false}
        bind:query={floating.query}
        matchCount={floating.matches.length}
        currentIndex={floating.safeIndex}
        onnext={() => floating.next()}
        onprev={() => floating.prev()}
        onclose={() => (floating.visible = false)}
        oninput={() => floating.reset()}
      />
    {:else}
      <div class="find-demo__reopen">
        <Button size="sm" label="Reopen find bar" onclick={() => (floating.visible = true)} />
      </div>
    {/if}
    <ul class="find-demo__list">
      {#each lines as line, i (line)}
        <li
          class="find-demo__line"
          class:match={floating.matches.includes(i)}
          class:current={i === floating.activeLine}
        >
          {line}
        </li>
      {/each}
    </ul>
  </div>
</DemoSection>

<style>
  .find-demo {
    width: 100%;
    max-width: 560px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    overflow: hidden;
  }

  .find-demo--positioned {
    position: relative;
    /* Demo-only: keeps the sample lines readable under the overlay.
     * Real integrations let the card cover content (see find-bar.md). */
    padding-top: 44px;
  }

  .find-demo__reopen {
    padding: var(--space-3) var(--space-6);
    border-bottom: 1px solid var(--border-muted);
  }

  .find-demo__list {
    list-style: none;
    margin: 0;
    padding: var(--space-2) 0;
  }

  .find-demo__line {
    padding: var(--space-1) var(--space-6);
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .find-demo__line.match {
    background: color-mix(in srgb, var(--accent-amber) 12%, transparent);
  }

  .find-demo__line.current {
    background: color-mix(in srgb, var(--accent-amber) 32%, transparent);
    color: var(--text-primary);
  }
</style>
