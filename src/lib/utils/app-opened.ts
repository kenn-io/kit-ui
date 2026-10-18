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
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Keeps each key's last 35 claimed UTC dates in localStorage, or page memory when storage fails.
 * `storageKey` keeps the shipped helper's single latest app-open date; its history lives beside it.
 */
function claimHistory(storageKey: string) {
  const memory = new Map<string, string[]>();
  const listKey = (key: string) => (key === storageKey ? `${key}.browser.v1.open` : key);
  const has = (key: string, date: string): boolean => {
    let dates = memory.get(key) ?? [];
    try {
      const saved = localStorage.getItem(listKey(key))?.split(",").filter(isDate) ?? [];
      if (key === storageKey && localStorage.getItem(key) === date) saved.push(date);
      dates = [
        ...new Set([
          ...saved.filter((value) => value !== date),
          ...dates,
          ...(saved.includes(date) ? [date] : []),
        ]),
      ];
    } catch {
      /* Page memory survives blocked storage. */
    }
    dates = dates.slice(-35);
    memory.set(key, dates);
    return dates.includes(date);
  };
  const add = (key: string, date: string) => {
    if (has(key, date)) return;
    const dates = [...(memory.get(key) ?? []), date].slice(-35);
    memory.set(key, dates);
    try {
      localStorage.setItem(listKey(key), dates.join(","));
      if (key === storageKey && date === today()) localStorage.setItem(key, date);
    } catch {
      /* Retain the page claim. */
    }
  };
  return { has, add };
}

/** Names the gate claim a reply earns: `check` when enabled, `quiet` when disabled, none when terminal. */
const receiptClaim = (response: TelemetryReceipt, data: unknown) => {
  const status = data && typeof data === "object" && "status" in data ? data.status : undefined;
  if (response.status === 202 && status === "disabled") return "quiet";
  return (response.status === 202 && (status === "queued" || status === "skipped")) ||
    (response.status >= 200 &&
      response.status < 300 &&
      !response.json &&
      response.data === undefined)
    ? "check"
    : undefined;
};

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
    claims = claimHistory(storageKey);
  const screens = new Set<string>(),
    listeners = new Set<(quiet: boolean) => void>();
  let day = today(),
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    daily = false,
    failures = 0,
    visitEligibleAt = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastQuiet = true;
  const quiet = () => stopped || failures >= 6 || gate !== "enabled";
  const notify = () => {
    if (lastQuiet === quiet()) return;
    lastQuiet = quiet();
    for (const listener of listeners) listener(lastQuiet);
  };
  const cancelRetry = () => {
    clearTimeout(retry);
    retry = undefined;
  };
  const readGate = () =>
    gate === "disabled"
      ? gate
      : claims.has(`${prefix}quiet`, day)
        ? "disabled"
        : claims.has(`${prefix}check`, day)
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
    visitEligibleAt = 0;
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
    const failed = !response || (response.status >= 500 && response.status < 600);
    if (response && !failed) {
      // Claims keep the sending date, so a reply landing after midnight never sets today's gate.
      const claim = receiptClaim(response, data);
      if (claim) claims.add(`${prefix}${claim}`, sending);
      if (key !== undefined && claim !== "quiet") claims.add(key, sending);
    }
    if (sending !== day) {
      pump();
      return;
    }
    if (disabled()) {
      if (checking) daily = false;
      return;
    }
    if (failed) {
      const delay = 1000 * 2 ** failures++;
      visitEligibleAt = Date.now() + delay;
      if (failures >= 6) cancelRetry();
      else if (checking && key !== undefined && !retry)
        retry = setTimeout(() => {
          retry = undefined;
          pump();
        }, delay);
      if (checking) daily = false;
      notify();
      return;
    }
    if (failures < 6 && (checking || (!daily && !retry))) {
      failures = 0;
      visitEligibleAt = 0;
    }
    if (gate === "unknown" && (!key || key === storageKey)) gate = "disabled";
    if (checking) daily = false;
    pump();
  };
  const pump = (visit?: VisitEvent, options?: VisitOptions, wake = false) => {
    rollover(wake);
    if (stopped || disabled() || failures >= 6) return;
    if (visit) {
      if (!options?.keepalive && Date.now() < visitEligibleAt) return;
      if (gate === "enabled" || (!daily && !retry)) void send(visit, undefined, options);
      return;
    }
    if (retry || daily) return;
    const screen = [...screens].find(
      (name) => !claims.has(`${prefix}screen.${encodeURIComponent(name)}`, day),
    );
    if (!claims.has(storageKey, day))
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
      visitEligibleAt = 0;
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
