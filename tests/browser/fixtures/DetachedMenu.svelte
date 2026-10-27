<script lang="ts">
  import Menu from "../../../src/lib/components/Menu.svelte";
  import MenuContent from "../../../src/lib/components/MenuContent.svelte";
  import MenuItem from "../../../src/lib/components/MenuItem.svelte";

  // A menu rendered in its own small window, which the host sizes to fit the
  // menu. The host's class rule must be able to lift the height cap.
  const items = Array.from({ length: 30 }, (_, i) => `Item ${i + 1}`);
</script>

<div class="detached-host">
  <Menu open>
    <MenuContent ariaLabel="Detached" class="detached-menu">
      {#each items as item (item)}
        <MenuItem textValue={item} onselect={() => {}}>{item}</MenuItem>
      {/each}
    </MenuContent>
  </Menu>
</div>

<style>
  .detached-host :global(.detached-menu) {
    position: static;
    max-height: none;
  }
</style>
