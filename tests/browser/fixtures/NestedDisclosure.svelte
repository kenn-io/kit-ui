<script lang="ts">
  import Disclosure from "../../../src/lib/components/Disclosure.svelte";
</script>

<Disclosure variant="plain" title="Outer plain" open class="fixture-outer">
  <Disclosure title="Inner card" open class="fixture-inner">Inner body</Disclosure>
</Disclosure>
<Disclosure title="Reference card" open class="fixture-reference">Reference body</Disclosure>
