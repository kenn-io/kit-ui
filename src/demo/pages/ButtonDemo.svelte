<script lang="ts">
  import { Button, showFlash } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Surfaces and tones"
  description="Button pairs a tone (semantic color) with a surface (visual weight). Solid info is the primary action; outline neutral is the default secondary."
  code={`<Button label="Save" tone="info" surface="solid" onclick={save} />
<Button label="Cancel" />
<Button label="Approve" tone="success" surface="soft" />
<Button label="Merge" tone="success" surface="solid" />
<Button label="Close" tone="danger" surface="outline" />
<Button label="Delete" tone="danger" surface="solid" />
<Button label="Run workflow" tone="workflow" surface="soft" />`}
>
  <Button label="Save" tone="info" surface="solid" onclick={() => showFlash("Saved!")} />
  <Button label="Cancel" onclick={() => showFlash("Canceled")} />
  <Button label="Approve" tone="success" surface="soft" />
  <Button label="Merge" tone="success" surface="solid" />
  <Button label="Close" tone="danger" surface="outline" />
  <Button label="Delete" tone="danger" surface="solid" />
  <Button label="Run workflow" tone="workflow" surface="soft" />
</DemoSection>

<DemoSection
  title="Sizes and states"
  code={`<Button label="Small" size="sm" />
<Button label="Medium" size="md" />
<Button label="Disabled" disabled />`}
>
  <Button label="Small" size="sm" />
  <Button label="Medium" size="md" />
  <Button label="Disabled" disabled />
</DemoSection>

<DemoSection
  title="Icon and trailing content"
  description="Use the children snippet for leading content (icons) and the trailing snippet after the label."
  code={`<Button label="Next" tone="info" surface="solid">
  {#snippet trailing()}→{/snippet}
</Button>`}
>
  <Button label="Next" tone="info" surface="solid">
    {#snippet trailing()}→{/snippet}
  </Button>
</DemoSection>
