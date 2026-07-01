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

  function next(): void {
    if (matches.length === 0) return;
    currentIndex = (safeIndex + 1) % matches.length;
  }

  function prev(): void {
    if (matches.length === 0) return;
    currentIndex = (safeIndex - 1 + matches.length) % matches.length;
  }
</script>

<DemoSection
  title="Find within content"
  description="The bar owns only the input and navigation; the consumer computes matches and moves a highlight. Enter advances, Shift+Enter goes back, Escape closes. Try searching 'read'."
  code={`<FindBar
  bind:query
  matchCount={matches.length}
  currentIndex={safeIndex}
  onnext={next}
  onprev={prev}
  onclose={() => (visible = false)}
  oninput={() => (currentIndex = 0)}
/>`}
>
  <div class="find-demo">
    {#if visible}
      <FindBar
        bind:query
        matchCount={matches.length}
        currentIndex={safeIndex}
        onnext={next}
        onprev={prev}
        onclose={() => (visible = false)}
        oninput={() => (currentIndex = 0)}
      />
    {:else}
      <div class="find-demo__reopen">
        <Button size="sm" label="Reopen find bar" onclick={() => (visible = true)} />
      </div>
    {/if}
    <ul class="find-demo__list">
      {#each lines as line, i (line)}
        <li
          class="find-demo__line"
          class:match={matches.includes(i)}
          class:current={i === activeLine}
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
