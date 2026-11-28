<script lang="ts">
  import Button from "../../lib/components/Button.svelte";
  import DetailDrawer from "../../lib/components/DetailDrawer.svelte";
  import Modal from "../../lib/components/Modal.svelte";
  import { Menu, MenuContent, MenuItem, MenuTrigger } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let basicOpen = $state(false);
  let customOpen = $state(false);
  let stackOpen = $state(false);
  let innerConfirmOpen = $state(false);
  let outerConfirmOpen = $state(false);
</script>

<DemoSection
  title="Basic drawer"
  description="Right-side slide-in panel over an overlay. Dismiss with Escape, an overlay click, or the close button."
  code={`{#if open}
  <DetailDrawer title="acme/widgets#128" onclose={() => (open = false)}>
    <p>…detail content…</p>
  </DetailDrawer>
{/if}`}
>
  <Button label="Open drawer" onclick={() => (basicOpen = true)} />
  {#if basicOpen}
    <DetailDrawer title="acme/widgets#128" onclose={() => (basicOpen = false)}>
      <div class="drawer-demo-body">
        <h4>Fix flaky range picker test</h4>
        <p>
          The calendar stepper test assumed the local week starts on Sunday. Pin the anchor date
          instead of deriving it from the wall clock so CI in other timezones stops flaking.
        </p>
        <p>
          The body scrolls independently while the header and footer stay pinned, so long detail
          views (diffs, timelines, comment threads) work without extra wiring.
        </p>
      </div>
    </DetailDrawer>
  {/if}
</DemoSection>

<DemoSection
  title="Header + footer snippets, custom width"
  description="A header snippet replaces the default title row entirely; a footer snippet renders a pinned action row. width controls the panel size."
  code={`<DetailDrawer width="420px" onclose={close}>
  {#snippet header()}…{/snippet}
  …
  {#snippet footer()}
    <Button label="Close" onclick={close} />
    <Button label="Approve" tone="success" surface="soft" />
  {/snippet}
</DetailDrawer>`}
>
  <Button label="Open custom drawer" onclick={() => (customOpen = true)} />
  {#if customOpen}
    <DetailDrawer width="420px" ariaLabel="Review session" onclose={() => (customOpen = false)}>
      {#snippet header()}
        <strong class="drawer-demo-title">Review session</strong>
        <span class="drawer-demo-meta">updated 4m ago</span>
      {/snippet}
      <div class="drawer-demo-body">
        <p>
          This drawer has no default close button — the header snippet owns the whole row — but
          Escape and the overlay click still dismiss it.
        </p>
      </div>
      {#snippet footer()}
        <Button label="Close" onclick={() => (customOpen = false)} />
        <Button
          label="Approve"
          tone="success"
          surface="soft"
          onclick={() => (customOpen = false)}
        />
      {/snippet}
    </DetailDrawer>
  {/if}
</DemoSection>

<DemoSection
  title="Stacked layers"
  description="Escape closes only the topmost layer: a dialog over the drawer, a dialog rendered inside it, or a menu in it. Each press peels one layer."
  code={`<DetailDrawer title="Stacked layers" onclose={closeDrawer}>
  <Menu>…</Menu>
  {#if confirmOpen}
    <Modal title="Confirm" onclose={() => (confirmOpen = false)}>…</Modal>
  {/if}
</DetailDrawer>`}
>
  <Button label="Open stacked drawer" onclick={() => (stackOpen = true)} />
  <Button
    label="Open confirm in a new drawer"
    onclick={() => {
      stackOpen = true;
      innerConfirmOpen = true;
    }}
  />
  {#if stackOpen}
    <DetailDrawer title="Stacked layers" onclose={() => (stackOpen = false)}>
      <div class="drawer-demo-body">
        <Menu>
          <MenuTrigger>Actions</MenuTrigger>
          <MenuContent ariaLabel="Drawer actions">
            <MenuItem onselect={() => {}}>Assign</MenuItem>
            <MenuItem onselect={() => {}}>Label</MenuItem>
          </MenuContent>
        </Menu>
        <Button label="Confirm inside drawer" onclick={() => (innerConfirmOpen = true)} />
        <Button label="Confirm over drawer" onclick={() => (outerConfirmOpen = true)} />
        {#if innerConfirmOpen}
          <Modal title="Inner confirm" onclose={() => (innerConfirmOpen = false)}>
            <p>Rendered inside the drawer's markup.</p>
          </Modal>
        {/if}
      </div>
    </DetailDrawer>
  {/if}
  {#if outerConfirmOpen}
    <Modal title="Outer confirm" onclose={() => (outerConfirmOpen = false)}>
      <p>Rendered beside the drawer, opened after it.</p>
    </Modal>
  {/if}
</DemoSection>

<style>
  .drawer-demo-body {
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    color: var(--text-secondary);
    font-size: var(--font-size-md);
  }

  .drawer-demo-body h4 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-lg);
  }

  .drawer-demo-body p {
    margin: 0;
  }

  .drawer-demo-title {
    font-size: var(--font-size-md);
    color: var(--text-primary);
  }

  .drawer-demo-meta {
    margin-left: auto;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
