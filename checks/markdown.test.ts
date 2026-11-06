import { describe, expect, test } from "bun:test";
import { Marked, type Tokens } from "marked";
import {
  applyMarkdownAlerts,
  codeFenceLanguage,
  codeHighlightPlan,
  allowedShikiStyle,
  escapeHtml,
  SHIKI_MAX_DISTINCT_LANGUAGES,
  SHIKI_MAX_HIGHLIGHTED_FENCES,
} from "../src/lib/utils/markdown.js";

// The DOM-dependent halves of the pipeline (DOMPurify sanitization, shiki
// rendering, the CodeBlock/Markdown components) are covered by the browser
// test infra work — these tests pin the pure decision logic.

describe("codeFenceLanguage", () => {
  test("first word, lowercased", () => {
    expect(codeFenceLanguage("TS {1,3}")).toBe("ts");
    expect(codeFenceLanguage("python")).toBe("python");
  });

  test("empty/undefined → text", () => {
    expect(codeFenceLanguage(undefined)).toBe("text");
    expect(codeFenceLanguage("  ")).toBe("text");
  });
});

describe("escapeHtml", () => {
  test("escapes markup-significant characters, quotes included", () => {
    // Quotes are escaped so the helper is safe inside attribute values,
    // not just text content — codeFence interceptors use it for both.
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      `&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;`,
    );
  });
});

describe("allowedShikiStyle", () => {
  test("keeps shiki custom properties with hex colors", () => {
    expect(allowedShikiStyle("--shiki-light:#24292e;--shiki-dark:#e1e4e8")).toBe(
      "--shiki-light:#24292e;--shiki-dark:#e1e4e8",
    );
    expect(allowedShikiStyle("--shiki-light-bg:#fff")).toBe("--shiki-light-bg:#fff");
  });

  test("keeps a bold token's colors and drops its font hints", () => {
    expect(
      allowedShikiStyle(
        "--shiki-light:#0550AE;--shiki-light-font-weight:bold;--shiki-dark:#79C0FF;--shiki-dark-font-weight:bold",
      ),
    ).toBe("--shiki-light:#0550AE;--shiki-dark:#79C0FF");
  });

  test("drops anything else in the style channel", () => {
    expect(allowedShikiStyle("color:#fff")).toBe("");
    expect(allowedShikiStyle("--shiki-light:url(evil)")).toBe("");
    expect(allowedShikiStyle("--shiki-light:#fff;position:fixed")).toBe("--shiki-light:#fff");
    expect(allowedShikiStyle("")).toBe("");
  });
});

describe("codeHighlightPlan", () => {
  const marked = new Marked({ gfm: true });
  const fence = (lang: string, body = "x") => `\`\`\`${lang}\n${body}\n\`\`\``;

  function plan(md: string, skip?: (code: string, lang: string) => boolean) {
    const tokens = marked.lexer(md) as Tokens.Generic[];
    const result = codeHighlightPlan(marked, tokens, skip);
    const planned = tokens.filter((t) => t.type === "code" && result.tokens.has(t as Tokens.Code));
    return { ...result, plannedCount: planned.length };
  }

  test("collects distinct languages", () => {
    const { languages, plannedCount } = plan(
      [fence("ts"), fence("python"), fence("ts")].join("\n\n"),
    );
    expect(languages.sort()).toEqual(["python", "ts"]);
    expect(plannedCount).toBe(3);
  });

  test("fence budget caps the number of highlighted blocks", () => {
    const md = Array.from({ length: SHIKI_MAX_HIGHLIGHTED_FENCES + 5 }, () => fence("ts")).join(
      "\n\n",
    );
    expect(plan(md).plannedCount).toBe(SHIKI_MAX_HIGHLIGHTED_FENCES);
  });

  test("distinct-language budget: extra languages render plain", () => {
    const md = Array.from({ length: SHIKI_MAX_DISTINCT_LANGUAGES + 2 }, (_, i) =>
      fence(`lang${i}`),
    ).join("\n\n");
    const { languages, plannedCount } = plan(md);
    expect(languages).toHaveLength(SHIKI_MAX_DISTINCT_LANGUAGES);
    expect(plannedCount).toBe(SHIKI_MAX_DISTINCT_LANGUAGES);
  });

  test("byte budget skips oversized fences but keeps later small ones", () => {
    const huge = "x".repeat(200_000);
    const { plannedCount } = plan([fence("ts", huge), fence("ts")].join("\n\n"));
    expect(plannedCount).toBe(1);
  });

  test("skip predicate excludes intercepted fences (mermaid)", () => {
    const md = [fence("mermaid", "graph TD"), fence("ts")].join("\n\n");
    const { languages, plannedCount } = plan(md, (_, lang) => lang === "mermaid");
    expect(languages).toEqual(["ts"]);
    expect(plannedCount).toBe(1);
  });

  test("plaintext fences highlight without consuming a language slot", () => {
    const { languages, plannedCount } = plan([fence(""), fence("text")].join("\n\n"));
    expect(languages).toEqual([]);
    expect(plannedCount).toBe(2);
  });
});

describe("applyMarkdownAlerts", () => {
  const marked = new Marked({ gfm: true, breaks: true });
  const lex = (src: string, breaks = true) => {
    const tokens = new Marked({ gfm: true, breaks }).lexer(src) as Tokens.Generic[];
    applyMarkdownAlerts(tokens);
    return tokens.filter((t) => t.type === "blockquote") as (Tokens.Blockquote & {
      kitAlert?: string;
    })[];
  };
  // Blank lines lex as `space` tokens, which render nothing.
  const blockTypes = (quote: Tokens.Blockquote) =>
    quote.tokens.map((t) => t.type).filter((type) => type !== "space");

  test("tags each alert kind, case-insensitively", () => {
    const kinds = ["NOTE", "tip", "Important", "WARNING", "CAUTION"].map(
      (kind) => lex(`> [!${kind}]\n> body`)[0]!.kitAlert,
    );
    expect(kinds).toEqual(["note", "tip", "important", "warning", "caution"]);
  });

  test("drops the marker line and keeps inline markup", () => {
    for (const breaks of [true, false]) {
      const [quote] = lex("> [!TIP]\n> Run **check** first\n>\n> - one\n> - two", breaks);
      expect(blockTypes(quote!)).toEqual(["paragraph", "list"]);
      const paragraph = quote!.tokens[0] as Tokens.Paragraph;
      expect(paragraph.tokens[0]).toMatchObject({ type: "text", text: "Run " });
      expect(paragraph.tokens.some((t) => t.type === "strong")).toBe(true);
    }
  });

  test("keeps reference links and images resolved against the document", () => {
    const [quote] = lex("> [!NOTE]\n> See [docs][1] and ![logo][1].\n\n[1]: https://example.com\n");
    const inline = (quote!.tokens[0] as Tokens.Paragraph).tokens;
    expect(inline.find((t) => t.type === "link")).toMatchObject({ href: "https://example.com" });
    expect(inline.find((t) => t.type === "image")).toMatchObject({ href: "https://example.com" });
  });

  test("keeps the rest of the alert when the marker has its own paragraph", () => {
    const [quote] = lex("> [!NOTE]\n>\n> body");
    expect(quote!.kitAlert).toBe("note");
    expect(blockTypes(quote!)).toEqual(["paragraph"]);
    expect(quote!.tokens.find((t) => t.type === "paragraph")!.text).toBe("body");
  });

  test("leaves ordinary quotes alone", () => {
    expect(lex("> plain quote")[0]!.kitAlert).toBeUndefined();
    // Text after the marker on the same line is not an alert on GitHub.
    expect(lex("> [!NOTE] inline\n> body")[0]!.kitAlert).toBeUndefined();
    expect(lex("> [!DANGER]\n> body")[0]!.kitAlert).toBeUndefined();
  });

  test("ignores alerts nested in other blocks", () => {
    const tokens = marked.lexer("- item\n\n  > [!NOTE]\n  > nested") as Tokens.Generic[];
    applyMarkdownAlerts(tokens);
    let tagged = false;
    marked.walkTokens(tokens, (t) => {
      if ((t as { kitAlert?: string }).kitAlert) tagged = true;
    });
    expect(tagged).toBe(false);
  });
});
