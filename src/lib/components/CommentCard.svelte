<script lang="ts">
  import type { Snippet } from "svelte";
  import Card, { type CardTone } from "./Card.svelte";

  interface Props {
    /** Uppercase event label ("comment", "review", "merged"…). */
    typeLabel?: string | undefined;
    /** Accent for the label and, by convention, the timeline dot. */
    tone?: CardTone | undefined;
    author?: string | undefined;
    /** Pre-formatted timestamp ("2h ago") — the app owns formatting/i18n. */
    time?: string | undefined;
    /** Header-to-body spacing. Use `none` when rich content owns its outer spacing. */
    bodyGap?: "none" | "sm";
    class?: string;
    /** Trailing header content — edit / copy-link icon buttons. */
    actions?: Snippet;
    /** The comment body (e.g. a rendered Markdown component). Omit it for a
     * header-only system-event row. */
    children?: Snippet;
  }

  let {
    typeLabel = undefined,
    tone = undefined,
    author = undefined,
    time = undefined,
    bodyGap = "sm",
    class: className = "",
    actions,
    children,
  }: Props = $props();

  const classes = $derived(
    ["kit-comment-card", `kit-comment-card--body-gap-${bodyGap}`, className]
      .filter(Boolean)
      .join(" "),
  );
</script>

{#if children}
  <Card
    level="default"
    padding="sm"
    eyebrow={typeLabel}
    eyebrowTone={tone}
    title={author}
    meta={time}
    {actions}
    class={classes}
  >
    <div class="kit-comment-card__body">
      {@render children()}
    </div>
  </Card>
{:else}
  <!-- Header-only system-event row: no children snippet is forwarded, so
       Card renders no body region (and no header→body gap). -->
  <Card
    level="default"
    padding="sm"
    eyebrow={typeLabel}
    eyebrowTone={tone}
    title={author}
    meta={time}
    {actions}
    class={classes}
  />
{/if}

<style>
  :global(.kit-card.kit-comment-card--body-gap-none) {
    gap: 0;
  }

  /* Comment prose runs a step smaller and looser than UI chrome
   * (middleman's .event-body). */
  :global(.kit-comment-card) .kit-comment-card__body {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-prose, 1.6);
    color: var(--text-primary);
    word-break: break-word;
  }
</style>
