// Renders Markdown, a code block, and a Mermaid diagram for
// strict-csp.spec.ts, which serves this page under a policy that blocks
// inline styles and WebAssembly. Served by the Vite dev server, which
// resolves the bare imports.
import { mount } from "svelte";
import CodeBlock from "../../../src/lib/components/CodeBlock.svelte";
import Markdown from "../../../src/lib/components/Markdown.svelte";
import { createMarkdownRenderer } from "../../../src/lib/utils/markdown.ts";
import {
  initMarkdownMermaidRendering,
  mermaidCodeFence,
} from "../../../src/lib/utils/markdown-mermaid.ts";

const source = [
  "```ts",
  "const total = 1;",
  "```",
  "",
  "```diff",
  "@@ -1 +1 @@",
  "```",
  "",
  "```mermaid",
  "graph LR",
  "  A[Start] --> B[Finish]",
  "```",
].join("\n");

const main = document.querySelector("main")!;
const markdown = document.createElement("section");
markdown.dataset["testid"] = "markdown";
const codeBlock = document.createElement("section");
codeBlock.dataset["testid"] = "code-block";
main.append(markdown, codeBlock);

mount(Markdown, {
  target: markdown,
  props: { source, renderer: createMarkdownRenderer({ codeFence: mermaidCodeFence }) },
});
mount(CodeBlock, { target: codeBlock, props: { code: "const total = 1;", language: "ts" } });
initMarkdownMermaidRendering(markdown);
