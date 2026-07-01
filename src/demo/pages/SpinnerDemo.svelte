<script lang="ts">
  import { Spinner } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";
</script>

<DemoSection
  title="Sizes"
  code={`<Spinner />
<Spinner size={16} />
<Spinner size={40} label="Loading sessions" />`}
>
  <Spinner size={16} />
  <Spinner />
  <Spinner size={40} label="Loading sessions" />
</DemoSection>
