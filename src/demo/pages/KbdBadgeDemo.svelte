<script lang="ts">
  import { KbdBadge } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Keyboard shortcut badges"
  description="Compact joiner runs glyphs together (mac style); plus joins with +. Hidden automatically on touch devices."
  code={`<KbdBadge keys={["⌘", "K"]} />
<KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
<KbdBadge keys={["?"]} />`}
>
  <KbdBadge keys={["⌘", "K"]} />
  <KbdBadge keys={["Ctrl", "Shift", "P"]} joiner="plus" />
  <KbdBadge keys={["?"]} />
  <KbdBadge keys={["g", "i"]} joiner="plus" ariaLabel="g then i" />
</DemoSection>
