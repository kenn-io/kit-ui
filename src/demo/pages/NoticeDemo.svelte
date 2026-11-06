<script lang="ts">
  import LightbulbIcon from "@lucide/svelte/icons/lightbulb";
  import { Notice } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let noticeCallbacks = $state(0);
</script>

<DemoSection
  title="Notice"
  description="A persistent inline status with an optional recovery action. Use FlashBanner for transient, app-level feedback."
  code={`<Notice
  tone="warning"
  title="Session paused"
  message="Check your details, then try again."
  actionLabel="Try again"
  onaction={retry}
/>`}
>
  <div class="notice-demo">
    <Notice
      tone="warning"
      title="Session paused"
      message="Check your details, then try again."
      actionLabel="Try again"
      onaction={() => (noticeCallbacks += 1)}
    />
    <span class="notice-demo__readout" data-testid="auth-notice-callbacks" aria-live="polite"
      >{noticeCallbacks}</span
    >
  </div>
</DemoSection>

<DemoSection
  title="Callouts"
  description="With live={false}, a Notice is a static callout in page content: role note, not announced. The children snippet takes rich content, and the icon snippet replaces the tone dot."
  code={`<Notice tone="tip" live={false} title="Faster reviews">
  {#snippet icon()}<LightbulbIcon />{/snippet}
  Run <code>bun run check</code> before pushing.
</Notice>`}
>
  <div class="notice-demo notice-demo--stack" data-testid="notice-callouts">
    <Notice tone="note" live={false} message="Draft pages are only visible to their authors." />
    <Notice tone="tip" live={false} title="Faster reviews">
      {#snippet icon()}<LightbulbIcon />{/snippet}
      Run <code>bun run check</code> before pushing, and read
      <a href="#markdown">the Markdown page</a> for alert syntax.
    </Notice>
    <Notice
      tone="important"
      live={false}
      message="Breaking changes ship without a deprecation window."
    />
    <Notice tone="error" live={false}>
      <ul>
        <li>The token expired.</li>
        <li>The repository was renamed.</li>
      </ul>
    </Notice>
  </div>
</DemoSection>

<style>
  .notice-demo {
    width: min(100%, 520px);
  }

  .notice-demo--stack {
    display: grid;
    gap: var(--space-4);
  }

  .notice-demo__readout {
    display: none;
  }
</style>
