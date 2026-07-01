# CodeBlock + Markdown pipeline

Three pieces that compose: a **markdown pipeline**
(`utils/markdown` — marked → shiki → DOMPurify), a **CodeBlock**
component for standalone code, and a **Markdown** component that renders
a whole document. Consolidated from middleman's `packages/ui` markdown
util and agentsview's renderer; the app-specific parts those carried
(issue/PR reference linking, bash-wrapper tags, interactive task lists)
stay app-side, injected through options.

Peer dependencies: `marked@^18`, `shiki@^4`, `dompurify@^3` (the versions
both apps already ship). Browser-only — DOMPurify needs a DOM.

## CodeBlock

```svelte
<script lang="ts">
  import { CodeBlock } from "@kenn-io/kit-ui";
</script>

<CodeBlock code={source} language="ts" title="session.ts" lineNumbers />
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `code` | `string` | required | |
| `language` | `string` | — | Fence language; omitted/unknown renders escaped plain text |
| `title` | `string` | — | Header label (filename); defaults to the language |
| `lineNumbers` | `boolean` | `false` | CSS-counter gutter (plain and highlighted output) |
| `wrap` | `boolean` (bindable) | `false` | Soft-wrap long lines |
| `wrapToggle` | `boolean` | `true` | Show the header wrap button |
| `copyable` | `boolean` | `true` | Show the CopyButton |
| `maxHeight` | `string` | — | Cap the body height (scrolls beyond) |
| `copyLabel` / `wrapLabel` | `string` | English defaults | i18n |
| `class` | `string` | `""` | |

Highlighting is async — grammar chunks load on demand and the escaped
plain rendering shows until then (and stays for unknown languages or
over-budget content, >100 KB). The surface uses kit-ui tokens
(`--bg-inset`, `--border-muted`, `--font-mono`); shiki contributes token
colors only.

### Dual-theme highlighting

Shiki emits `--shiki-light`/`--shiki-dark` custom properties per token
(`defaultColor: false` — no baked colors); component CSS switches on
`html.dark`, so code follows the theme with **no re-render**. Themes:
`github-light-default` / `github-dark-default`.

## Markdown

```svelte
<script lang="ts">
  import { Markdown } from "@kenn-io/kit-ui";
</script>

<Markdown source={text} />
```

GFM (tables, task lists, strikethrough, `breaks: true`), fences
highlighted within budgets, everything sanitized. The previous document
stays visible during a re-render, and a stale async render never
overwrites a newer one. Pass `renderer` (below) for app syntax. Prose
styles are namespaced under `.kit-markdown` and use theme tokens.

## Pipeline (`utils/markdown`)

```ts
import {
  renderMarkdown,        // async: Promise<string>, highlighted fences
  renderMarkdownSync,    // sync: highlights only already-loaded grammars
  createMarkdownRenderer,
  highlightCode,         // one block → shiki HTML | null (CodeBlock uses this)
} from "@kenn-io/kit-ui"; // or "@kenn-io/kit-ui/utils/markdown"
```

`createMarkdownRenderer(options)` is the app extension point — create one
per app and reuse it (each instance owns a Marked instance and a render
cache, cleared past 500 entries):

```ts
const renderer = createMarkdownRenderer({
  // marked tokenizer/renderer extensions (issue refs, wrapper tags)
  extensions: [myItemRefExtension],
  // intercept fences (mermaid, custom viewers); undefined falls through
  codeFence: (code, lang) =>
    lang === "mermaid" ? `<pre class="mermaid">${escapeHtml(code)}</pre>` : undefined,
  // extra attributes sanitization keeps (for extension-emitted markup)
  allowedAttributes: ["data-item-ref"],
});
```

### Security model

- Output is always DOMPurify-sanitized — script/event-handler/URL attacks
  in the source markdown (or produced by an extension) are stripped.
  `codeFence` HTML goes through the same pass.
- Inline `style` attributes are stripped everywhere **except** on
  shiki-generated nodes: those are tagged with a per-render nonce and may
  only carry `--shiki-*: #hex` declarations. A crafted document that
  fakes `<pre class="shiki">` markup can't smuggle CSS — it lacks the
  nonce.
- `highlightCode` output is shiki-generated from a plain string (shiki
  escapes the code text), so CodeBlock renders it without a DOMPurify
  pass.

### Highlighting budgets

Per document: 20 fences, 8 distinct languages, 100 KB of code — beyond
these, remaining fences render as escaped plain text (main-thread and
grammar-fetch protection). Constants are exported
(`SHIKI_MAX_HIGHLIGHTED_FENCES`, …); the planner is pure and unit-tested
(`checks/markdown.test.ts`).

## Migrating the apps

- **middleman** `renderMarkdown(raw, repo, opts)` → a
  `createMarkdownRenderer({ extensions: [providerItemRefExtension(repo)] })`
  per repo context; interactive task lists (checkbox indexes, drag
  handles) remain a middleman renderer concern layered on top. The block
  slicer (`renderMarkdownBlocks`) is middleman-specific and stays there.
- **agentsview** `renderMarkdown(text)` → default renderer plus its
  bash-wrapper tokenizer extensions via `extensions`; `asset://` URL
  resolution stays an app-side pre-pass; per-message `CodeBlock` swaps to
  kit-ui's (search-mark integration hooks pending the browser test infra
  work).
