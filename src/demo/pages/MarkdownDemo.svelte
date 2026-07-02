<script lang="ts">
  import { createMarkdownRenderer, escapeHtml, Markdown } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const sample = `# Release notes

The **markdown pipeline** renders GFM through \`marked\`, highlights fences
with shiki, and sanitizes everything with DOMPurify.

## What's included

- Tables, task lists, ~~strikethrough~~ and [links](https://example.com)
- Dual-theme code highlighting — try the theme toggle:

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Feature | Status |
| --- | --- |
| Sanitization | always on |
| Grammar loading | on demand |

- [x] port the pipeline
- [ ] adopt it in the apps

> Raw HTML is sanitized: <img src=x onerror="alert(1)"> becomes an inert image.
`;

  // App-specific syntax goes in through a custom renderer — here a fence
  // interceptor that turns ```callout fences into a styled block. The
  // interceptor owns escaping: fence text is user-authored source, not
  // markup.
  const renderer = createMarkdownRenderer({
    codeFence: (code, lang) =>
      lang === "callout"
        ? `<blockquote class="demo-callout">${escapeHtml(code)}</blockquote>`
        : undefined,
  });

  const calloutSample = `Fences an app claims never reach the highlighter:

\`\`\`callout
Deploys freeze Friday 5pm — see the runbook.
\`\`\`
`;
</script>

<DemoSection
  title="Markdown"
  description="GFM rendering with sanitization and on-demand shiki highlighting. The previous document stays visible during re-renders; a stale async render never overwrites a newer one."
  code={`import { Markdown } from "@kenn-io/kit-ui";

<Markdown source={text} />`}
>
  <Markdown source={sample} />
</DemoSection>

<DemoSection
  title="Custom renderer (app extensions)"
  description="createMarkdownRenderer() is the injection point for app-specific syntax: marked extensions (issue refs, wrapper tags) and codeFence interceptors (mermaid, custom viewers). The intercepted HTML still goes through sanitization."
  code={`const renderer = createMarkdownRenderer({
  // the interceptor owns escaping — fence text is source, not markup
  codeFence: (code, lang) =>
    lang === "callout" ? \`<blockquote class="demo-callout">\${escapeHtml(code)}</blockquote>\` : undefined,
});

<Markdown source={text} {renderer} />`}
>
  <Markdown source={calloutSample} {renderer} />
</DemoSection>

<style>
  :global(.demo-callout) {
    padding: var(--space-4) var(--space-5) !important;
    border-left-color: var(--accent-amber) !important;
    background: color-mix(in srgb, var(--accent-amber) 8%, transparent);
    border-radius: var(--radius-sm);
  }
</style>
