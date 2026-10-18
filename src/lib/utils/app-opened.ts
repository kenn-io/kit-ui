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

/**
 * Keeps each key's last 35 claimed UTC dates in localStorage, one item per date, so
 * concurrent tabs never overwrite each other's claims. Page memory keeps claims that
 * storage cannot read or write.
 */
function claimHistory(storageKey: string) {
  const memory = new Map<string, string[]>();
  const base = (key: string) => (key === storageKey ? `${key}.browser.v1.open:` : `${key}:`);
  const rank = (item: string) => Number(localStorage.getItem(item)) || 0;
  const byRank = (a: string, b: string) => rank(a) - rank(b);
  const has = (key: string, date: string): boolean => {
    try {
      if (localStorage.getItem(base(key) + date) !== null) return true;
    } catch {
      /* Page memory survives blocked storage. */
    }
    return (memory.get(key) ?? []).includes(date);
  };
  const add = (key: string, date: string) => {
    if (has(key, date)) return;
    memory.set(key, [...(memory.get(key) ?? []), date].slice(-35));
    // Ranks order claims by recency; a failed write leaves the claim in page memory.
    try {
      const items = Object.keys(localStorage).filter((item) => item.startsWith(base(key)));
      localStorage.setItem(base(key) + date, String(Math.max(0, ...items.map(rank)) + 1));
      for (const item of items.sort(byRank).slice(0, -34)) localStorage.removeItem(item);
    } catch {}
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
  const pending = new Map<string, object>();
  let day = today(),
    generation = {},
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    failures = 0,
    ordinaryEligibleAt = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastQuiet = true;
  const quiet = () => stopped || failures >= 6 || gate !== "enabled";
  const notify = () => {
    const value = quiet();
    if (lastQuiet === value) return;
    lastQuiet = value;
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      if (lastQuiet !== value) break;
      if (listeners.has(listener)) listener(value);
    }
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
    generation = {};
    gate = "unknown";
    failures = 0;
    ordinaryEligibleAt = 0;
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
    const owner = generation;
    const record = {};
    if (checking) pending.set(sending, record);
    const release = () => {
      if (checking && pending.get(sending) === record) pending.delete(sending);
    };
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
    if (stopped) return release();
    const failed = !response || (response.status >= 500 && response.status < 600);
    if (response && !failed) {
      // Claims keep the sending date; disabled receipts also stop the current page.
      const claim = receiptClaim(response, data);
      if (claim) claims.add(`${prefix}${claim}`, sending);
      if (key !== undefined && claim !== "quiet") claims.add(key, sending);
      if (claim === "quiet") {
        gate = "disabled";
        disabled();
      }
    }
    rollover();
    const isDisabled = disabled();
    if (owner !== generation) {
      release();
      pump();
      return;
    }
    if (isDisabled) {
      release();
      return;
    }
    if (failed) {
      const delay = 1000 * 2 ** failures++;
      if (retry === undefined) ordinaryEligibleAt = performance.now() + delay;
      if (failures >= 6) cancelRetry();
      notify();
      release();
      pump();
      return;
    }
    if (failures < 6 && (checking || (!pending.has(day) && !retry))) {
      failures = 0;
      ordinaryEligibleAt = 0;
    }
    release();
    pump();
  };
  const pump = (visit?: VisitEvent, options?: VisitOptions, wake = false) => {
    rollover(wake);
    if (stopped || disabled() || failures >= 6) return;
    if (visit) {
      if ((!options?.keepalive || gate !== "enabled") && performance.now() < ordinaryEligibleAt)
        return;
      if (gate === "enabled" || (!pending.has(day) && !retry)) void send(visit, undefined, options);
      return;
    }
    if (retry || pending.has(day)) return;
    const screen = [...screens].find(
      (name) => !claims.has(`${prefix}screen.${encodeURIComponent(name)}`, day),
    );
    const open = !claims.has(storageKey, day);
    if (!open && screen === undefined) return;
    const delay = ordinaryEligibleAt - performance.now();
    if (delay > 0) {
      retry = setTimeout(() => {
        retry = undefined;
        pump();
      }, delay);
      return;
    }
    if (open) void send({ event: "app_opened", properties: { surface } }, storageKey);
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
      ordinaryEligibleAt = 0;
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
        if (!stopped) listeners.add(listener);
        listener(quiet());
        return () => void listeners.delete(listener);
      },
    },
  );
}
