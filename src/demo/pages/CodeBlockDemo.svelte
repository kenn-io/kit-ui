<script lang="ts">
  import { CodeBlock } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  const tsSample = `interface Session {
  id: string;
  title: string;
  status: "working" | "waiting" | "stale";
}

export function activeSessions(sessions: Session[]): Session[] {
  // Waiting sessions sort first so the user sees what needs them.
  return sessions
    .filter((s) => s.status !== "stale")
    .sort((a, b) => Number(b.status === "waiting") - Number(a.status === "waiting"));
}`;

  const bashSample = `bun install
bun run dev      # demo gallery
bun run check    # svelte-check — must stay at 0 errors / 0 warnings`;

  const longLine = `const url = "https://example.com/api/v1/sessions?filter=active&sort=updated_at&direction=desc&page_size=100&include=labels,participants,latest_message&fields=id,title,status";`;

  const plainSample = `2026-07-01T19:28:42Z INFO  server listening on :8080
2026-07-01T19:28:43Z DEBUG connected to database
2026-07-01T19:28:44Z WARN  cache miss rate above 20%`;
</script>

<DemoSection
  title="Highlighted code"
  description="Shiki dual-theme highlighting (github-light/dark via CSS variables — toggle the gallery theme). Grammar chunks load on demand; the escaped plain rendering shows until then. The header has the language label, a wrap toggle, and a CopyButton."
  code={`<CodeBlock code={source} language="ts" />`}
>
  <CodeBlock code={tsSample} language="ts" />
</DemoSection>

<DemoSection
  title="Line numbers + title"
  description="lineNumbers adds a CSS-counter gutter (works for plain and highlighted output). title replaces the language label — use it for filenames."
  code={`<CodeBlock code={source} language="bash" title="README.md — commands" lineNumbers />`}
>
  <CodeBlock code={bashSample} language="bash" title="README.md — commands" lineNumbers />
</DemoSection>

<DemoSection
  title="Wrap toggle"
  description="Long lines scroll horizontally by default; the wrap button (or wrap prop, bindable) soft-wraps them."
  code={`<CodeBlock code={longLine} language="ts" wrap />`}
>
  <CodeBlock code={longLine} language="ts" wrap />
</DemoSection>

<DemoSection
  title="Plain / unknown language"
  description="No language (or an unknown one) renders escaped plain text — same chrome, no highlight pass. maxHeight caps the body with a scroll."
  code={`<CodeBlock code={log} maxHeight="120px" wrapToggle={false} />`}
>
  <CodeBlock code={plainSample} maxHeight="120px" wrapToggle={false} />
</DemoSection>
