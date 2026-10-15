<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import {
    Menu,
    MenuContent,
    MenuItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuSeparator,
    MenuTrigger,
    TextInput,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let lastAction = $state("none");
  let daemon = $state("local");
  let contextMenuOpen = $state(false);
  let contextMenuAnchor = $state<{ x: number; y: number }>();
  let contextTarget = $state<HTMLElement>();
  let fileName = $state("notes.md");
  let fileNameInput = $state<HTMLInputElement>();

  function startRename(): void {
    lastAction = "rename";
    fileNameInput?.select();
  }

  function openContextMenu(event: MouseEvent): void {
    event.preventDefault();
    contextMenuAnchor = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
  }
</script>

<DemoSection
  title="Action menu"
  description="Menu owns trigger ARIA, positioning, dismissal, roving focus, typeahead, and focus restoration. Items own menu semantics while their snippets carry application content."
  code={`<Menu>
  <MenuTrigger ariaLabel="Task actions">
    <MoreHorizontalIcon size={14} />
  </MenuTrigger>
  <MenuContent ariaLabel="Task actions">
    <MenuItem onselect={moveIssue}>Move issue</MenuItem>
    <MenuItem disabled onselect={archiveIssue}>Archive issue</MenuItem>
    <MenuSeparator />
    <MenuItem tone="danger" onselect={deleteIssue}>Delete issue</MenuItem>
  </MenuContent>
</Menu>`}
>
  <div class="menu-demo-row">
    <Menu>
      <MenuTrigger ariaLabel="Task actions">
        {#snippet child({ attachment })}
          <button
            class="task-actions-trigger"
            type="button"
            title="Task actions"
            {@attach attachment}
          >
            <MoreHorizontalIcon size="14" strokeWidth="2" aria-hidden="true" />
          </button>
        {/snippet}
      </MenuTrigger>
      <MenuContent ariaLabel="Task actions">
        <MenuItem textValue="Move issue" onselect={() => (lastAction = "move")}>
          {#snippet icon()}<ArrowRightIcon size={16} />{/snippet}
          Move issue
        </MenuItem>
        <MenuItem disabled textValue="Archive issue" onselect={() => (lastAction = "archive")}>
          Archive issue
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" textValue="Delete issue" onselect={() => (lastAction = "delete")}>
          Delete issue
        </MenuItem>
      </MenuContent>
    </Menu>
    <span data-testid="menu-last-action">last action: {lastAction}</span>
  </div>
</DemoSection>

<DemoSection
  title="Menu without icons"
  description="When no item passes an icon, labels start at the item padding with no empty column."
  code={`<Menu>
  <MenuTrigger ariaLabel="Photo actions">…</MenuTrigger>
  <MenuContent ariaLabel="Photo actions">
    <MenuItem onselect={hide}>Hide</MenuItem>
    <MenuItem onselect={report}>Report</MenuItem>
  </MenuContent>
</Menu>`}
>
  <div class="menu-demo-row">
    <Menu>
      <MenuTrigger ariaLabel="Photo actions">
        {#snippet child({ attachment })}
          <button
            class="task-actions-trigger"
            type="button"
            title="Photo actions"
            {@attach attachment}
          >
            <MoreHorizontalIcon size="14" strokeWidth="2" aria-hidden="true" />
          </button>
        {/snippet}
      </MenuTrigger>
      <MenuContent ariaLabel="Photo actions">
        <MenuItem onselect={() => (lastAction = "hide")}>Hide</MenuItem>
        <MenuItem onselect={() => (lastAction = "report")}>Report</MenuItem>
      </MenuContent>
    </Menu>
  </div>
</DemoSection>

<DemoSection
  title="Single-choice menu"
  description="Radio items expose selection through menuitemradio. They stay open by default for repeated choices; closeOnSelect opts into one-and-done switchers."
  code={`<Menu>
  <MenuTrigger ariaLabel={\`Switch daemon: ${daemon}\`}>{daemon}</MenuTrigger>
  <MenuContent ariaLabel="Configured daemons">
    <MenuRadioGroup value={daemon} onchange={(value) => (daemon = value)}>
      <MenuRadioItem value="local" closeOnSelect>Local</MenuRadioItem>
      <MenuRadioItem value="remote" closeOnSelect>Remote</MenuRadioItem>
    </MenuRadioGroup>
  </MenuContent>
</Menu>`}
>
  <div class="menu-demo-row">
    <Menu>
      <MenuTrigger ariaLabel={`Switch daemon: ${daemon}`}>{daemon}</MenuTrigger>
      <MenuContent ariaLabel="Configured daemons">
        <MenuRadioGroup value={daemon} onchange={(value) => (daemon = value)}>
          <MenuRadioItem value="local" closeOnSelect textValue="Local daemon">
            Local daemon
          </MenuRadioItem>
          <MenuRadioItem value="remote" closeOnSelect textValue="Remote daemon">
            Remote daemon
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
    <span data-testid="menu-daemon">selected: {daemon}</span>
  </div>
</DemoSection>

<DemoSection
  title="Context menu"
  description="Pass anchor to open at the pointer instead of below a trigger, and returnFocus to hand focus back to the right-clicked element. The menu flips to stay inside the viewport and closes when the page scrolls."
  code={`<div tabindex="0" bind:this={target} oncontextmenu={open}>…</div>
<Menu bind:open anchor={{ x, y }} returnFocus={target}>
  <MenuContent ariaLabel="File actions">
    <MenuItem onselect={rename}>
      {#snippet icon()}<PencilIcon size={14} />{/snippet}
      Rename
      {#snippet trailing()}F2{/snippet}
    </MenuItem>
  </MenuContent>
</Menu>`}
>
  <div
    class="menu-demo-context-target"
    data-testid="menu-context-target"
    role="button"
    tabindex="0"
    bind:this={contextTarget}
    oncontextmenu={openContextMenu}
  >
    Right-click here
  </div>
  <TextInput bind:value={fileName} bind:inputEl={fileNameInput} ariaLabel="File name" />
  <Menu bind:open={contextMenuOpen} anchor={contextMenuAnchor} returnFocus={contextTarget}>
    <MenuContent ariaLabel="File actions">
      <MenuItem textValue="Rename" onselect={startRename}>
        {#snippet icon()}<PencilIcon size={14} />{/snippet}
        Rename
        {#snippet trailing()}F2{/snippet}
      </MenuItem>
      <MenuItem textValue="Copy path" onselect={() => (lastAction = "copy")}>
        {#snippet icon()}<CopyIcon size={14} />{/snippet}
        Copy path
      </MenuItem>
    </MenuContent>
  </Menu>
</DemoSection>

<style>
  .menu-demo-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .menu-demo-context-target {
    display: grid;
    place-items: center;
    height: 96px;
    border: var(--border-width) dashed var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .task-actions-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-inset);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .task-actions-trigger:hover,
  .task-actions-trigger:global([aria-expanded="true"]) {
    border-color: var(--accent-blue);
    color: var(--text-primary);
  }
</style>
