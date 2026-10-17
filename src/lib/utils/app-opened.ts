/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
  event: "app_opened";
  properties: { surface: string };
}
export interface TelemetryReceipt {
  status: number;
  data?: unknown;
  json?: () => Promise<unknown>;
}
export interface AppOpenedOptions {
  route: string;
  surface: string;
  /** Stable key unique to the product or installation and surface. */
  storageKey: string;
  /** Resolve HTTP errors; reject only when no response arrived. */
  post: (route: string, event: AppOpenedEvent) => Promise<TelemetryReceipt>;
}
export interface VisitEvent {
  event: string;
  properties: Record<string, unknown>;
}
export interface ScreenViewedEvent {
  event: "screen_viewed";
  properties: { surface: string; screen: string };
}
export type BrowserTelemetryEvent = AppOpenedEvent | ScreenViewedEvent | VisitEvent;
export interface VisitOptions {
  keepalive?: boolean;
}
export interface BrowserTelemetryOptions extends Omit<AppOpenedOptions, "post"> {
  post: (
    route: string,
    event: BrowserTelemetryEvent,
    options?: VisitOptions,
  ) => Promise<TelemetryReceipt>;
}
export interface AppOpenedReporter {
  (): void;
  reportScreen(screen: string): void;
  reportVisit(event: VisitEvent, options?: VisitOptions): void;
  /** Immediately receives the current state; returns an unsubscribe function. */
  onQuietChange(listener: (quiet: boolean) => void): () => void;
}
const today = (): string => new Date().toISOString().slice(0, 10);

export function startAppOpenedReporting(options: BrowserTelemetryOptions): AppOpenedReporter;
export function startAppOpenedReporting(options: AppOpenedOptions): () => void;
/** Shared daily reports and visit admission, with a persisted quiet UTC day. */
export function startAppOpenedReporting({
  route,
  surface,
  storageKey,
  post,
}: AppOpenedOptions | BrowserTelemetryOptions): AppOpenedReporter {
  const prefix = `${storageKey}.browser.v1.`,
    claims = new Set<string>();
  const screens = new Set<string>(),
    listeners = new Set<(quiet: boolean) => void>();
  const visits: [VisitEvent, VisitOptions | undefined][] = [];
  let day = today(),
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    daily = false,
    failures = 0,
    inFlight = 0,
    rearmed = false,
    resumeAt = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastQuiet = true;
  const quiet = () => stopped || gate !== "enabled";
  const notify = () => {
    if (lastQuiet === quiet()) return;
    lastQuiet = quiet();
    for (const listener of listeners) listener(lastQuiet);
  };
  const claimed = (key: string): boolean => {
    try {
      if (localStorage.getItem(key) === day) claims.add(key);
    } catch {
      /* Page memory survives blocked storage. */
    }
    return claims.has(key);
  };
  const write = (key: string) => {
    claims.add(key);
    try {
      localStorage.setItem(key, day);
    } catch {
      /* Retain the page claim. */
    }
  };
  const disabled = (): boolean => {
    if (gate !== "disabled")
      gate = claimed(`${prefix}quiet`)
        ? "disabled"
        : claimed(`${prefix}check`)
          ? "enabled"
          : "unknown";
    notify();
    return gate === "disabled";
  };
  const clear = () => {
    visits.length = 0;
    screens.clear();
  };
  const rollover = () => {
    if (day === today()) return;
    day = today();
    claims.clear();
    gate = "unknown";
    daily = rearmed = false;
    failures = inFlight = 0;
    clearTimeout(retry);
    retry = undefined;
    clear();
    if (currentScreen !== undefined) screens.add(currentScreen);
    notify();
  };
  const send = async (event: VisitEvent, key?: string, options?: VisitOptions) => {
    const sending = day;
    inFlight++;
    if (key) daily = true;
    let response: TelemetryReceipt | undefined, data: unknown;
    try {
      response = await (post as BrowserTelemetryOptions["post"])(route, event, options);
      if (response.status === 202) {
        try {
          data = response.data ?? (await response.json?.());
        } catch {
          /* Legacy terminal receipt. */
        }
      }
    } catch {
      /* Transport failures share the retry budget. */
    }
    if (sending !== day || sending !== today() || stopped) return;
    inFlight--;
    if (key) daily = false;
    if (disabled()) {
      clear();
      return;
    }
    clearTimeout(retry);
    retry = undefined;
    if (!response || (response.status >= 500 && response.status < 600)) {
      if (++failures < 6)
        retry = setTimeout(
          () => {
            retry = undefined;
            pump();
          },
          1000 * 2 ** (failures - 1),
        );
      else {
        resumeAt = Date.now() + 15 * 60000;
        clear();
      }
      return;
    }
    failures = 0;
    if (key) write(key);
    if (data && typeof data === "object" && "status" in data && data.status === "disabled") {
      write(`${prefix}quiet`);
      gate = "disabled";
      clear();
    } else {
      write(`${prefix}check`);
      gate = "enabled";
    }
    notify();
    pump();
  };
  const pump = () => {
    rollover();
    if (stopped || disabled()) {
      clear();
      return;
    }
    while (!retry && failures + inFlight < 6 && (gate === "enabled" || !inFlight)) {
      const visit = visits.shift();
      if (visit) {
        void send(visit[0], undefined, visit[1]);
        continue;
      }
      if (daily) return;
      if (!claimed(storageKey) || gate === "unknown") {
        void send({ event: "app_opened", properties: { surface } }, storageKey);
        continue;
      }
      const screen = [...screens].find(
        (name) => !claimed(`${prefix}screen.${encodeURIComponent(name)}`),
      );
      if (screen === undefined) return;
      void send(
        { event: "screen_viewed", properties: { surface, screen } },
        `${prefix}screen.${encodeURIComponent(screen)}`,
      );
    }
  };
  const request = (visit?: VisitEvent, options?: VisitOptions) => {
    rollover();
    if (stopped || gate === "disabled") return;
    if (failures >= 6 && !rearmed && Date.now() >= resumeAt) {
      rearmed = true;
      failures = 0;
    }
    if (failures >= 6) return;
    if (visit) visits.push([visit, options]);
    pump();
  };
  const report = () => request();
  report();
  window.addEventListener("focus", report);
  return Object.assign(
    () => {
      stopped = true;
      clearTimeout(retry);
      clear();
      notify();
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    {
      reportScreen(screen: string) {
        currentScreen = screen;
        screens.add(screen);
        request();
      },
      reportVisit: (event: VisitEvent, options?: VisitOptions) => request(event, options),
      onQuietChange(listener: (quiet: boolean) => void) {
        listener(quiet());
        if (!stopped) listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
  );
}
