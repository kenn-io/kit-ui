<script lang="ts">
  import { Button, Modal, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let basicOpen = $state(false);
  let confirmOpen = $state(false);
</script>

<DemoSection
  title="Basic modal"
  description="Render conditionally with an {'{#if}'} block; the component handles overlay, Escape, and the close button via onclose."
  code={`{#if open}
  <Modal title="About" onclose={() => (open = false)}>
    <p>Any content.</p>
  </Modal>
{/if}`}
>
  <Button label="Open modal" onclick={() => (basicOpen = true)} />
  {#if basicOpen}
    <Modal title="About kit-ui" onclose={() => (basicOpen = false)}>
      <p>
        Shared Svelte 5 components consolidated from the middleman and
        agentsview frontends.
      </p>
    </Modal>
  {/if}
</DemoSection>

<DemoSection
  title="Confirm dialog with footer"
  description="Use the footer snippet for action rows."
  code={`{#if open}
  <Modal title="Delete session" onclose={close}>
    <p>This cannot be undone.</p>
    {#snippet footer()}
      <Button label="Cancel" onclick={close} />
      <Button label="Delete" tone="danger" surface="solid" onclick={confirm} />
    {/snippet}
  </Modal>
{/if}`}
>
  <Button label="Delete…" tone="danger" onclick={() => (confirmOpen = true)} />
  {#if confirmOpen}
    <Modal title="Delete session" onclose={() => (confirmOpen = false)}>
      <p>This permanently deletes the session. This cannot be undone.</p>
      {#snippet footer()}
        <Button label="Cancel" onclick={() => (confirmOpen = false)} />
        <Button
          label="Delete"
          tone="danger"
          surface="solid"
          onclick={() => {
            confirmOpen = false;
            showFlash("Deleted (not really)");
          }}
        />
      {/snippet}
    </Modal>
  {/if}
</DemoSection>
