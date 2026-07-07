<script lang="ts">
  import { MentionTextarea, type MentionOption } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const issues: MentionOption[] = [
    { id: "1", insert: "j9cr", label: "Calendar month/year drill-down", meta: "kit-ui" },
    { id: "2", insert: "y1v0", label: "Retune chip and button tone inks for AA", meta: "kit-ui" },
    { id: "3", insert: "ry18", label: "Typeahead extensibility", meta: "kit-ui" },
    { id: "4", insert: "t662", label: "Grouped typeahead options", meta: "kit-ui" },
    { id: "5", insert: "zdn0", label: "Inline mention autocomplete", meta: "kit-ui" },
  ];

  let value = $state("");

  // Simulated async lookup: filter the static list after a short delay.
  function searchIssues(query: string): Promise<MentionOption[]> {
    const q = query.toLowerCase();
    const matches = issues.filter((issue) =>
      [issue.insert, issue.label].some((part) => part.toLowerCase().includes(q)),
    );
    return new Promise((resolve) => setTimeout(() => resolve(matches), 150));
  }

  let userValue = $state("");
  const users: MentionOption[] = [
    { id: "marius", insert: "marius", label: "Marius van Niekerk" },
    { id: "sam", insert: "sam", label: "Sam Doe" },
    { id: "dana", insert: "dana", label: "Dana Lee" },
  ];
  function searchUsers(query: string): MentionOption[] {
    const q = query.toLowerCase();
    return users.filter((user) =>
      [user.insert, user.label].some((part) => part.toLowerCase().includes(q)),
    );
  }
</script>

<DemoSection
  title="Issue references"
  description="Type # at a word boundary to open the menu; the text up to the caret is handed to the app's search function. ArrowUp/Down navigate, Enter or Tab insert the reference, Escape dismisses."
  code={`<MentionTextarea
  bind:value
  search={searchIssues}
  placeholder="Describe the task — reference issues with #"
  ariaLabel="Task description"
/>`}
>
  <div class="mention-demo">
    <MentionTextarea
      bind:value
      search={searchIssues}
      placeholder="Describe the task — reference issues with #"
      ariaLabel="Task description"
    />
    <span>value: <code data-demo="mention-value">{value || "(empty)"}</code></span>
  </div>
</DemoSection>

<DemoSection
  title="Custom trigger and rows"
  description="The trigger character is a prop (@ here), search may return synchronously, and the option snippet replaces the default row rendering."
  code={`<MentionTextarea
  bind:value={userValue}
  search={searchUsers}
  trigger="@"
  ariaLabel="Comment"
>
  {#snippet option(user, active)}
    <strong>@{user.insert}</strong>
    <span>{user.label}</span>
  {/snippet}
</MentionTextarea>`}
>
  <div class="mention-demo">
    <MentionTextarea
      bind:value={userValue}
      search={searchUsers}
      trigger="@"
      rows={2}
      placeholder="Mention someone with @"
      ariaLabel="Comment"
    >
      {#snippet option(user, active)}
        <span class="user-handle" class:active>@{user.insert}</span>
        <span class="user-name">{user.label}</span>
      {/snippet}
    </MentionTextarea>
    <span>value: <code data-demo="user-mention-value">{userValue || "(empty)"}</code></span>
  </div>
</DemoSection>

<style>
  .mention-demo {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: min(480px, 100%);
  }

  .user-handle {
    font-weight: 600;
    color: var(--accent-blue);
  }

  .user-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
