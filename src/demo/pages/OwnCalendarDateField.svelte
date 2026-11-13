<script lang="ts">
  import {
    Calendar,
    DatePhraseInput,
    focusOnOpen,
    formatDayLabel,
    parseDatePhrase,
    todayStr,
  } from "../../lib/index.js";

  // One typed date above a bare Calendar. This file is the example in
  // docs/components/date-phrase-input.md ("Using the field with your own
  // Calendar"); checks/date-phrase-docs.test.ts keeps the two identical.
  let picked = $state<string | null>(null);
  let open = $state(false);
  let text = $state("");
  let month = $state(todayStr());
  const parsed = $derived(parseDatePhrase(text));
  const typed = $derived(parsed.kind === "date" ? parsed.date : null);
  const shown = $derived(typed ?? picked);

  function toggle(): void {
    open = !open;
    if (open) month = picked ?? todayStr();
  }

  function pick(date: string): void {
    picked = date;
    text = "";
    open = false;
  }
</script>

<button type="button" onclick={toggle}>{picked ? formatDayLabel(picked) : "Pick a date"}</button>
{#if open}
  <DatePhraseInput
    bind:value={text}
    summary={typed ? formatDayLabel(typed) : ""}
    hint="Type or pick a date."
    autofocus={focusOnOpen()}
    oninput={() => {
      if (typed) month = typed;
    }}
    onsubmit={() => {
      if (typed) pick(typed);
    }}
  />
  <Calendar bind:month selected={shown ? { from: shown, to: shown } : null} onpick={pick} />
{/if}
