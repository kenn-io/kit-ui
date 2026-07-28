<script lang="ts">
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

<style>
  .notice-demo {
    width: min(100%, 520px);
  }

  .notice-demo__readout {
    display: none;
  }
</style>
