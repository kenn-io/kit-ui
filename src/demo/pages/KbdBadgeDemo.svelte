<script lang="ts">
  import { KbdBadge } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Keyboard shortcut badges"
  description="Hidden automatically on touch devices."
  code={`<KbdBadge keys={["⌘", "K"]} />
<KbdBadge keys={["Ctrl", "⇧", "P"]} />
<KbdBadge keys={["⌘", "K"]} joiner="compact" />
<KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
<KbdBadge keys={["?"]} />`}
>
  <KbdBadge keys={["⌘", "K"]} />
  <KbdBadge keys={["Ctrl", "⇧", "P"]} />
  <KbdBadge keys={["⌘", "K"]} joiner="compact" />
  <KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
  <KbdBadge keys={["?"]} />
  <KbdBadge keys={["g", "i"]} joiner="plus" ariaLabel="g then i" />
</DemoSection>

<DemoSection title="Key glyphs">
  {#each ["keys", "compact", "plus"] as const as joiner (joiner)}
    <KbdBadge keys={["⌘", "⌥", "⌃", "⇧", "↵", "↑", "↓", "←", "→"]} {joiner} />
  {/each}
</DemoSection>
