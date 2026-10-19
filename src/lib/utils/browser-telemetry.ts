/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
  event: "app_opened";
  properties: { surface: string };
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
/** Why the reporter is quiet, or `enabled` when it is not. */
export type BrowserTelemetryQuietReason =
  | "checking"
  | "enabled"
  | "disabled"
  | "unavailable"
  | "stopped";
/** A daemon reply with its body: a `Response` with an unread body, or the parsed `data`. */
export type TelemetryReceipt =
  | { status: number; data: unknown }
  | { status: number; json: () => Promise<unknown> };
export interface BrowserTelemetryOptions {
  /** Daemon route that accepts UI telemetry, e.g. "/api/v1/telemetry/events". */
  route: string;
  /** Where the open happened, e.g. "web". */
  surface: string;
  /** Stable key unique to the product or installation and surface. */
  storageKey: string;
  /** Resolve HTTP errors with their receipt; reject only when no response arrived. */
  post: (
    route: string,
    event: BrowserTelemetryEvent,
    options?: VisitOptions,
  ) => Promise<TelemetryReceipt>;
}
export interface BrowserTelemetryReporter {
  /** Stops reporting, signals quiet, and removes listeners. */
  stop(): void;
  /** Records an opt-out made in this app: quiet until a later UTC day's load or focus checks again. */
  disable(): void;
  /** Use a stable, finite set of screen names, such as route names without IDs. */
  reportScreen(screen: string): void;
  /** Holds up to 64 copied visits while a permission check is pending; a full queue drops new ones. */
  reportVisit(event: VisitEvent, options?: VisitOptions): void;
  /** Immediately receives the current state, then each reason change; returns an unsubscribe function. */
  onQuietChange(
    listener: (quiet: boolean, reason: BrowserTelemetryQuietReason) => void,
  ): () => void;
}
const today = (): string => new Date().toISOString().slice(0, 10);

const rank = (item: string) => Number(localStorage.getItem(item)) || 0;
const byRank = (a: string, b: string) => rank(a) - rank(b);
/** Dates claimed under `prefix` in storage, oldest first. */
const stored = (prefix: string) =>
  Object.keys(localStorage)
    .filter((item) => item.startsWith(prefix))
    .sort(byRank)
    .map((item) => item.slice(prefix.length));
/** Ranks a claim newest under `prefix` and evicts all but the 35 newest. */
const store = (prefix: string, date: string) => {
  const items = stored(prefix).flatMap((claimed) => (claimed === date ? [] : [prefix + claimed]));
  localStorage.setItem(prefix + date, String(Math.max(0, ...items.map(rank)) + 1));
  for (const item of items.slice(0, -34)) localStorage.removeItem(item);
};

/**
 * Keeps each key's last 35 claimed UTC dates in localStorage, one item per date, so
 * concurrent tabs never overwrite each other's claims. Until a write fails, readable
 * storage is authoritative, including its evictions. Page memory mirrors it, covers
 * blocked reads, and alone holds the page's claims after a failed write.
 */
function claimHistory(storageKey: string) {
  const memory = new Map<string, string[]>();
  let pageOnly = false;
  const base = (key: string) => (key === storageKey ? `${key}.browser.v1.open:` : `${key}:`);
  const has = (key: string, date: string): boolean => {
    try {
      if (!pageOnly) memory.set(key, stored(base(key)));
    } catch {
      /* Page memory survives blocked storage. */
    }
    return (memory.get(key) ?? []).slice(-35).includes(date);
  };
  const add = (key: string, date: string) => {
    if (has(key, date)) return;
    memory.set(key, [...(memory.get(key) ?? []), date].slice(-35));
    try {
      if (!pageOnly) store(base(key), date);
    } catch {
      pageOnly = true;
    }
  };
  /** Drops every claim whose key starts with `keys`, from page memory and storage. */
  const forget = (keys: string) => {
    for (const key of memory.keys()) if (key.startsWith(keys)) memory.delete(key);
    try {
      for (const item of Object.keys(localStorage))
        if (item.startsWith(keys)) localStorage.removeItem(item);
    } catch {
      /* Blocked storage holds no claims to drop. */
    }
  };
  return { has, add, forget };
}

/** Names the gate claim a 202 receipt earns: `check` when enabled, `quiet` when disabled. */
const receiptClaim = (status: number, data: unknown) => {
  const reply = data && typeof data === "object" && "status" in data ? data.status : undefined;
  if (status !== 202) return undefined;
  if (reply === "disabled") return "quiet";
  return reply === "queued" || reply === "skipped" ? "check" : undefined;
};

/** Reports daily app-open and screens, gates visits, and pauses trackers until an enabled receipt. */
export function startBrowserTelemetry({
  route,
  surface,
  storageKey,
  post,
}: BrowserTelemetryOptions): BrowserTelemetryReporter {
  const prefix = `${storageKey}.browser.v1.`,
    claims = claimHistory(storageKey);
  const screens = new Set<string>(),
    listeners = new Set<(quiet: boolean, reason: BrowserTelemetryQuietReason) => void>(),
    outcomes: { event: VisitEvent; options?: VisitOptions }[] = [];
  const pending = new Map<string, object>();
  let day = today(),
    generation = {},
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    failures = 0,
    ordinaryEligibleAt = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastReason: BrowserTelemetryQuietReason = "checking";
  const reason = (): BrowserTelemetryQuietReason =>
    stopped
      ? "stopped"
      : gate === "disabled"
        ? "disabled"
        : failures >= 6
          ? "unavailable"
          : gate === "enabled"
            ? "enabled"
            : "checking";
  const notify = () => {
    const value = reason();
    if (lastReason === value) return;
    lastReason = value;
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      if (lastReason !== value) break;
      if (listeners.has(listener)) listener(value !== "enabled", value);
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
  // Opting out also drops the stored screen names, the only browsing history kept here.
  const forgetScreens = () => claims.forget(`${prefix}screen.`);
  const disabled = (): boolean => {
    gate = readGate();
    if (gate === "disabled") {
      outcomes.length = 0;
      cancelRetry();
      // Storage can't check and write atomically across tabs, so a racing tab's late
      // screen claim can outlive the opt-out; every page that sees the opt-out drops it.
      forgetScreens();
    }
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
      response = await post(route, event, options);
      if (response.status === 202) {
        try {
          data = "data" in response ? response.data : await response.json();
        } catch {
          /* Unreadable receipts cannot establish the gate; the daemon may already have accepted the event. */
        }
      }
    } catch {
      response = undefined;
      /* Receipt checks retry transport failures. */
    }
    // An unknown visit check that earns no claim fails like an outage; other daily replies
    // stay claimed. A 401 claims nothing and stops reporting until a restart or the next day.
    const claim = response && receiptClaim(response.status, data);
    const unauthorized = response?.status === 401;
    const failed =
      !response ||
      (response.status >= 500 && response.status < 600) ||
      (checking && key === undefined && !claim);
    // Claims keep the sending date, even after cleanup, so a restarted page doesn't resend them.
    if (claim) claims.add(`${prefix}${claim}`, sending);
    // Another tab's opt-out may have deleted screen history this page's stale gate can't see.
    const optedOut =
      claim === "quiet" ||
      gate === "disabled" ||
      [sending, day, today()].some((date) => claims.has(`${prefix}quiet`, date));
    if (!failed && !unauthorized && key !== undefined && !optedOut) claims.add(key, sending);
    if (claim === "quiet") forgetScreens();
    if (stopped) return release();
    // A disabled receipt stops the current page. One that lands after this page began a
    // later day also claims that day, so a reload stays as quiet as this page.
    if (claim === "quiet") {
      gate = "disabled";
      if (owner !== generation) claims.add(`${prefix}quiet`, day);
    }
    rollover();
    const isDisabled = disabled();
    if (owner !== generation) {
      release();
      pump();
      return;
    }
    if (unauthorized && !isDisabled) {
      failures = 6;
      cancelRetry();
      notify();
      return release();
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
    // Only the current day's enabled gate releases held visits, oldest first.
    if (gate === "enabled")
      for (const outcome of outcomes.splice(0))
        void send(outcome.event, undefined, outcome.options);
    if (visit) {
      if (gate === "unknown" && (outcomes.length > 0 || pending.has(day) || retry)) {
        try {
          if (outcomes.length < 64) outcomes.push(structuredClone({ event: visit, options }));
        } catch {
          /* A payload that can't be copied is dropped rather than interrupting the caller. */
        }
        pump();
        return;
      }
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
  return {
    stop() {
      stopped = true;
      ordinaryEligibleAt = 0;
      cancelRetry();
      screens.clear();
      outcomes.length = 0;
      notify();
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    disable() {
      for (const date of new Set([day, today()])) claims.add(`${prefix}quiet`, date);
      gate = "disabled";
      outcomes.length = 0;
      forgetScreens();
      cancelRetry();
      notify();
    },
    reportScreen(screen: string) {
      currentScreen = screen;
      screens.add(screen);
      pump();
    },
    reportVisit: (event: VisitEvent, options?: VisitOptions) => pump(event, options),
    onQuietChange(listener: (quiet: boolean, reason: BrowserTelemetryQuietReason) => void) {
      if (!stopped) listeners.add(listener);
      const value = reason();
      listener(value !== "enabled", value);
      return () => void listeners.delete(listener);
    },
  };
}
