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
    claims = new Map<string, string[]>();
  const screens = new Set<string>(),
    listeners = new Set<(quiet: boolean) => void>();
  let day = today(),
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    daily = false,
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
  const claimed = (key: string, keep = 35): boolean => {
    let dates = claims.get(key) ?? [];
    try {
      const saved = localStorage.getItem(key)?.split(",") ?? [];
      dates = [
        ...new Set([
          ...saved.filter((date) => date !== day),
          ...dates,
          ...(saved.includes(day) ? [day] : []),
        ]),
      ];
    } catch {
      /* Page memory survives blocked storage. */
    }
    dates = dates.slice(-keep);
    claims.set(key, dates);
    return dates.includes(day);
  };
  const write = (key: string, keep = 35) => {
    if (!claimed(key, keep)) {
      const dates = [...(claims.get(key) ?? []), day].slice(-keep);
      claims.set(key, dates);
      try {
        localStorage.setItem(key, dates.join(","));
      } catch {
        /* Retain the page claim. */
      }
    }
  };
  const cancelRetry = () => {
    clearTimeout(retry);
    retry = undefined;
  };
  const readGate = () =>
    gate === "disabled"
      ? gate
      : claimed(`${prefix}quiet`, 1)
        ? "disabled"
        : claimed(`${prefix}check`, 1)
          ? "enabled"
          : "unknown";
  const disabled = (): boolean => {
    gate = readGate();
    if (gate === "disabled") cancelRetry();
    notify();
    return stopped || gate === "disabled";
  };
  const rollover = (wake = false) => {
    if (day === today() || (!wake && (stopped || readGate() === "disabled"))) return;
    day = today();
    gate = "unknown";
    daily = false;
    failures = 0;
    cancelRetry();
    screens.clear();
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
    if (checking) daily = true;
    let response: TelemetryReceipt | undefined, data: unknown;
    try {
      response = await (post as BrowserTelemetryOptions["post"])(route, event, options);
      if (response.status === 202) {
        try {
          data = response.data ?? (await response.json?.());
        } catch {
          /* Unreadable receipts cannot establish the gate; the daemon may already have accepted the event. */
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
    if (disabled()) {
      if (checking) daily = false;
      return;
    }
    if (!response || (response.status >= 500 && response.status < 600)) {
      if (++failures >= 6) cancelRetry();
      else if (checking && key !== undefined && !retry)
        retry = setTimeout(
          () => {
            retry = undefined;
            pump();
          },
          1000 * 2 ** (failures - 1),
        );
      if (checking) daily = false;
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
    if (failures < 6 && (checking || (!daily && !retry))) failures = 0;
    if (accepted) {
      gate = "enabled";
      write(`${prefix}check`, 1);
      if (key !== undefined) write(key);
    } else if (response.status === 202 && status === "disabled") {
      gate = "disabled";
      write(`${prefix}quiet`, 1);
    } else {
      if (key !== undefined) write(key);
      if (gate === "unknown" && (!key || key === storageKey)) gate = "disabled";
    }
    if (checking) daily = false;
    pump();
  };
  const pump = (visit?: VisitEvent, options?: VisitOptions, wake = false) => {
    rollover(wake);
    if (stopped || disabled() || failures >= 6) return;
    if (visit) {
      if (gate === "enabled" || (!daily && !retry)) void send(visit, undefined, options);
      return;
    }
    if (retry || daily) return;
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
  };
  const report = () => pump(undefined, undefined, true);
  pump();
  window.addEventListener("focus", report);
  return Object.assign(
    () => {
      stopped = true;
      cancelRetry();
      screens.clear();
      notify();
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    {
      reportScreen(screen: string) {
        currentScreen = screen;
        screens.add(screen);
        pump();
      },
      reportVisit: (event: VisitEvent, options?: VisitOptions) => pump(event, options),
      onQuietChange(listener: (quiet: boolean) => void) {
        listener(quiet());
        if (!stopped) listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
  );
}
