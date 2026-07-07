<script lang="ts">
  import { createMarkdownRenderer, Markdown } from "../../lib/index.js";
  import {
    initMarkdownMermaidRendering,
    mermaidCodeFence,
  } from "../../lib/utils/markdown-mermaid.js";
  import DemoSection from "../DemoSection.svelte";

  const renderer = createMarkdownRenderer({ codeFence: mermaidCodeFence });

  // The post-processor watches this page's subtree: fences render as
  // diagrams whenever the markdown above re-renders or the theme flips.
  function mermaidRendering(node: HTMLElement) {
    const controller = initMarkdownMermaidRendering(node);
    return () => controller.disconnect();
  }

  const flowchart = `Diagrams ride the normal markdown pipeline — a \`\`\`mermaid fence
becomes a themed pan/zoom viewer (drag to pan, wheel to zoom):

\`\`\`mermaid
graph LR
  A[Markdown source] --> B(createMarkdownRenderer)
  B -->|mermaidCodeFence| C{pre.mermaid}
  C --> D[initMarkdownMermaidRendering]
  D --> E[Pan/zoom viewer]
  D --> F[Expanded lightbox]
\`\`\`
`;

  const sequence = `\`\`\`mermaid
sequenceDiagram
  participant App
  participant kit-ui
  participant mermaid
  App->>kit-ui: initMarkdownMermaidRendering(root)
  kit-ui->>mermaid: dynamic import on first diagram
  mermaid-->>kit-ui: themed svg
  kit-ui-->>App: viewer with copy / expand / reset
\`\`\`
`;

  const invalid = `Invalid diagrams keep their source visible instead of erroring:

\`\`\`mermaid
graph TD
  A--> % not mermaid %
\`\`\`
`;
</script>

<div {@attach mermaidRendering}>
  <DemoSection
    title="Mermaid"
    description="Opt-in mermaid rendering for markdown documents. mermaid is an optional peer dependency, dynamically imported on first use — import the util from its subpath (it is deliberately not in the library barrel) plus mermaid.css, and pass mermaidCodeFence to your renderer."
    code={`import "@kenn-io/kit-ui/mermaid.css"; // alongside theme.css
import {
  initMarkdownMermaidRendering,
  mermaidCodeFence,
} from "@kenn-io/kit-ui/utils/markdown-mermaid";

const renderer = createMarkdownRenderer({ codeFence: mermaidCodeFence });
const controller = initMarkdownMermaidRendering(document); // once at startup
`}
  >
    <Markdown {renderer} source={flowchart} />
  </DemoSection>

  <DemoSection
    title="Sequence diagram"
    description="Diagram colors come from the --mermaid-* tokens in mermaid.css; toggling the theme re-renders every diagram in place."
  >
    <Markdown {renderer} source={sequence} />
  </DemoSection>

  <DemoSection
    title="Failure fallback"
    description="Renders are strict-sandboxed (no HTML labels, style attributes stripped) and budgeted per document; a diagram that fails to parse falls back to its escaped source."
  >
    <Markdown {renderer} source={invalid} />
  </DemoSection>
</div>
