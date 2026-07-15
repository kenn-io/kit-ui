<script lang="ts">
  import { Typeahead, type TypeaheadOption } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  let repo = $state("");
  const repos = [
    { name: "kenn-io/middleman", label: "kenn-io/middleman", displayLabel: "middleman" },
    { name: "kenn-io/agentsview", label: "kenn-io/agentsview", displayLabel: "agentsview" },
    { name: "kenn-io/kit-ui", label: "kenn-io/kit-ui", displayLabel: "kit-ui" },
    { name: "kenn-io/infra", label: "kenn-io/infra", displayLabel: "infra" },
  ];

  let remoteValue = $state("server-result");
  let remoteQuery = $state("initial");
  let remoteOptionsQuery = $state("initial");
  let remoteOpenResetCountdown = 0;
  const remoteOptions = $derived<TypeaheadOption[]>(
    remoteOptionsQuery === ""
      ? []
      : remoteOptionsQuery === "group"
        ? [
            {
              name: "server-group",
              label: "Server group",
              expanded: false,
              children: [{ name: "server-child", label: "Server child" }],
            },
          ]
        : remoteOptionsQuery === "updated"
          ? [{ name: "server-result", label: "Updated server result" }]
          : remoteOptionsQuery === "other"
            ? [{ name: "other-result", label: "Other result" }]
            : remoteOptionsQuery === "slow"
              ? [{ name: "slow-result", label: "Slow result" }]
              : remoteOptionsQuery === "old"
                ? [{ name: "shared-result", label: "Old result" }]
                : remoteOptionsQuery === "new"
                  ? [{ name: "shared-result", label: "New result" }]
                  : [{ name: "server-result", label: "Server result" }],
  );
  function updateRemoteQuery(query: string): void {
    remoteQuery = query;
    if (query === "async-open") {
      remoteOptionsQuery = "";
      remoteOpenResetCountdown = 2;
      return;
    }
    if (query === "" && remoteOpenResetCountdown > 0) {
      remoteOptionsQuery = "";
      remoteOpenResetCountdown -= 1;
      if (remoteOpenResetCountdown === 0) {
        setTimeout(() => {
          if (remoteQuery === "") remoteOptionsQuery = "new";
        }, 100);
      }
      return;
    }
    if (query !== "async") {
      remoteOptionsQuery = query;
      return;
    }
    remoteOptionsQuery = "";
    setTimeout(() => {
      if (remoteQuery === "async") remoteOptionsQuery = "new";
    }, 100);
  }
  async function selectRemote(value: string): Promise<void> {
    const selectionQuery = remoteQuery;
    if (value === "slow-result" || selectionQuery === "old") {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    remoteValue = value;
  }

  let owner = $state("");
  const owners: TypeaheadOption[] = [
    { name: "marius", label: "marius", meta: "42 open" },
    { name: "sam", label: "sam", meta: "7 open" },
    { name: "dana", label: "dana", meta: "on leave" },
  ];

  let branch = $state("main");
  let branchError = $state("");
  const branches: TypeaheadOption[] = [
    { name: "main", label: "main" },
    { name: "release", label: "release" },
    { name: "locked/prod", label: "locked/prod" },
  ];
  function selectBranch(value: string): boolean {
    if (value.startsWith("locked/")) {
      branchError = "That branch is locked";
      return false;
    }
    branchError = "";
    branch = value;
    return true;
  }

  let grouped = $state("");
  const groupedOptions: TypeaheadOption[] = [
    {
      name: "github.com",
      label: "github.com",
      children: [
        { name: "github.com/kenn-io/middleman", label: "kenn-io/middleman" },
        { name: "github.com/kenn-io/agentsview", label: "kenn-io/agentsview" },
      ],
    },
    {
      name: "gitlab.com",
      label: "gitlab.com",
      expanded: false,
      children: [{ name: "gitlab.com/kenn-io/mirror", label: "kenn-io/mirror" }],
    },
  ];

  let ref = $state("");
  let refKind = $state<"branches" | "tags">("branches");
  let refsLoading = $state(false);
  const refOptions = $derived(
    refKind === "branches"
      ? [
          { name: "main", label: "main" },
          { name: "release", label: "release" },
        ]
      : [
          { name: "v1.0.0", label: "v1.0.0" },
          { name: "v1.1.0", label: "v1.1.0" },
        ],
  );
  function switchRefKind(kind: "branches" | "tags") {
    if (kind === refKind) return;
    refKind = kind;
    refsLoading = true;
    setTimeout(() => (refsLoading = false), 600);
  }
</script>

<DemoSection
  title="Filterable select"
  description="Click the trigger to get a search input; matches are highlighted, arrow keys navigate, Enter selects."
  code={`<Typeahead
  options={repos}
  value={repo}
  fallbackLabel="All repositories"
  placeholder="Filter repositories…"
  onselect={(v) => {
    repo = v;
  }}
/>`}
>
  <Typeahead
    options={repos}
    value={repo}
    fallbackLabel="All repositories"
    placeholder="Filter repositories…"
    onselect={(v) => {
      repo = v;
    }}
  />
  <span>value: <code data-demo="repo-value">{repo || "(none)"}</code></span>
</DemoSection>

<DemoSection
  title="Remote option source"
  description="remote disables local filtering while onquery reports input changes so a caller can fetch and replace the option source. Opening, closing, and selection reset the reported query."
  code={`<Typeahead
  remote
  allowClear
  options={remoteOptions}
  value={remoteValue}
  fallbackLabel="Select remote result"
  placeholder="Search remote options…"
  onquery={(query) => {
    remoteQuery = query;
  }}
  onselect={(value) => {
    remoteValue = value;
  }}
/>`}
>
  <Typeahead
    remote
    allowClear
    options={remoteOptions}
    value={remoteValue}
    fallbackLabel="Select remote result"
    placeholder="Search remote options…"
    onquery={(query) => {
      updateRemoteQuery(query);
    }}
    onselect={selectRemote}
  />
  <span>query: <code data-demo="remote-query">{remoteQuery || "(empty)"}</code></span>
  <span>value: <code data-demo="remote-value">{remoteValue || "(none)"}</code></span>
</DemoSection>

<DemoSection
  title="Clear row, custom values, meta"
  description="allowClear prepends a row that selects the empty value; allowCustom lets Enter submit free text with no match; option meta is searched and rendered dim; triggerPrefix labels the closed trigger."
  code={`<Typeahead
  options={owners}
  value={owner}
  allowClear
  allowCustom
  triggerPrefix="owner:"
  fallbackLabel="Anyone"
  placeholder="Filter owners…"
  onselect={(v) => {
    owner = v;
  }}
/>`}
>
  <Typeahead
    options={owners}
    value={owner}
    allowClear
    allowCustom
    triggerPrefix="owner:"
    fallbackLabel="Anyone"
    placeholder="Filter owners…"
    onselect={(v) => {
      owner = v;
    }}
  />
  <span>value: <code data-demo="owner-value">{owner || "(none)"}</code></span>
</DemoSection>

<DemoSection
  title="Veto and error row"
  description="onselect may return false (or throw) to keep the list open; the error prop shows an error row above the options, which stay selectable so a retry can clear it. Selecting locked/prod here is vetoed."
  code={`<Typeahead
  options={branches}
  value={branch}
  error={branchError}
  fallbackLabel="Select branch"
  placeholder="Filter branches…"
  onselect={selectBranch}
/>`}
>
  <Typeahead
    options={branches}
    value={branch}
    error={branchError}
    fallbackLabel="Select branch"
    placeholder="Filter branches…"
    onselect={selectBranch}
  />
  <span>value: <code data-demo="branch-value">{branch}</code></span>
</DemoSection>

<DemoSection
  title="Grouped options"
  description="Options with children render as expand/collapse groups: ArrowRight expands, ArrowLeft collapses (or jumps to the parent), Enter toggles a group and selects a leaf. Filtering searches leaves and keeps their group headers."
  code={`const options: TypeaheadOption[] = [
  {
    name: "github.com",
    label: "github.com",
    children: [
      { name: "github.com/kenn-io/middleman", label: "kenn-io/middleman" },
    ],
  },
  { name: "gitlab.com", label: "gitlab.com", expanded: false, children: [...] },
];

<Typeahead options={options} value={grouped} … />`}
>
  <Typeahead
    options={groupedOptions}
    value={grouped}
    fallbackLabel="All repos"
    placeholder="Filter grouped repos…"
    onselect={(v) => {
      grouped = v;
    }}
  />
  <span>value: <code data-demo="grouped-value">{grouped || "(none)"}</code></span>
</DemoSection>

<DemoSection
  title="Header snippet and loading row"
  description="The header snippet renders inside the popover above the options (a Branches/Tags switcher here); loading replaces the rows with a loading row while an async source resolves. placement forces the list above or below the trigger."
  code={`<Typeahead
  options={refOptions}
  value={ref}
  loading={refsLoading}
  placement="top"
  fallbackLabel="Select ref"
  placeholder="Filter refs…"
  onselect={(v) => {
    ref = v;
  }}
>
  {#snippet header()}
    <button onclick={() => switchRefKind("branches")}>Branches</button>
    <button onclick={() => switchRefKind("tags")}>Tags</button>
  {/snippet}
</Typeahead>`}
>
  <Typeahead
    options={refOptions}
    value={ref}
    loading={refsLoading}
    placement="top"
    fallbackLabel="Select ref"
    placeholder="Filter refs…"
    onselect={(v) => {
      ref = v;
    }}
  >
    {#snippet header()}
      <div class="ref-tabs" data-demo="ref-tabs">
        <button
          type="button"
          class="ref-tab"
          class:active={refKind === "branches"}
          onclick={() => switchRefKind("branches")}
        >
          Branches
        </button>
        <button
          type="button"
          class="ref-tab"
          class:active={refKind === "tags"}
          onclick={() => switchRefKind("tags")}
        >
          Tags
        </button>
      </div>
    {/snippet}
  </Typeahead>
  <span>value: <code data-demo="ref-value">{ref || "(none)"}</code></span>
</DemoSection>

<style>
  .ref-tabs {
    display: flex;
    gap: 2px;
  }

  .ref-tab {
    flex: 1;
    padding: 3px 8px;
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .ref-tab:hover {
    background: var(--bg-surface-hover);
  }

  .ref-tab.active {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
    font-weight: 600;
  }
</style>
