<script lang="ts">
  import { Button, Modal, showFlash, type ModalTone } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let basicOpen = $state(false);
  let confirmOpen = $state(false);
  let toneOpen = $state<ModalTone | null>(null);

  const tones: { tone: ModalTone; title: string; body: string }[] = [
    {
      tone: "info",
      title: "Session details",
      body: "Informational header — the default choice for detail dialogs.",
    },
    { tone: "success", title: "Merge complete", body: "Confirmation of a completed action." },
    {
      tone: "warning",
      title: "Unsaved changes",
      body: "You have unsaved changes that will be lost.",
    },
    {
      tone: "danger",
      title: "Delete repository",
      body: "Destructive confirmation — pair with a solid danger button.",
    },
  ];
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
      <p>Shared Svelte 5 components consolidated from the middleman and agentsview frontends.</p>
    </Modal>
  {/if}
</DemoSection>

<DemoSection
  title="Header tones"
  description="tone tints the header band with a semantic accent; neutral (the default) uses a plain inset header."
  code={`<Modal title="Unsaved changes" tone="warning" onclose={close}>…</Modal>`}
>
  {#each tones as t (t.tone)}
    <Button label={t.tone} onclick={() => (toneOpen = t.tone)} />
  {/each}
  {#if toneOpen}
    {@const active = tones.find((t) => t.tone === toneOpen)!}
    <Modal title={active.title} tone={active.tone} onclose={() => (toneOpen = null)}>
      <p>{active.body}</p>
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
    <Modal title="Delete session" tone="danger" onclose={() => (confirmOpen = false)}>
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
