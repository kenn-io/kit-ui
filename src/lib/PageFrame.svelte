<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description?: string;
    brandName?: string;
    logoSrc?: string;
    logoAlt?: string;
    headingId?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
  }

  const componentId = $props.id();
  const generatedHeadingId = `kit-page-frame-title-${componentId}`;

  let {
    title,
    description = undefined,
    brandName = "Kenn",
    logoSrc = undefined,
    logoAlt = "",
    headingId = generatedHeadingId,
    class: className = "",
    children = undefined,
    footer = undefined,
  }: Props = $props();

  const brandMark = $derived(Array.from(brandName.trim())[0] ?? "");
</script>

<div class={["kit-page-frame", className]}>
  <section class="kit-page-frame__card" aria-labelledby={headingId}>
    <header class="kit-page-frame__header">
      <div class="kit-page-frame__brand">
        {#if logoSrc}
          <img class="kit-page-frame__logo" src={logoSrc} alt={logoAlt} />
        {:else if brandMark}
          <span class="kit-page-frame__mark" aria-hidden="true">{brandMark}</span>
        {/if}
        <span class="kit-page-frame__brand-name">{brandName}</span>
      </div>
      <div class="kit-page-frame__heading">
        <h1 id={headingId}>{title}</h1>
        {#if description}
          <p>{description}</p>
        {/if}
      </div>
    </header>

    {#if children}
      <div class="kit-page-frame__body">{@render children()}</div>
    {/if}

    {#if footer}
      <footer class="kit-page-frame__footer">{@render footer()}</footer>
    {/if}
  </section>
</div>

<style>
  .kit-page-frame {
    box-sizing: border-box;
    display: grid;
    min-height: var(--kit-page-frame-min-height, 100vh);
    min-height: var(--kit-page-frame-min-height, 100dvh);
    place-items: center;
    padding: var(--space-7);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  .kit-page-frame__card {
    box-sizing: border-box;
    width: min(100%, 420px);
    overflow: hidden;
    background: var(--bg-surface);
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  .kit-page-frame__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
    padding: var(--space-7) var(--space-7) 0;
  }

  .kit-page-frame__brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--text-primary);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.01em;
  }

  .kit-page-frame__mark {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
  }

  .kit-page-frame__logo {
    display: block;
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .kit-page-frame__mark {
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--text-primary);
    color: var(--bg-surface);
    font-size: var(--font-size-md);
  }

  .kit-page-frame__heading {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .kit-page-frame__heading h1,
  .kit-page-frame__heading p {
    margin: 0;
  }

  .kit-page-frame__heading h1 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    letter-spacing: -0.015em;
    line-height: 1.25;
  }

  .kit-page-frame__heading p {
    color: var(--text-secondary);
    font-size: var(--font-size-md);
    line-height: 1.5;
  }

  .kit-page-frame__body {
    padding: var(--space-6) var(--space-7) var(--space-7);
  }

  .kit-page-frame__footer {
    padding: var(--space-5) var(--space-7);
    background: var(--bg-inset);
    border-top: var(--border-width) solid var(--border-muted);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    line-height: 1.45;
  }

  @media (max-width: 640px) {
    .kit-page-frame {
      align-items: start;
      padding: var(--space-4);
    }

    .kit-page-frame__card {
      border-radius: var(--radius-md);
    }

    .kit-page-frame__header {
      padding: var(--space-6) var(--space-6) 0;
    }

    .kit-page-frame__body {
      padding: var(--space-6);
    }

    .kit-page-frame__footer {
      padding: var(--space-5) var(--space-6);
    }
  }
</style>
