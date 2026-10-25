<script lang="ts">
  import { Button, showFlash, type FlashTone } from "../../lib/index.js";

  let archived = $state(0);
  import DemoSection from "../DemoSection.svelte";

  const tones: FlashTone[] = ["info", "success", "warning", "danger"];
  const toneMessages: Record<string, string> = {
    info: "Rebase started in the background",
    success: "Merge complete",
    warning: "2 sessions need your attention",
    danger: "Deploy failed — rolling back",
  };
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

<DemoSection
  title="Stacked flashes"
  description="Concurrent messages stack below each other; the widest one sets the width for the whole stack. Each dismisses on its own timer (or its own X)."
  code={`showFlash("Copied");
showFlash("Deploy started — watching logs for build 4821…", 8000);
showFlash("2 sessions need your attention", 6000);`}
>
  <Button
    label="Show three flashes"
    onclick={() => {
      showFlash("Copied");
      showFlash("Deploy started — watching logs for build 4821…", 8000);
      showFlash("2 sessions need your attention", 6000);
    }}
  />
</DemoSection>

<DemoSection
  title="Tones"
  description="tone tints the banner with a semantic accent (band, ink, and countdown bar) following the Modal header recipe; neutral stays the plain surface. The duration-only second argument still works."
  code={`showFlash("Merge complete", { tone: "success" });
showFlash("Deploy failed — rolling back", { tone: "danger", durationMs: 8000 });`}
>
  {#each tones as tone (tone)}
    <Button label={tone} onclick={() => showFlash(toneMessages[tone] ?? tone, { tone })} />
  {/each}
</DemoSection>

<DemoSection
  title="Actions"
  description="action adds one follow-up control, such as Undo, after the message. Running it dismisses the flash; showFlash returns the flash id for programmatic dismissal."
  code={`showFlash("Archived", {
  durationMs: 8000,
  action: { label: "Undo", onclick: () => restore() },
});`}
>
  <Button
    label="Archive"
    onclick={() => {
      archived += 1;
      showFlash("Archived", {
        durationMs: 8000,
        action: { label: "Undo", onclick: () => (archived -= 1) },
      });
    }}
  />
  <span data-testid="flash-archived">Archived: {archived}</span>
</DemoSection>
