<script lang="ts">
  import MoreHorizontalIcon from "@lucide/svelte/icons/ellipsis";
  import {
    Menu,
    MenuContent,
    MenuItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuSeparator,
    MenuTrigger,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let lastAction = $state("none");
  let daemon = $state("local");
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
        <MenuItem textValue="Move issue" onselect={() => (lastAction = "move")}>Move issue</MenuItem
        >
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

<style>
  .menu-demo-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
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
