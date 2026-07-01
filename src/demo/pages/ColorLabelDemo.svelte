<script lang="ts">
  import ChipStack from "../../lib/components/ChipStack.svelte";
  import ColorLabel from "../../lib/components/ColorLabel.svelte";
  import DemoSection from "../DemoSection.svelte";

  // GitHub-style labels spanning the luminance range: the light yellow and
  // lime get dark text, the navy and purple get white text.
  const labels = [
    { name: "bug", color: "d73a4a" },
    { name: "good first issue", color: "#7057ff" },
    { name: "help wanted", color: "008672" },
    { name: "invalid", color: "e4e669" },
    { name: "light-yellow", color: "#fef08a" },
    { name: "dark-navy", color: "0b1e3f" },
    { name: "documentation", color: "0075ca" },
    { name: "wontfix", color: "fff" },
  ];
</script>

<DemoSection
  title="Contrast-aware text"
  description="Any hex background, with or without #. Text flips between dark ink and white by WCAG contrast ratio — compare light-yellow vs dark-navy."
  code={`<ColorLabel name="bug" color="d73a4a" />
<ColorLabel name="light-yellow" color="#fef08a" />
<ColorLabel name="dark-navy" color="0b1e3f" />`}
>
  {#each labels as label (label.name)}
    <ColorLabel name={label.name} color={label.color} />
  {/each}
</DemoSection>

<DemoSection
  title="Sizes and fallback"
  description="sm matches Chip's small tier. Invalid colors fall back to a neutral gray."
  code={`<ColorLabel name="compact" color="0075ca" size="sm" />
<ColorLabel name="not-a-color" color="chartreuse" />`}
>
  <ColorLabel name="compact" color="0075ca" size="sm" />
  <ColorLabel name="regular" color="0075ca" />
  <ColorLabel name="not-a-color" color="chartreuse" />
</DemoSection>

<DemoSection
  title="Label rows via ChipStack"
  description="Multi-label rows are composed with ChipStack — there is no list variant. maxVisible collapses the rest behind a +N chip."
  code={`<ChipStack items={labels} maxVisible={3} size="sm" key={(l) => l.name}>
  {#snippet chip(label)}
    <ColorLabel name={label.name} color={label.color} size="sm" />
  {/snippet}
</ChipStack>`}
>
  <ChipStack items={labels} maxVisible={3} size="sm" key={(l) => l.name}>
    {#snippet chip(label)}
      <ColorLabel name={label.name} color={label.color} size="sm" />
    {/snippet}
  </ChipStack>
</DemoSection>
