// Server-side clipboard fallback for browsers that deny every in-page write
// path (Firefox on insecure HTTP origins). The host application owns the
// endpoint, its base URL, and any CSRF or auth decoration on the request —
// kit-ui only owns the wire shape ({ "text": ... } JSON POST) and the
// failure contract (reject on any non-2xx response).

export interface TerminalClipboardServerFallbackOptions {
  /** Absolute or app-relative URL of the clipboard endpoint. */
  readonly url: string;
  /**
   * The fetch used for the POST. Hosts pass their decorated fetch here
   * (CSRF headers, tracing); defaults to the global fetch.
   */
  readonly fetch?: (input: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;
}

export function createTerminalClipboardServerFallback(
  options: TerminalClipboardServerFallbackOptions,
): (text: string) => Promise<void> {
  return async (text) => {
    const doFetch = options.fetch ?? fetch;
    const response = await doFetch(options.url, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`terminal clipboard fallback failed (${response.status})`);
    }
  };
}
