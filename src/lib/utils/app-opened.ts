/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
  event: "app_opened";
  properties: { surface: string };
}

export interface ScreenViewedEvent {
  event: "screen_viewed";
  properties: { surface: string; screen: string };
}

/** Visit names and properties belong to the consuming product. */
export interface VisitEvent {
  event: string;
  properties: Record<string, unknown>;
}

export type BrowserTelemetryEvent = AppOpenedEvent | ScreenViewedEvent | VisitEvent;
export interface VisitOptions {
  keepalive?: boolean;
}
export interface AppOpenedOptions {
  /** Daemon route that accepts UI telemetry. */
  route: string;
  surface: string;
  /** Stable key unique to the product or installation and surface. */
  storageKey: string;
  /** Resolve HTTP errors; reject only when no response arrived. Preserve receipts. */
  post: (
    route: string,
    event: BrowserTelemetryEvent,
    options?: VisitOptions,
  ) => Promise<{
    status: number;
    data?: unknown;
    json?: () => Promise<unknown>;
  }>;
}

export interface AppOpenedReporter {
  (): void;
  reportScreen(screen: string): void;
  reportVisit(event: VisitEvent, options?: VisitOptions): void;
  /** Immediately receives the current quiet state; returns an unsubscribe function. */
  onQuietChange(listener: (quiet: boolean) => void): () => void;
}

const NOT_READY = new Set([502, 503, 504]);
const today = (): string => new Date().toISOString().slice(0, 10);

/** Shared daily browser reports, bounded retries, and a persisted quiet UTC day. */
export function startAppOpenedReporting({
  route,
  surface,
  storageKey,
  post,
}: AppOpenedOptions): AppOpenedReporter {
  let day = "";
  let stopped = false;
  let quiet = false;
  let quietDay = "";
  let active = false;
  let failures = 0;
  let currentScreen: string | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const pending = new Set<string>();
  const memory = new Map<string, string>();
  const unwritten = new Set<string>();
  const listeners = new Set<(quiet: boolean) => void>();
  const quietKey = `${storageKey}.quiet`;
  const screensKey = `${storageKey}.screens`;
  const storedDay = (key: string): string => {
    if (unwritten.has(key)) return memory.get(key) ?? "";
    try {
      return localStorage.getItem(key) ?? memory.get(key) ?? "";
    } catch {
      return memory.get(key) ?? "";
    }
  };
  const store = (key: string, value: string): void => {
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      unwritten.add(key);
    }
  };
  const setQuiet = (value: boolean): void => {
    if (quiet === value) return;
    quiet = value;
    for (const listener of listeners) listener(value);
  };
  const screens = (): string[] => {
    try {
      const value = JSON.parse(storedDay(screensKey));
      return value.day === day && Array.isArray(value.screens) ? value.screens : [];
    } catch {
      return [];
    }
  };
  const receipt = async (
    response: Awaited<ReturnType<AppOpenedOptions["post"]>>,
    sending: string,
  ): Promise<void> => {
    if (response.status !== 202) return;
    let data = response.data;
    try {
      if (data === undefined) data = await response.json?.();
    } catch {
      return;
    }
    if (stopped || sending !== day || sending !== today()) return;
    const status = data && typeof data === "object" && "status" in data ? data.status : undefined;
    if (status === "disabled") {
      quietDay = sending;
      store(quietKey, sending);
      clearTimeout(retry);
      retry = undefined;
      pending.clear();
      setQuiet(true);
    } else if ((status === "queued" || status === "skipped") && quietDay !== sending) {
      setQuiet(false);
    }
  };

  const send = (): void => {
    retry = undefined;
    if (stopped || active || failures >= 6) return;
    if (today() !== day) {
      report();
      return;
    }
    if (quietDay === day || storedDay(quietKey) === day) {
      quietDay = day;
      pending.clear();
      setQuiet(true);
      return;
    }
    let screen: string | undefined;
    if (storedDay(storageKey) >= day) {
      const claimed = screens();
      for (const candidate of pending) {
        pending.delete(candidate);
        if (!claimed.includes(candidate)) {
          screen = candidate;
          break;
        }
      }
      if (screen === undefined) return;
    }
    const sending = day;
    active = true;
    const event: BrowserTelemetryEvent =
      screen === undefined
        ? { event: "app_opened", properties: { surface } }
        : { event: "screen_viewed", properties: { surface, screen } };
    void (async () => {
      let answered = false;
      try {
        const response = await post(route, event);
        answered = !NOT_READY.has(response.status);
        await receipt(response, sending);
      } catch {
        /* Transport failures use the daily retry budget. */
      }
      if (stopped || sending !== day) return;
      active = false;
      if (quietDay === sending) return;
      if (!answered) {
        if (screen !== undefined) pending.add(screen);
        failures++;
        if (failures < 6) retry = setTimeout(send, 1000 * 2 ** (failures - 1));
        return;
      }
      if (screen === undefined) {
        if (storedDay(storageKey) <= sending) store(storageKey, sending);
      } else if (sending === today()) {
        store(screensKey, JSON.stringify({ day, screens: [...new Set([...screens(), screen])] }));
      }
      send();
    })();
  };
  const report = (): void => {
    if (stopped) return;
    const now = today();
    if (now !== day) {
      day = now;
      clearTimeout(retry);
      retry = undefined;
      active = false;
      failures = 0;
      pending.clear();
      if (currentScreen !== undefined) pending.add(currentScreen);
      quietDay = storedDay(quietKey);
      if (quietDay === day) setQuiet(true);
    }
    if (!retry) send();
  };

  report();
  window.addEventListener("focus", report);
  return Object.assign(
    () => {
      stopped = true;
      clearTimeout(retry);
      pending.clear();
      setQuiet(true);
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    {
      reportScreen(screen: string) {
        currentScreen = screen;
        if (stopped || quiet) return;
        pending.add(screen);
        if (!retry) send();
      },
      reportVisit(event: VisitEvent, options?: VisitOptions) {
        if (stopped || quiet) return;
        const sending = day;
        void (async () => {
          try {
            await receipt(await post(route, event, options), sending);
          } catch {
            /* Visits are best effort and never join the daily retry queue. */
          }
        })();
      },
      onQuietChange(listener: (quiet: boolean) => void) {
        listener(quiet);
        if (!stopped) listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  );
}
