<script lang="ts">
  import {
    Button,
    createMarkdownRenderer,
    ImagePreview,
    initMarkdownImageViewer,
    Markdown,
    MediaViewer,
    SegmentedControl,
    type MediaViewerItem,
  } from "../../lib/index.js";
  import {
    initMarkdownMermaidRendering,
    mermaidCodeFence,
  } from "../../lib/utils/markdown-mermaid.js";
  import DemoSection from "../DemoSection.svelte";

  function swatch(label: string, fill: string, width = 480, height = 280): string {
    return (
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <rect width="100%" height="100%" fill="${fill}"/>
          <text x="50%" y="50%" font-family="sans-serif" font-size="32" fill="#fff"
            text-anchor="middle" dominant-baseline="middle">${label}</text>
        </svg>`,
      )
    );
  }

  const direct: MediaViewerItem[] = [
    { kind: "image", src: swatch("First", "#6366f1"), alt: "First swatch" },
    { kind: "image", src: swatch("Second", "#22c55e", 280, 480), alt: "Second swatch" },
    { kind: "image", src: swatch("Third", "#f97316", 1600, 400), alt: "Third swatch" },
  ];
  let directOpen = $state(false);
  let directIndex = $state(0);

  const renderer = createMarkdownRenderer({ codeFence: mermaidCodeFence });
  const markdownSource = `Markdown images get an expand button on hover:

![Screenshot A](${swatch("Screenshot A", "#0ea5e9")})

A diagram sits between them:

\`\`\`mermaid
graph LR
  A[Image] --> B[Diagram] --> C[Image]
\`\`\`

![Screenshot B](${swatch("Screenshot B", "#a855f7")})
`;
  const hiddenDocument = `![Hidden tab image](${swatch("Hidden tab", "#ef4444")})`;

  let tab = $state("visible");

  // One controller per concern, both on this page's subtree; expanding
  // any item pages through every displayed item on the page.
  function markdownMedia(node: HTMLElement) {
    const images = initMarkdownImageViewer(node);
    const diagrams = initMarkdownMermaidRendering(node);
    return () => {
      images.disconnect();
      diagrams.disconnect();
    };
  }
</script>

<DemoSection
  title="Direct use"
  description="MediaViewer takes a list of items and pages between them with the arrow buttons or the Left/Right keys, wrapping at the ends. Drag to pan, wheel to zoom, reset to go back. Images never upscale; the panel is 90% of the viewport."
  code={`<MediaViewer items={[{ kind: "image", src, alt }, …]} bind:index onclose={close} />`}
>
  <Button onclick={() => (directOpen = true)}>Open viewer</Button>
  {#if directOpen}
    <MediaViewer items={direct} bind:index={directIndex} onclose={() => (directOpen = false)} />
  {/if}
</DemoSection>

<div class="media-demo-page" {@attach markdownMedia}>
  <DemoSection
    title="Page gallery"
    description="Markdown images (initMarkdownImageViewer), Mermaid diagrams, and ImagePreview all register with one page gallery. Expanding any of them pages through every item currently displayed, in page order. The image in the inactive tab is skipped until its tab is shown."
    code={`import "@kenn-io/kit-ui/markdown-images.css";
import { initMarkdownImageViewer } from "@kenn-io/kit-ui";

const controller = initMarkdownImageViewer(document); // once at startup`}
  >
    <Markdown {renderer} source={markdownSource} />
    <ImagePreview src={swatch("ImagePreview", "#14b8a6")} alt="ImagePreview swatch" />
    <SegmentedControl
      ariaLabel="Demo tabs"
      options={[
        { value: "visible", label: "Visible tab" },
        { value: "other", label: "Other tab" },
      ]}
      value={tab}
      onchange={(value) => (tab = value)}
    />
    <div class="media-demo-tab" data-testid="tab-visible" hidden={tab !== "visible"}>
      <p>Nothing expandable in this tab.</p>
    </div>
    <div class="media-demo-tab" data-testid="tab-other" hidden={tab !== "other"}>
      <Markdown {renderer} source={hiddenDocument} />
    </div>
  </DemoSection>
</div>

<style>
  .media-demo-tab {
    margin-top: var(--space-6);
  }
</style>
