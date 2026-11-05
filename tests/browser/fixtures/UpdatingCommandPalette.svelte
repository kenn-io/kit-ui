<script lang="ts">
  import CommandPalette, {
    type PaletteCommand,
  } from "../../../src/lib/components/CommandPalette.svelte";

  let open = $state(true);
  let ran = $state("");
  const parent: PaletteCommand = {
    id: "group",
    label: "Group by…",
    section: "View",
    children: [
      { id: "source", label: "Group by Source" },
      { id: "date", label: "Group by Date" },
    ],
  };
  let commands = $state<PaletteCommand[]>([parent]);
</script>

<button
  onclick={() =>
    (commands = [
      { ...parent, children: parent.children!.map((c) => ({ ...c, disabled: c.id === "source" })) },
    ])}>Refresh commands</button
>
<button onclick={() => (commands = [{ id: "root", label: "Root command" }])}>Remove parent</button>
<button onclick={() => (commands = [parent])}>Restore parent</button>
<output>{ran}</output>
<CommandPalette bind:open {commands} onrun={(command) => (ran = command.id)} />
