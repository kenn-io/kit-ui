<script lang="ts">
  interface Props {
    size?: number;
    /** Accessible label announced to screen readers. */
    label?: string;
  }

  let { size = 24, label = "Loading" }: Props = $props();
</script>

<span
  class="kit-spinner"
  style:width="{size}px"
  style:height="{size}px"
  role="status"
  aria-label={label}
></span>

<style>
  .kit-spinner {
    display: inline-block;
    box-sizing: border-box;
    border: 2px solid var(--border-default);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: kit-spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes kit-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
