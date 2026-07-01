<script lang="ts">
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunIcon from "@lucide/svelte/icons/sun";
  import {
    getThemeMode,
    setThemeMode,
    type ThemeMode,
  } from "../stores/theme.svelte.js";
  import IconButton from "./IconButton.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  interface Props {
    /** "cycle" = one icon button cycling light → dark → system (header
     * chrome); "segmented" = a three-way selector (settings pages). */
    variant?: "cycle" | "segmented";
    size?: "sm" | "md";
    lightLabel?: string;
    darkLabel?: string;
    systemLabel?: string;
    /** aria-label template for the cycle button; `{mode}` is replaced with
     * the current mode's label. */
    cycleLabel?: string;
    /** Segmented variant only: stretch to the container width. */
    block?: boolean;
    class?: string;
  }

  let {
    variant = "cycle",
    size = "md",
    lightLabel = "Light",
    darkLabel = "Dark",
    systemLabel = "System",
    cycleLabel = "Theme: {mode}",
    block = false,
    class: className = "",
  }: Props = $props();

  // getThemeMode() reads the store's reactive $state — the control stays in
  // sync however the mode changes (another toggle instance, app code).
  const mode = $derived(getThemeMode());

  const modeLabel = $derived(
    mode === "light" ? lightLabel : mode === "dark" ? darkLabel : systemLabel,
  );

  const CYCLE: Record<ThemeMode, ThemeMode> = {
    light: "dark",
    dark: "system",
    system: "light",
  };

  const options = $derived([
    { value: "light", label: lightLabel },
    { value: "dark", label: darkLabel },
    { value: "system", label: systemLabel },
  ]);
</script>

{#if variant === "segmented"}
  <SegmentedControl
    class={className}
    {options}
    {block}
    value={mode}
    onchange={(value) => setThemeMode(value as ThemeMode)}
  />
{:else}
  <IconButton
    class={className}
    {size}
    ariaLabel={cycleLabel.replace("{mode}", modeLabel)}
    onclick={() => setThemeMode(CYCLE[mode])}
  >
    {#if mode === "light"}
      <SunIcon size="14" strokeWidth="2" aria-hidden="true" />
    {:else if mode === "dark"}
      <MoonIcon size="14" strokeWidth="2" aria-hidden="true" />
    {:else}
      <MonitorIcon size="14" strokeWidth="2" aria-hidden="true" />
    {/if}
  </IconButton>
{/if}
