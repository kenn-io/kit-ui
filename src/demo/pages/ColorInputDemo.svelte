<script lang="ts">
  import { ColorInput, contrastRatio, WCAG_AA_TEXT } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  // The Okabe-Ito palette: hues chosen to stay distinct under the common
  // forms of color blindness.
  const okabeIto = [
    { value: "#e69f00", label: "Orange" },
    { value: "#56b4e9", label: "Sky blue" },
    { value: "#009e73", label: "Bluish green" },
    { value: "#f0e442", label: "Yellow" },
    { value: "#0072b2", label: "Blue" },
    { value: "#d55e00", label: "Vermillion" },
    { value: "#cc79a7", label: "Reddish purple" },
  ];

  let accent = $state("#0072b2");
  let ink = $state("#f0e442");
  const inkRatio = $derived(contrastRatio(ink, "#ffffff"));
  const inkTooFaint = $derived(inkRatio < WCAG_AA_TEXT);
</script>

<DemoSection
  title="Picker, hex field, and quick picks"
  description="The well opens the platform picker, the field takes a typed hex (committed on Enter or blur), and swatches set a color in one click. A ring, not a hue, marks the current swatch."
  code={`<ColorInput bind:value={accent} ariaLabel="Accent color" swatches={okabeIto} />`}
>
  <div class="col">
    <ColorInput bind:value={accent} ariaLabel="Accent color" swatches={okabeIto} />
    <p class="value" data-testid="color-input-value">
      <span class="chip" style:background={accent}></span>
      {accent}
    </p>
  </div>
</DemoSection>

<DemoSection
  title="App-owned contrast warning"
  description="ColorInput does not judge a color. The app measures it with contrastRatio against the surface it will sit on, then sets invalid and points ariaDescribedby at its explanation."
  code={`const ratio = $derived(contrastRatio(ink, "#ffffff"));
<ColorInput bind:value={ink} invalid={ratio < WCAG_AA_TEXT} ariaDescribedby="ink-hint" />
<p id="ink-hint">{ratio.toFixed(1)}:1 on white</p>`}
>
  <div class="col">
    <ColorInput
      bind:value={ink}
      ariaLabel="Text color"
      invalid={inkTooFaint}
      ariaDescribedby="color-input-ink-hint"
      swatches={okabeIto}
    />
    <p id="color-input-ink-hint" class="hint" data-testid="color-input-ink-hint">
      {inkRatio.toFixed(1)}:1 on white{inkTooFaint ? " — too faint for text" : ""}
    </p>
  </div>
</DemoSection>

<DemoSection
  title="Sizes and disabled"
  description="sm and md match TextInput's 24px and 28px heights."
  code={`<ColorInput value="#009e73" size="sm" />
<ColorInput value="#009e73" disabled />`}
>
  <div class="col">
    <ColorInput value="#009e73" size="sm" ariaLabel="Small" />
    <ColorInput value="#009e73" ariaLabel="Disabled" disabled />
  </div>
</DemoSection>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .value,
  .hint {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .chip {
    width: 12px;
    height: 12px;
    border-radius: var(--radius-sm);
  }
</style>
