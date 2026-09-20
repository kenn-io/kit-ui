<script lang="ts">
  import { Button, Modal, showFlash, type ModalTone } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let basicOpen = $state(false);
  let confirmOpen = $state(false);
  let toneOpen = $state<ModalTone | null>(null);
  let tallOpen = $state(false);

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

  // Enough copy that the body still overflows when `font-display: optional`
  // skips the webfont and the fallback face is more compact.
  const paragraphs = Array.from(
    { length: 24 },
    (_, i) =>
      `Paragraph ${i + 1}. A dialog taller than the window scrolls its body, ` +
      `and its footer stays where it can be reached.`,
  );
</script>

<DemoSection
  title="Basic modal"
  description="Render conditionally with an {'{#if}'} block; the component handles overlay, Escape, and the close button via onclose."
  code={`{#if open}
  <Modal title="About" closeLabel="Dismiss example dialog" onclose={() => (open = false)}>
    <p>Any content.</p>
  </Modal>
{/if}`}
>
  <Button label="Open modal" onclick={() => (basicOpen = true)} />
  {#if basicOpen}
    <Modal
      title="About kit-ui"
      closeLabel="Dismiss example dialog"
      onclose={() => (basicOpen = false)}
    >
      <p>Shared Svelte 5 components consolidated from Forge and agentsview.</p>
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

<DemoSection
  title="Taller than the window"
  description="The body scrolls and the footer stays on screen. maxHeight caps the panel, and its default is the small viewport height: on a phone 100vh is the height the page gets when the URL bar is hidden, so a panel capped with that can be taller than the screen."
  code={`<Modal title="Release notes" maxHeight="calc(100svh - 64px)" onclose={close}>
  …long content…
{#snippet footer()}<Button label="Done" onclick={close} />{/snippet}
</Modal>`}
>
  <Button label="Open tall modal" onclick={() => (tallOpen = true)} />
  {#if tallOpen}
    <Modal title="Release notes" onclose={() => (tallOpen = false)}>
      {#each paragraphs as text (text)}
        <p>{text}</p>
      {/each}
      {#snippet footer()}
        <Button label="Done" onclick={() => (tallOpen = false)} />
      {/snippet}
    </Modal>
  {/if}
</DemoSection>
