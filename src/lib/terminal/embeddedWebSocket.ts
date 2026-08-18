/**
 * Resolve a terminal websocket path against an embedder-provided base URL.
 *
 * Embedded hosts (e.g. an editor webview wrapping the app) cannot always
 * reach the app origin's websocket endpoint directly; they inject a base URL
 * for the page to use instead. The host application owns how that base URL
 * reaches the page (a global, config, or query param) and passes it here.
 *
 * Returns null when no usable ws:/wss: base URL is provided, so callers fall
 * through to their normal same-origin websocket URL.
 */
export function embeddedWebSocketUrl(
  path: string,
  rawBaseUrl: string | null | undefined,
): string | null {
  const raw = rawBaseUrl?.trim();
  if (!raw) return null;

  try {
    const base = new URL(raw);
    if (base.protocol !== "ws:" && base.protocol !== "wss:") return null;
    const requested = new URL(path, "http://embedded.invalid");
    const basePath = base.pathname.replace(/\/$/, "");
    base.pathname = `${basePath}${requested.pathname}`;
    base.search = requested.search;
    base.hash = "";
    return base.toString();
  } catch {
    return null;
  }
}
