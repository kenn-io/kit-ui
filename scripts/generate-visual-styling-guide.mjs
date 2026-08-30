import { access, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const outputPath = "output/pdf/kit-ui-visual-styling-guide.pdf";

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>kit-ui visual styling guide</title>
    <style>
      @page { size: Letter; margin: 0; }

      :root {
        --ink: #181b24;
        --text-secondary: #555b6e;
        --text-muted: #878ea0;
        --blue: #2563eb;
        --blue-soft: #eff6ff;
        --line: #d8dae2;
        --surface: #f5f6f8;
      }

      * { box-sizing: border-box; }

      html, body {
        width: 8.5in;
        height: 11in;
        margin: 0;
      }

      body {
        color: var(--ink);
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        font-size: 11px;
        line-height: 1.42;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 11in;
        padding: 0.55in 0.58in 0.5in;
        border-top: 8px solid var(--blue);
      }

      h1 {
        margin: 0 0 1px;
        font-size: 30px;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }

      .subtitle {
        margin: 0 0 18px;
        color: var(--text-secondary);
        font-size: 12.5px;
      }

      h2 {
        margin: 15px 0 7px;
        font-size: 17px;
        line-height: 1.2;
      }

      p { margin: 0 0 7px; color: var(--text-secondary); }
      a { color: var(--blue); text-decoration: underline; }

      pre {
        margin: 6px 0 0;
        padding: 10px 12px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: var(--surface);
        color: var(--ink);
        font: 10.5px/1.45 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        white-space: pre-wrap;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th, td {
        padding: 7px 9px;
        border: 1px solid var(--line);
        text-align: left;
        vertical-align: middle;
      }

      th {
        background: var(--ink);
        color: white;
        font-weight: 600;
      }

      th:first-child, td:first-child { width: 51%; }
      tbody tr:nth-child(even) { background: var(--surface); }

      code {
        color: var(--ink);
        font: 10px/1.35 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      }

      .note {
        margin-top: 7px;
        padding: 8px 10px;
        border: 1px solid #bfdbfe;
        background: var(--blue-soft);
        color: #1e40af;
        font-weight: 600;
      }

      .preview-copy { margin-top: 8px; }

      .closing {
        margin-top: 11px;
        color: var(--text-secondary);
      }

      .more {
        color: var(--text-muted);
        font-size: 9.5px;
      }

      footer {
        display: flex;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 7px;
        border-top: 1px solid var(--line);
        color: var(--text-muted);
        font-size: 9px;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <h1>kit-ui visual styling guide</h1>
      <p class="subtitle">A quick reference for designers changing colors, typography, spacing, themes, or component styling.</p>

      <h2>Before you start</h2>
      <p>
        Install <a href="https://git-scm.com/downloads/">Git</a> and
        <a href="https://bun.sh/docs/installation">Bun</a>. You will also need a code editor.
        <a href="https://code.visualstudio.com/download">Visual Studio Code</a> is a common choice.
      </p>
      <pre>git clone https://github.com/kenn-io/kit-ui.git
cd kit-ui
bun install</pre>

      <h2>Where to make changes</h2>
      <table aria-label="Files used for visual styling">
        <thead>
          <tr><th>What you want to change</th><th>File</th></tr>
        </thead>
        <tbody>
          <tr><td>Default colors, type, spacing, radii, shadows, and layout</td><td><code>src/lib/brand.json</code></td></tr>
          <tr><td>Named themes, including their light and dark versions</td><td><code>src/lib/themes.css</code></td></tr>
          <tr><td>One component's appearance</td><td><code>src/lib/components/&lt;ComponentName&gt;.svelte</code></td></tr>
          <tr><td>Fonts and font files</td><td><code>src/lib/fonts.css</code><br /><code>src/lib/fonts/</code></td></tr>
          <tr><td>Logo and favicon</td><td><code>src/lib/brand-assets/</code></td></tr>
          <tr><td>Theme textures</td><td><code>src/lib/textures/</code></td></tr>
          <tr><td>Gallery-only styling</td><td><code>src/demo/demo.css</code></td></tr>
        </tbody>
      </table>
      <div class="note">
        Do not edit <code>src/lib/brand.css</code>. The project generates it from <code>brand.json</code>.
        When replacing the logo, favicon, or default sans/mono font, update its asset path and SHA-256 in
        <code>brand.json</code>, then run <code>bun run generate:brand</code>.
      </div>

      <h2>Preview your changes</h2>
      <p>If you changed <code>brand.json</code>, regenerate the CSS first. Then start the component gallery:</p>
      <pre>bun run generate:brand   # only after changing brand.json
bun run dev</pre>
      <p class="preview-copy">
        Open the URL printed in the terminal, usually <a href="http://localhost:5173">http://localhost:5173</a>.
        The gallery updates as you save files. Use <strong>Theme tokens</strong> for the default system,
        <strong>Themes</strong> for named themes, <strong>Mobile preview</strong> for smaller screens,
        and the individual component pages for focused checks.
      </p>

      <h2>Production preview</h2>
      <pre>bun run build
bun run preview</pre>

      <p class="closing">Before sharing a change, check the relevant components in light mode, dark mode, and Mobile preview.</p>
      <p class="more">
        More detail: <code>docs/branding.md</code> and <code>docs/theming.md</code> in the
        <a href="https://github.com/kenn-io/kit-ui">kit-ui repository</a>.
      </p>

      <footer><span>kit-ui visual styling guide</span><span>kenn-io / kit-ui</span></footer>
    </main>
  </body>
</html>`;

try {
  await access(chromium.executablePath());
} catch {
  throw new Error(
    "Playwright Chromium is not installed. Run `bunx playwright install chromium`, then run this command again.",
  );
}

await mkdir("output/pdf", { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
} finally {
  await browser.close();
}

console.log(outputPath);
