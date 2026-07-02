<script lang="ts">
  import SegmentedControl from "../../lib/components/SegmentedControl.svelte";
  import {
    getHighContrast,
    getThemeMode,
    initTheme,
    isDark,
    setHighContrast,
    setThemeMode,
    type ThemeMode,
  } from "../../lib/stores/theme.svelte.js";
  import DemoSection from "../DemoSection.svelte";

  // Restore the persisted preference and start the system listener. In a
  // real app this runs once at startup; re-running it here is harmless.
  initTheme();

  const modeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  const rootClasses = $derived(
    [isDark() && "dark", getHighContrast() && "high-contrast"].filter(Boolean).join(" ") ||
      "(none)",
  );
</script>

<DemoSection
  title="Mode"
  description="Persisted light/dark/system preference. System mode follows the OS via matchMedia and updates live. This demo drives the real <html> class through the store, so the whole gallery retints — the sidebar's ThemeToggle reads the same store and stays in sync."
  code={`import { initTheme, getThemeMode, setThemeMode } from "@kenn-io/kit-ui";

initTheme(); // once, at app startup

<SegmentedControl
  options={[{ value: "light", label: "Light" }, ...]}
  value={getThemeMode()}
  onchange={(v) => setThemeMode(v as ThemeMode)}
/>`}
>
  <SegmentedControl
    options={modeOptions}
    value={getThemeMode()}
    onchange={(v) => setThemeMode(v as ThemeMode)}
    ariaLabel="Theme mode"
  />
</DemoSection>

<DemoSection
  title="High contrast"
  description="Persisted flag that adds the high-contrast class alongside dark, strengthening text/border tokens to clear WCAG AA."
  code={`import { getHighContrast, setHighContrast } from "@kenn-io/kit-ui";

<input
  type="checkbox"
  checked={getHighContrast()}
  onchange={(e) => setHighContrast(e.currentTarget.checked)}
/>`}
>
  <label class="hc-toggle">
    <input
      type="checkbox"
      checked={getHighContrast()}
      onchange={(e) => setHighContrast(e.currentTarget.checked)}
    />
    High contrast
  </label>
</DemoSection>

<DemoSection
  title="Live state"
  description="The store getters are reactive; isDark() resolves system mode to the actual appearance."
>
  <dl class="state">
    <dt>getThemeMode()</dt>
    <dd><code>"{getThemeMode()}"</code></dd>
    <dt>isDark()</dt>
    <dd><code>{isDark()}</code></dd>
    <dt>getHighContrast()</dt>
    <dd><code>{getHighContrast()}</code></dd>
    <dt>&lt;html&gt; classes</dt>
    <dd><code>{rootClasses}</code></dd>
  </dl>
</DemoSection>

<style>
  .hc-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-md);
    color: var(--text-primary);
    cursor: pointer;
  }

  .hc-toggle input {
    accent-color: var(--accent-blue);
    cursor: pointer;
  }

  .state {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-3) var(--space-6);
    margin: 0;
    font-size: var(--font-size-md);
  }

  .state dt {
    color: var(--text-secondary);
  }

  .state dd {
    margin: 0;
  }

  .state code {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    background: var(--bg-inset);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
  }
</style>
