// Renders Markdown, a code block, a Mermaid diagram, and a VideoPlayer for
// strict-csp.spec.ts, which serves this page under a policy that blocks
// inline styles and WebAssembly. Served by the Vite dev server, which
// resolves the bare imports.
import { mount } from "svelte";
import CodeBlock from "../../../src/lib/components/CodeBlock.svelte";
import Markdown from "../../../src/lib/components/Markdown.svelte";
import VideoPlayer from "../../../src/lib/components/VideoPlayer.svelte";
import clip from "../../../src/demo/assets/media-viewer-demo.webm";
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
const video = document.createElement("section");
video.dataset["testid"] = "video";
video.style.width = "480px";
main.append(markdown, codeBlock, video);

mount(Markdown, {
  target: markdown,
  props: { source, renderer: createMarkdownRenderer({ codeFence: mermaidCodeFence }) },
});
mount(CodeBlock, { target: codeBlock, props: { code: "const total = 1;", language: "ts" } });
initMarkdownMermaidRendering(markdown);
mount(VideoPlayer, { target: video, props: { src: clip, label: "Test pattern video" } });
