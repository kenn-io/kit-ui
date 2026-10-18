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
    checkingVisit = false,
    failures = 0;
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
      const saved = localStorage.getItem(key);
      if (
        saved &&
        saved >= day &&
        Number.isFinite(Date.parse(saved)) &&
        new Date(saved).toISOString().slice(0, 10) === saved
      )
        claims.add(key);
    } catch {
      /* Page memory survives blocked storage. */
    }
    return claims.has(key);
  };
  const write = (key: string) => {
    if (!claimed(key)) {
      try {
        localStorage.setItem(key, day);
      } catch {
        /* Retain the page claim. */
      }
    }
    claims.add(key);
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
  const rollover = (wake = false) => {
    if (day === today() || (!wake && disabled())) return;
    day = today();
    claims.clear();
    gate = "unknown";
    daily = checkingVisit = false;
    failures = 0;
    cancelRetry();
    screens.clear();
    visits.length = 0;
    if (currentScreen !== undefined) screens.add(currentScreen);
    notify();
  };
  const send = async (
    event: VisitEvent,
    key?: string,
    options?: VisitOptions,
    checking = key !== undefined || gate === "unknown",
  ) => {
    const sending = day;
    if (checking) {
      daily = true;
      checkingVisit = key === undefined;
    }
    let response: TelemetryReceipt | undefined, data: unknown;
    try {
      response = await (post as BrowserTelemetryOptions["post"])(route, event, options);
      if (response.status === 202 && !(response as Response).bodyUsed) {
        try {
          data = response.data ?? (await response.json?.());
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          /* Malformed receipts cannot establish the gate. */
        }
      }
    } catch {
      response = undefined;
      /* Receipt checks retry transport failures. */
    }
    rollover();
    if (stopped) return;
    if (sending !== day) {
      pump();
      return;
    }
    if (checking) daily = false;
    if (disabled()) return;
    if (!response || (response.status >= 500 && response.status < 600)) {
      if (++failures < 6) {
        if (!retry)
          retry = setTimeout(
            () => {
              retry = undefined;
              pump();
            },
            1000 * 2 ** (failures - 1),
          );
      } else {
        cancelRetry();
        visits.length = 0;
      }
      notify();
      return;
    }
    const status = data && typeof data === "object" && "status" in data ? data.status : undefined;
    const accepted =
      (response.status === 202 && (status === "queued" || status === "skipped")) ||
      (response.status >= 200 &&
        response.status < 300 &&
        !response.json &&
        response.data === undefined);
    if (failures < 6 && checking) failures = 0;
    if (checking && key === undefined) {
      checkingVisit = false;
      visits.shift();
    }
    if (accepted) {
      gate = "enabled";
      write(`${prefix}check`);
      if (key !== undefined) write(key);
    } else if (response.status === 202 && status === "disabled") {
      gate = "disabled";
      write(`${prefix}quiet`);
    } else {
      if (key !== undefined) write(key);
      if (gate === "unknown" && (!key || key === storageKey)) gate = "disabled";
    }
    pump();
  };
  const pump = () => {
    rollover();
    if (stopped || disabled() || failures >= 6) return;
    if (gate === "enabled" && !checkingVisit && !retry) {
      while (visits.length && failures < 6) {
        const visit = visits.shift()!;
        void send(visit.event, undefined, visit.options);
      }
    }
    if (retry || daily || failures >= 6) return;
    if (checkingVisit && visits[0]) {
      void send(visits[0].event, undefined, visits[0].options, true);
      return;
    }
    const screen = [...screens].find(
      (name) => !claimed(`${prefix}screen.${encodeURIComponent(name)}`),
    );
    if (!claimed(storageKey))
      void send({ event: "app_opened", properties: { surface } }, storageKey);
    else if (screen !== undefined)
      void send(
        { event: "screen_viewed", properties: { surface, screen } },
        `${prefix}screen.${encodeURIComponent(screen)}`,
      );
    else if (gate === "unknown" && visits[0])
      void send(visits[0].event, undefined, visits[0].options);
    else if (gate === "unknown" && listeners.size)
      void send({ event: "app_opened", properties: { surface } }, storageKey);
  };
  const request = (visit?: VisitEvent, options?: VisitOptions) => {
    rollover();
    if (stopped || disabled() || failures >= 6) return;
    if (visit && gate === "enabled" && (!retry || options?.keepalive))
      return void send(visit, undefined, options);
    if (visit && visits.length < 6) visits.push({ event: visit, options });
    pump();
  };
  const report = () => {
    rollover(true);
    request();
  };
  pump();
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
        if (!stopped && listeners.add(listener)) queueMicrotask(pump);
        return () => void listeners.delete(listener);
      },
    },
  );
}
