<script lang="ts">
  import {
    Button,
    MentionTextarea,
    type MentionOption,
    type MentionTrigger,
  } from "../../lib/index.js";
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

  let commandValue = $state("");
  let commandField = $state<HTMLTextAreaElement>();
  let edits = $state(0);
  let pastes = $state(0);
  const commands: MentionOption[] = [
    { id: "review", insert: "review", label: "Review the current changes" },
    { id: "plan", insert: "plan", label: "Plan a change" },
    { id: "compact", insert: "compact", label: "Summarize the conversation" },
  ];
  function searchCommands(query: string): MentionOption[] {
    const q = query.toLowerCase();
    return commands.filter((command) => command.insert.startsWith(q));
  }

  const files = [
    "README.md",
    "package.json",
    "src/lib/index.ts",
    "src/lib/components/Button.svelte",
    "src/lib/components/MentionTextarea.svelte",
    "src/lib/components/mention.ts",
    "docs/components/mention-textarea.md",
    "tests/browser/mention-textarea.spec.ts",
  ];
  // A stand-in for an app's file search: fzf-style subsequence matching that
  // ranks tight matches and matches in the file name first. Real apps rank
  // their own project files, usually off the main thread.
  function fuzzyScore(path: string, query: string): number {
    const text = path.toLowerCase();
    const nameStart = text.lastIndexOf("/") + 1;
    let score = 0;
    let at = -1;
    for (const char of query.toLowerCase()) {
      const next = text.indexOf(char, at + 1);
      if (next === -1) return -1;
      score += next === at + 1 ? 3 : 1;
      if (next >= nameStart) score += 2;
      at = next;
    }
    return score - path.length / 100;
  }
  function searchFiles(query: string): MentionOption[] {
    return files
      .map((path) => ({ path, score: fuzzyScore(path, query) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(({ path }) => ({ id: path, insert: path, label: "" }));
  }
  const composerTriggers: MentionTrigger[] = [
    { char: "/", search: searchCommands, hideEmpty: true, menuLabel: "Commands" },
    { char: "@", search: searchFiles, emptyLabel: "No matching files", menuLabel: "Files" },
  ];
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

<DemoSection
  title="Commands and files in a composer"
  description="triggers gives each character its own search: / lists commands anywhere in the message, and @ fuzzy-matches files. The / trigger uses hideEmpty, so a path such as /tmp opens nothing unless a command matches, and the / inside @src/lib stays part of the file query. embedded drops the field's own frame so the composer card draws it, and textareaEl exposes the field for focus management."
  code={`<div class="composer">
  <MentionTextarea
    bind:value
    bind:textareaEl
    triggers={[
      { char: "/", search: searchCommands, hideEmpty: true, menuLabel: "Commands" },
      { char: "@", search: searchFiles, menuLabel: "Files" },
    ]}
    embedded
    rows={2}
    oninput={() => edits++}
    onpaste={(event) => pastes += event.clipboardData?.files.length ?? 0}
    ariaLabel="Message"
  />
</div>`}
>
  <div class="mention-demo">
    <div class="composer">
      <MentionTextarea
        bind:value={commandValue}
        bind:textareaEl={commandField}
        triggers={composerTriggers}
        embedded
        rows={2}
        placeholder="Ask the agent; / for commands, @ for files"
        ariaLabel="Message"
        ariaDescribedby="composer-help"
        oninput={() => edits++}
        onpaste={(event) => (pastes += event.clipboardData?.files.length ?? 0)}
      />
    </div>
    <span id="composer-help">Type / for a command or @ for a file, anywhere in the message.</span>
    <span>value: <code data-demo="command-value">{commandValue || "(empty)"}</code></span>
    <span
      >edits: <code data-demo="command-edits">{edits}</code> · pasted files:
      <code data-demo="command-pastes">{pastes}</code></span
    >
    <div><Button size="sm" onclick={() => commandField?.focus()}>Focus the composer</Button></div>
  </div>
</DemoSection>

<style>
  .composer {
    --kit-mention-padding: var(--space-4) var(--space-5);
    --kit-mention-min-height: 56px;
    --kit-mention-max-height: 12rem;
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }

  .composer:focus-within {
    border-color: var(--accent-blue);
  }

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
