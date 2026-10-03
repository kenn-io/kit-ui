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
  /** Sends the event with the product's own auth or client. Rejects when nothing answered. */
  post: (route: string, event: AppOpenedEvent) => Promise<{ status: number }>;
}

const RETRY_MS = 1000;
// A daemon that is still starting, or a proxy in front of one, answers these.
const NOT_READY = new Set([502, 503, 504]);

/**
 * Posts `app_opened` now and on the first window focus of each later UTC day;
 * returns a cleanup. Retries until the backend answers, then ignores the
 * outcome. localStorage carries the day across reloads and tabs, though tabs
 * that open together may each send one; when storage is blocked, memory still
 * holds it for this page.
 */
export function startAppOpenedReporting({ route, surface, post }: AppOpenedOptions): () => void {
  const key = `kit-ui.app-opened.${surface}`;
  let day = "";
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const storedDay = (): string => {
    try {
      return localStorage.getItem(key) ?? "";
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
          retry = setTimeout(send, RETRY_MS);
          return;
        }
        try {
          localStorage.setItem(key, sending);
        } catch {
          // Blocked storage: memory still holds the day for this page.
        }
      });
  };

  const report = (): void => {
    const now = today();
    if (now === day || now === storedDay()) return;
    clearTimeout(retry);
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
