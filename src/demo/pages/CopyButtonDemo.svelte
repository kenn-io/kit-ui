<script lang="ts">
  import { CopyButton, copyToClipboard } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function controlledCopy() {
    if (await copyToClipboard("controlled copy")) {
      copied = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (copied = false), 1500);
    }
  }
</script>

<DemoSection
  title="Self-managed"
  description="Pass text and the button copies it and flashes a check mark on its own."
  code={`<CopyButton text="bun add @kenn-io/kit-ui" />`}
>
  <code>bun add @kenn-io/kit-ui</code>
  <CopyButton text="bun add @kenn-io/kit-ui" />
</DemoSection>

<DemoSection
  title="Controlled"
  description="Omit text and drive copied + onclick yourself, e.g. to copy computed content."
  code={`<CopyButton {copied} onclick={controlledCopy} />`}
>
  <CopyButton {copied} onclick={controlledCopy} />
  <span>copied: <code>{copied}</code></span>
</DemoSection>
