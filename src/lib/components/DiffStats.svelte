<script module lang="ts">
  /** Compact diff counts: 999 → "999", 12345 → "12.3k", 2_000_000 → "2M". */
  export function formatDiffStat(value: number): string {
    const abs = Math.abs(value);
    if (abs < 1000) return String(value);

    const divisor = abs >= 999_500 ? 1_000_000 : 1000;
    const suffix = divisor === 1_000_000 ? "M" : "k";
    const scaled = value / divisor;
    const integerDigits = Math.max(1, Math.floor(Math.abs(scaled)).toString().length);
    const fractionDigits = Math.max(0, 3 - integerDigits);
    const compact = Number(scaled.toFixed(fractionDigits)).toString();

    return `${compact}${suffix}`;
  }
</script>

<script lang="ts">
  interface Props {
    additions: number;
    deletions: number;
    /** Fade a side when it's zero. */
    dimZeros?: boolean;
  }

  const { additions, deletions, dimZeros = false }: Props = $props();

  function lineLabel(count: number, singular: string): string {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
  }
</script>

<span
  class="kit-diff-stats"
  aria-label={`${lineLabel(additions, "addition")}, ${lineLabel(deletions, "deletion")}`}
>
  <span class="kit-diff-stats__add" class:kit-diff-stats__value--dim={dimZeros && additions === 0}>
    +{formatDiffStat(additions)}
  </span>
  <span class="kit-diff-stats__del" class:kit-diff-stats__value--dim={dimZeros && deletions === 0}>
    −{formatDiffStat(deletions)}
  </span>
</span>

<style>
  .kit-diff-stats {
    display: inline-flex;
    gap: var(--space-3);
    align-items: baseline;
    font-family: var(--font-mono);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .kit-diff-stats__add,
  .kit-diff-stats__del {
    min-width: 0;
  }

  .kit-diff-stats__add {
    color: var(--accent-green);
  }

  .kit-diff-stats__del {
    color: var(--accent-red);
  }

  .kit-diff-stats__value--dim {
    opacity: 0.35;
  }
</style>
