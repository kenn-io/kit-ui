/**
 * Markdown rendering pipeline: marked (GFM) → shiki-highlighted code
 * fences → DOMPurify sanitization. Consolidated from middleman's
 * packages/ui markdown util and agentsview's renderer; the app-specific
 * pieces those carried (issue/PR reference linking, bash-wrapper tags,
 * interactive task lists) stay app-side, injected through the
 * `extensions` / `codeFence` options instead of being baked in.
 *
 * Highlighting is dual-theme: shiki emits `--shiki-light`/`--shiki-dark`
 * per-token CSS variables (no baked colors) and the component styles
 * (CodeBlock, Markdown) switch on `html.dark`, so code follows the
 * kit-ui theme without re-rendering.
 *
 * Security model: rendered HTML is DOMPurify-sanitized. Inline `style`
 * attributes are stripped everywhere EXCEPT on shiki-generated nodes,
 * which are tagged with a per-render nonce and only allowed to carry
 * `--shiki-*` custom-property declarations with hex-color values — a
 * crafted markdown document can't smuggle arbitrary CSS through the
 * highlighter's style channel.
 */

import DOMPurify from "dompurify";
import type { UponSanitizeAttributeHook } from "dompurify";
import {
  Marked,
  type RendererObject,
  type Tokens,
  type TokenizerAndRendererExtension,
} from "marked";
import {
  getSingletonHighlighter,
  type BundledLanguage,
  type Highlighter,
} from "shiki";

const SHIKI_LIGHT_THEME = "github-light-default";
const SHIKI_DARK_THEME = "github-dark-default";
const SHIKI_THEMES = { light: SHIKI_LIGHT_THEME, dark: SHIKI_DARK_THEME } as const;
const SHIKI_PLAINTEXT_LANG = "text";
const SHIKI_GENERATED_ATTR = "data-kit-shiki";

// Highlighting budgets per document — beyond these, remaining fences
// render as escaped plain text instead of stalling the main thread or
// fetching endless grammar chunks.
export const SHIKI_MAX_HIGHLIGHTED_FENCES = 20;
export const SHIKI_MAX_DISTINCT_LANGUAGES = 8;
export const SHIKI_MAX_HIGHLIGHTED_BYTES = 100_000;

let shikiHighlighter: Highlighter | undefined;
let shikiHighlighterPromise: Promise<Highlighter> | undefined;
let shikiNonceFallbackCounter = 0;

function getShikiHighlighter(): Promise<Highlighter> {
  shikiHighlighterPromise ??= getSingletonHighlighter({
    themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
    langs: [],
  }).then(
    (highlighter) => {
      shikiHighlighter = highlighter;
      return highlighter;
    },
    (error: unknown) => {
      // Don't cache a rejection — a later render may retry (transient
      // network failure loading the theme chunks).
      shikiHighlighterPromise = undefined;
      throw error;
    },
  );
  return shikiHighlighterPromise;
}

/** First word of a fence info string, lowercased ("ts {1,3}" → "ts"). */
export function codeFenceLanguage(lang: string | undefined): string {
  return (lang ?? "").trim().split(/\s+/, 1)[0]?.toLowerCase() || SHIKI_PLAINTEXT_LANG;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainCodeBlock(text: string): string {
  return `<pre><code>${escapeHtml(text)}</code></pre>`;
}

function shikiNonce(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${shikiNonceFallbackCounter++}`;
}

const SHIKI_STYLE_PROPERTY = /^--shiki-(?:light|dark)(?:-bg)?$/;
const SHIKI_STYLE_VALUE = /^#[0-9a-fA-F]{3,8}$/;

/** True when a style attribute contains only `--shiki-*: #hex`
 * declarations — the only inline styles sanitization lets through. */
export function shikiStyleIsAllowed(value: string): boolean {
  const declarations = value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);
  if (declarations.length === 0) return false;
  return declarations.every((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator <= 0) return false;
    const property = declaration.slice(0, separator).trim();
    const styleValue = declaration.slice(separator + 1).trim();
    return SHIKI_STYLE_PROPERTY.test(property) && SHIKI_STYLE_VALUE.test(styleValue);
  });
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

interface CodeHighlightPlan {
  tokens: WeakSet<Tokens.Code>;
  languages: string[];
}

function isCodeToken(token: Tokens.Generic): token is Tokens.Code {
  return token.type === "code" && typeof token.text === "string";
}

/** Walk lexed tokens and pick which fences get highlighted within the
 * budgets (fence count, distinct languages, total bytes) — exported for
 * tests. */
export function codeHighlightPlan(
  marked: Marked,
  tokens: Tokens.Generic[],
  skip?: (code: string, lang: string) => boolean,
): CodeHighlightPlan {
  const highlightedTokens = new WeakSet<Tokens.Code>();
  const languages = new Set<string>();
  let highlightedFences = 0;
  let highlightedBytes = 0;

  marked.walkTokens(tokens, (token) => {
    if (!isCodeToken(token)) return;
    const lang = codeFenceLanguage(token.lang);
    if (skip?.(token.text, lang)) return;
    if (highlightedFences >= SHIKI_MAX_HIGHLIGHTED_FENCES) return;

    const textBytes = utf8ByteLength(token.text);
    if (highlightedBytes + textBytes > SHIKI_MAX_HIGHLIGHTED_BYTES) return;

    if (
      lang !== SHIKI_PLAINTEXT_LANG &&
      !languages.has(lang) &&
      languages.size >= SHIKI_MAX_DISTINCT_LANGUAGES
    ) {
      return;
    }

    highlightedTokens.add(token);
    highlightedFences++;
    highlightedBytes += textBytes;
    if (lang !== SHIKI_PLAINTEXT_LANG) languages.add(lang);
  });

  return { tokens: highlightedTokens, languages: [...languages] };
}

async function loadCodeFenceLanguages(languages: string[]): Promise<void> {
  if (languages.length === 0) return;
  let highlighter: Highlighter;
  try {
    highlighter = shikiHighlighter ?? (await getShikiHighlighter());
  } catch {
    // Highlighter init failed (offline, failed theme chunk) — the render
    // proceeds with every fence as escaped plain text.
    return;
  }
  for (const lang of languages) {
    if (lang === SHIKI_PLAINTEXT_LANG) continue;
    try {
      const resolved = highlighter.resolveLangAlias(lang);
      if (highlighter.getLoadedLanguages().includes(resolved)) continue;
      await highlighter.loadLanguage(lang as BundledLanguage);
    } catch {
      // Unknown fence info strings render as escaped plain text.
    }
  }
}

/**
 * Highlight one code block (dual-theme, budgeted) for direct component
 * use (CodeBlock). Resolves to the shiki `<pre class="shiki">…` HTML, or
 * null for unknown languages / over-budget content — callers fall back
 * to escaped plain text. Shiki escapes the code text itself, so the
 * output is safe for `{@html}` without a DOMPurify pass.
 */
export async function highlightCode(
  code: string,
  lang: string,
): Promise<string | null> {
  const language = codeFenceLanguage(lang);
  if (language === SHIKI_PLAINTEXT_LANG) return null;
  if (utf8ByteLength(code) > SHIKI_MAX_HIGHLIGHTED_BYTES) return null;
  // Never rejects: highlighter/theme init failures (offline, failed
  // chunk) degrade to the caller's plain rendering, same as unknown
  // languages.
  try {
    const highlighter = await getShikiHighlighter();
    const resolved = highlighter.resolveLangAlias(language);
    if (!highlighter.getLoadedLanguages().includes(resolved)) {
      await highlighter.loadLanguage(language as BundledLanguage);
    }
    return highlighter.codeToHtml(code, {
      lang: language,
      themes: SHIKI_THEMES,
      defaultColor: false,
    });
  } catch {
    return null;
  }
}

export interface MarkdownRendererOptions {
  /** Custom marked tokenizer/renderer extensions — the injection point
   * for app-specific syntax (issue references, wrapper tags). */
  extensions?: TokenizerAndRendererExtension[];
  /** Intercept specific fences (mermaid diagrams, custom viewers):
   * return HTML for the block or undefined to fall through to
   * highlighting. Contract: the returned string is markup, so the
   * interceptor MUST escape the user-authored fence text itself (use
   * `escapeHtml`) — sanitization strips dangerous nodes but cannot know
   * that `<img>` in a fence was meant as source text. Must be pure and
   * deterministic: it's called once during highlight planning and once
   * during rendering. */
  codeFence?: (code: string, lang: string) => string | undefined;
  /** Extra attributes sanitization should keep (e.g. `data-*` attributes
   * your extensions emit). `target` is always allowed. */
  allowedAttributes?: string[];
}

export interface MarkdownRenderer {
  /** Render with shiki-highlighted fences (loads grammars on demand). */
  render(raw: string): Promise<string>;
  /** Render synchronously. Fences are highlighted only when their
   * grammar is already loaded from an earlier `render`; otherwise they
   * fall back to escaped plain text. */
  renderSync(raw: string): string;
}

// Per-render state for the code renderer. Marked parses synchronously on
// a single thread, so a module-level slot is safe.
let renderState: {
  highlightedCodeTokens: WeakSet<Tokens.Code> | undefined;
  nonce: string;
  codeFence: MarkdownRendererOptions["codeFence"];
} = { highlightedCodeTokens: undefined, nonce: "", codeFence: undefined };

function markTrustedShikiHtml(html: string): string {
  const marker = `${SHIKI_GENERATED_ATTR}="${renderState.nonce}"`;
  return html.replace("<pre ", `<pre ${marker} `).replaceAll("<span ", `<span ${marker} `);
}

const codeRenderer: RendererObject = {
  code(token: Tokens.Code): string {
    const lang = codeFenceLanguage(token.lang);
    const intercepted = renderState.codeFence?.(token.text, lang);
    if (intercepted !== undefined) return intercepted;
    if (!shikiHighlighter || !renderState.highlightedCodeTokens?.has(token)) {
      return plainCodeBlock(token.text);
    }
    try {
      return markTrustedShikiHtml(
        shikiHighlighter.codeToHtml(token.text, {
          lang,
          themes: SHIKI_THEMES,
          defaultColor: false,
        }),
      );
    } catch {
      return plainCodeBlock(token.text);
    }
  },
};

const shikiStyleSanitizer: UponSanitizeAttributeHook = (node, data) => {
  if (data.attrName !== "style") return;
  const tagName = node.tagName.toLowerCase();
  const trustedShikiNode = node.getAttribute(SHIKI_GENERATED_ATTR) === renderState.nonce;
  const isStyledShikiNode =
    trustedShikiNode &&
    ((tagName === "pre" && node.classList.contains("shiki")) ||
      (tagName === "span" && node.closest("pre.shiki")));
  if (!isStyledShikiNode || !shikiStyleIsAllowed(data.attrValue)) {
    data.keepAttr = false;
  }
};

// Any element that keeps a target (e.g. target="_blank" emitted by an
// extension) must not leak an opener reference to the linked page.
const linkRelHardener = (node: Element): void => {
  if (node.tagName === "A" && node.hasAttribute("target")) {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

function sanitizeMarkdownHtml(html: string, allowedAttributes: string[]): string {
  DOMPurify.addHook("uponSanitizeAttribute", shikiStyleSanitizer);
  DOMPurify.addHook("afterSanitizeAttributes", linkRelHardener);
  try {
    const sanitized = DOMPurify.sanitize(html, {
      // <style> elements pass DOMPurify defaults but would let untrusted
      // markdown inject document-wide CSS; the only sanctioned style
      // channel is the nonce-gated --shiki-* attribute allowlist.
      FORBID_TAGS: ["style"],
      ADD_ATTR: ["target", "rel", SHIKI_GENERATED_ATTR, ...allowedAttributes],
    });
    return sanitized.replaceAll(
      new RegExp(`\\s${SHIKI_GENERATED_ATTR}="[^"]*"`, "g"),
      "",
    );
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", shikiStyleSanitizer);
    DOMPurify.removeHook("afterSanitizeAttributes", linkRelHardener);
  }
}

/** Build a renderer with app-specific options. Create one per app (or
 * per distinct option set) and reuse it — each instance owns a Marked
 * instance and an LRU-ish render cache. */
export function createMarkdownRenderer(
  options: MarkdownRendererOptions = {},
): MarkdownRenderer {
  const marked = new Marked({ gfm: true, breaks: true });
  if (options.extensions?.length) {
    marked.use({ extensions: options.extensions });
  }
  marked.use({ renderer: codeRenderer });
  const allowedAttributes = options.allowedAttributes ?? [];
  const cache = new Map<string, Promise<string>>();

  function renderTokens(
    tokens: Tokens.Generic[],
    highlightedCodeTokens?: WeakSet<Tokens.Code>,
  ): string {
    if (typeof window === "undefined") {
      // DOMPurify needs a DOM and unsanitized output must never escape —
      // fail loudly instead of returning unsafe HTML in SSR/tests.
      throw new Error(
        "kit-ui markdown rendering is browser-only (DOMPurify needs a DOM); render on the client",
      );
    }
    renderState = {
      highlightedCodeTokens,
      nonce: shikiNonce(),
      codeFence: options.codeFence,
    };
    return sanitizeMarkdownHtml(marked.parser(tokens) as string, allowedAttributes);
  }

  return {
    async render(raw: string): Promise<string> {
      if (!raw) return "";
      const cached = cache.get(raw);
      if (cached !== undefined) return cached;
      const html = (async () => {
        const tokens = marked.lexer(raw) as Tokens.Generic[];
        const skip = options.codeFence
          ? (code: string, lang: string) => options.codeFence!(code, lang) !== undefined
          : undefined;
        const plan = codeHighlightPlan(marked, tokens, skip);
        await loadCodeFenceLanguages(plan.languages);
        return renderTokens(tokens, plan.tokens);
      })();
      if (cache.size > 500) cache.clear();
      cache.set(raw, html);
      html.catch(() => cache.delete(raw));
      return html;
    },

    renderSync(raw: string): string {
      if (!raw) return "";
      const tokens = marked.lexer(raw) as Tokens.Generic[];
      const skip = options.codeFence
        ? (code: string, lang: string) => options.codeFence!(code, lang) !== undefined
        : undefined;
      const plan = shikiHighlighter ? codeHighlightPlan(marked, tokens, skip) : undefined;
      return renderTokens(tokens, plan?.tokens);
    },
  };
}

let defaultRenderer: MarkdownRenderer | undefined;

/** Render markdown with the default (no app extensions) renderer. */
export function renderMarkdown(raw: string): Promise<string> {
  defaultRenderer ??= createMarkdownRenderer();
  return defaultRenderer.render(raw);
}

/** Synchronous variant of {@link renderMarkdown} — see
 * {@link MarkdownRenderer.renderSync} for the highlighting caveat. */
export function renderMarkdownSync(raw: string): string {
  defaultRenderer ??= createMarkdownRenderer();
  return defaultRenderer.renderSync(raw);
}
