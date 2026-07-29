<script lang="ts">
  import { FormField, Notice, PageFrame, type FieldState } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let email = $state<FieldState>({
    id: "page-frame-demo-email",
    label: "Work email",
    value: "name@",
    error: "Enter a complete email address.",
  });

  function updateEmail(value: string) {
    email = { ...email, value, error: undefined };
  }
</script>

<DemoSection
  title="PageFrame"
  description="A centered account-page shell. Applications keep routing, authentication, and submit behavior."
>
  <div class="page-frame-demo">
    <PageFrame
      title="Continue to acme"
      description="Use your acme account to continue."
      brandName="acme"
    >
      <div class="page-frame-demo__stack">
        <Notice
          tone="warning"
          title="Session paused"
          message="Check your details, then try again."
          actionLabel="Try again"
          onaction={() => undefined}
        />
        <FormField field={email} type="email" autocomplete="email" oninput={updateEmail} />
      </div>
    </PageFrame>
  </div>
</DemoSection>

<style>
  .page-frame-demo {
    --kit-page-frame-min-height: 100%;

    width: 100%;
    min-height: 620px;
  }

  .page-frame-demo__stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
