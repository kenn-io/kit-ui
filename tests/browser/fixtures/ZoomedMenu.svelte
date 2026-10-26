<script lang="ts">
  import Menu from "../../../src/lib/components/Menu.svelte";
  import MenuContent from "../../../src/lib/components/MenuContent.svelte";
  import MenuRadioGroup from "../../../src/lib/components/MenuRadioGroup.svelte";
  import MenuRadioItem from "../../../src/lib/components/MenuRadioItem.svelte";
  import MenuTrigger from "../../../src/lib/components/MenuTrigger.svelte";

  // A model picker built from Menu parts, for the zoomed-dropdown specs.
  interface Props {
    onchange: (value: string) => void;
    /** Extra models that make the menu taller than the viewport. */
    extraModels?: number;
  }

  let { onchange, extraModels = 0 }: Props = $props();
  const extras = $derived(Array.from({ length: extraModels }, (_, i) => `model-${i + 1}`));
  let value = $state("balanced");
</script>

<Menu>
  <MenuTrigger ariaLabel={`Model: ${value}`}>Model</MenuTrigger>
  <MenuContent ariaLabel="Model">
    <MenuRadioGroup
      {value}
      ariaLabel="Model"
      onchange={(next) => {
        value = next;
        onchange(next);
      }}
    >
      <MenuRadioItem value="balanced" closeOnSelect>Balanced</MenuRadioItem>
      <MenuRadioItem value="deep" closeOnSelect>Deep</MenuRadioItem>
      {#each extras as model (model)}
        <MenuRadioItem value={model} closeOnSelect>{model}</MenuRadioItem>
      {/each}
    </MenuRadioGroup>
  </MenuContent>
</Menu>
