<script lang="ts">
  import { Button, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Flash messages"
  description="Mount <FlashBanner /> once near the app root, then call showFlash(message) from anywhere. Messages auto-dismiss after 4 seconds (configurable) or on click. The banner in this gallery is mounted by the demo shell."
  code={`<!-- App.svelte -->
<FlashBanner />

<!-- anywhere -->
import { showFlash } from "@kenn-io/kit-ui";
showFlash("Copied to clipboard");
showFlash("Long-lived message", 10000);`}
>
  <Button label="Show flash" onclick={() => showFlash("Hello from kit-ui!")} />
  <Button
    label="Show sticky-ish flash (10s)"
    onclick={() => showFlash("This one stays for 10 seconds", 10000)}
  />
</DemoSection>
