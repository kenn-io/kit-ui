<script lang="ts">
  import LinkIcon from "@lucide/svelte/icons/link";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import {
    CommentCard,
    IconButton,
    Timeline,
    TimelineItem,
    type TimelineTone,
  } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const tones: TimelineTone[] = [
    "info",
    "success",
    "warning",
    "danger",
    "merged",
    "workspace",
    "neutral",
    "muted",
  ];
</script>

<DemoSection
  title="Activity timeline"
  description="The presentational compound behind PR/issue conversation views: Timeline + TimelineItem draw the rail (toned dot, halo, connector), CommentCard carries the comment anatomy (type eyebrow, author, time, actions, body). System events are header-only rows."
  code={`<Timeline ariaLabel="Pull request activity">
  <TimelineItem tone="info">
    <CommentCard typeLabel="comment" tone="info" author="marius" time="3h ago">
      {#snippet actions()}<IconButton ariaLabel="Edit">…</IconButton>{/snippet}
      Body — render Markdown here in a real app.
    </CommentCard>
  </TimelineItem>
  <TimelineItem tone="merged">
    <CommentCard typeLabel="merged" tone="merged" author="marius" time="1h ago" />
  </TimelineItem>
</Timeline>`}
>
  <div class="feed">
    <Timeline ariaLabel="Pull request activity">
      <TimelineItem tone="info">
        <CommentCard typeLabel="comment" tone="info" author="marius" time="3h ago">
          {#snippet actions()}
            <IconButton ariaLabel="Edit comment" size="sm">
              <PencilIcon size="13" aria-hidden="true" />
            </IconButton>
            <IconButton ariaLabel="Copy link" size="sm">
              <LinkIcon size="13" aria-hidden="true" />
            </IconButton>
          {/snippet}
          The reconnect storm happens because every client backs off on the same schedule. Adding jitter
          to the retry delay should spread them out.
        </CommentCard>
      </TimelineItem>

      <TimelineItem tone="success">
        <CommentCard typeLabel="commit" tone="success" author="marius" time="2h ago">
          <code class="mono">a41f2c9 — websocket: add ±30% jitter to reconnect backoff</code>
        </CommentCard>
      </TimelineItem>

      <TimelineItem tone="merged">
        <CommentCard typeLabel="review" tone="merged" author="ada" time="90m ago">
          Approved. The jitter bounds look right; nice touch keeping the cap at 30s.
        </CommentCard>
      </TimelineItem>

      <TimelineItem tone="muted">
        <CommentCard typeLabel="assigned" tone="muted" author="ada → marius" time="85m ago" />
      </TimelineItem>

      <TimelineItem tone="danger">
        <CommentCard typeLabel="force push" tone="danger" author="marius" time="70m ago">
          <code class="mono">rebased onto main (d6f8727)</code>
        </CommentCard>
      </TimelineItem>

      <TimelineItem tone="merged">
        <CommentCard typeLabel="merged" tone="merged" author="ada" time="1h ago" />
      </TimelineItem>
    </Timeline>
  </div>
</DemoSection>

<DemoSection
  title="Dot tones"
  description="TimelineItem shares Chip's tone vocabulary; untinted dots read as system plumbing."
  code={`<TimelineItem tone="success">…</TimelineItem>`}
>
  <div class="feed">
    <Timeline ariaLabel="Tone reference">
      {#each tones as tone (tone)}
        <TimelineItem {tone}>
          <span class="tone-row">{tone}</span>
        </TimelineItem>
      {/each}
    </Timeline>
  </div>
</DemoSection>

<style>
  .feed {
    width: 100%;
    max-width: 640px;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .tone-row {
    display: inline-block;
    padding-top: 9px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
</style>
