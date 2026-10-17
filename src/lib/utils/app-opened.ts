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
  /** Daemon route that accepts UI telemetry, e.g. "/api/v1/telemetry/events". */
  route: string;
  /** Where the open happened, e.g. "web". */
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
  /** Use a stable, finite set of screen names, such as route names without IDs. */
  reportScreen(screen: string): void;
  reportVisit(event: VisitEvent, options?: VisitOptions): void;
  /** Immediately receives the current state; returns an unsubscribe function. */
  onQuietChange(listener: (quiet: boolean) => void): () => void;
}
const today = (): string => new Date().toISOString().slice(0, 10);

/** Reports daily app-open and screens, gates visits, and pauses trackers until an enabled receipt. Call the reporter to stop. */
export function startAppOpenedReporting(options: BrowserTelemetryOptions): AppOpenedReporter;
/** Reports daily app-open on load or later UTC-day focus. Returns cleanup; retries stop after six failures until reload or the next UTC day. */
export function startAppOpenedReporting(options: AppOpenedOptions): () => void;
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
  const visits: { event: VisitEvent; options?: VisitOptions }[] = [];
  let day = today(),
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    daily = false,
    scheduled = true,
    failures = 0,
    inFlight = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastQuiet = true;
  const quiet = () => stopped || failures >= 6 || gate !== "enabled";
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
  const cancelRetry = () => {
    clearTimeout(retry);
    retry = undefined;
  };
  const disabled = (): boolean => {
    if (gate !== "disabled")
      gate = claimed(`${prefix}quiet`)
        ? "disabled"
        : claimed(`${prefix}check`)
          ? "enabled"
          : "unknown";
    if (gate === "disabled") {
      cancelRetry();
      visits.length = 0;
    }
    notify();
    return gate === "disabled";
  };
  const rollover = () => {
    if (day === today()) return;
    day = today();
    claims.clear();
    gate = "unknown";
    daily = false;
    failures = inFlight = 0;
    cancelRetry();
    screens.clear();
    visits.length = 0;
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
          /* Malformed receipts cannot establish the gate. */
        }
      }
    } catch {
      /* Transport failures share the retry budget. */
    }
    rollover();
    if (stopped) return;
    if (sending !== day) {
      pump();
      return;
    }
    inFlight--;
    if (key) daily = false;
    if (disabled()) return;
    if (!response || (response.status >= 500 && response.status < 600)) {
      cancelRetry();
      if (++failures < 6)
        retry = setTimeout(
          () => {
            retry = undefined;
            pump();
          },
          1000 * 2 ** (failures - 1),
        );
      else visits.length = 0;
      notify();
      return;
    }
    failures = 0;
    const status = data && typeof data === "object" && "status" in data ? data.status : undefined;
    const accepted =
      (response.status === 202 && (status === "queued" || status === "skipped")) ||
      (response.status >= 200 &&
        response.status < 300 &&
        !response.json &&
        response.data === undefined);
    if (accepted) {
      gate = "enabled";
      write(`${prefix}check`);
      if (key) write(key);
    } else if (response.status === 202 && status === "disabled") {
      gate = "disabled";
      write(`${prefix}quiet`);
    } else if (gate === "unknown") gate = "disabled";
    else if (key) claims.add(key);
    pump();
  };
  const pump = () => {
    rollover();
    if (stopped || disabled() || scheduled || failures + inFlight >= 6) return;
    if (gate === "enabled") {
      while (visits.length && failures + inFlight < 6) {
        const visit = visits.shift()!;
        void send(visit.event, undefined, visit.options);
      }
    }
    if (retry || daily || failures + inFlight >= 6) return;
    const screen = [...screens].find(
      (name) => !claimed(`${prefix}screen.${encodeURIComponent(name)}`),
    );
    if (!claimed(storageKey) || (gate === "unknown" && screen === undefined))
      void send({ event: "app_opened", properties: { surface } }, storageKey);
    else if (screen !== undefined)
      void send(
        { event: "screen_viewed", properties: { surface, screen } },
        `${prefix}screen.${encodeURIComponent(screen)}`,
      );
  };
  const request = (visit?: VisitEvent, options?: VisitOptions) => {
    rollover();
    if (stopped || disabled() || failures + inFlight >= 6) return;
    if (visit && gate === "enabled") void send(visit, undefined, options);
    else {
      if (visit && visits.length < 6) visits.push({ event: visit, options });
      pump();
    }
  };
  const report = () => request();
  queueMicrotask(() => {
    scheduled = false;
    pump();
  });
  window.addEventListener("focus", report);
  return Object.assign(
    () => {
      stopped = true;
      cancelRetry();
      screens.clear();
      visits.length = 0;
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
