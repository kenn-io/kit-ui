/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
  event: "app_opened";
  properties: { surface: string };
}

export interface AppOpenedOptions {
  /** Daemon route that accepts UI telemetry, e.g. "/api/v1/telemetry/events". */
  route: string;
  /** Where the open happened, e.g. "web". */
  surface: string;
  /** Stable localStorage key, unique to the product or installation and surface. */
  storageKey: string;
  /** Resolves with the HTTP status, including errors. Rejects only when no response arrived. */
  post: (route: string, event: AppOpenedEvent) => Promise<{ status: number }>;
}

const RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;
// A daemon that is still starting, or a proxy in front of one, answers these.
const NOT_READY = new Set([502, 503, 504]);

/**
 * Posts `app_opened` now and on the first window focus of each later UTC day;
 * returns a cleanup. Retries back off from 1 to 30 seconds until the backend
 * answers, then ignores the outcome. localStorage carries the day across reloads
 * and tabs, though tabs that open together may each send one; when storage is
 * blocked, memory still holds it for this page.
 */
export function startAppOpenedReporting({
  route,
  surface,
  storageKey,
  post,
}: AppOpenedOptions): () => void {
  let day = "";
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryMs = RETRY_MS;

  const storedDay = (): string => {
    try {
      return localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  };

  const today = (): string => new Date().toISOString().slice(0, 10);

  // A retry that crosses UTC midnight counts for the day it lands on.
  const send = (): void => {
    const sending = (day = today());
    // Another tab may have recorded the day while this one waited to retry.
    if (storedDay() === sending) return;
    post(route, { event: "app_opened", properties: { surface } })
      .then(
        (response) => !NOT_READY.has(response.status),
        () => false,
      )
      .then((answered) => {
        if (stopped || sending !== day) return;
        if (!answered) {
          retry = setTimeout(send, retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
          return;
        }
        // An answer landing after midnight must not roll back a later day another tab recorded.
        if (storedDay() > sending) return;
        try {
          localStorage.setItem(storageKey, sending);
        } catch {
          // Blocked storage: memory still holds the day for this page.
        }
      });
  };

  const report = (): void => {
    const now = today();
    if (now === day) return;
    clearTimeout(retry);
    retryMs = RETRY_MS;
    send();
  };

  report();
  window.addEventListener("focus", report);
  return () => {
    stopped = true;
    clearTimeout(retry);
    window.removeEventListener("focus", report);
  };
}
