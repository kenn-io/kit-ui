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
  /**
   * Reports once per UTC day for each stable caller key. Use a finite set without record IDs.
   * Drops unsent queued actions at UTC rollover; report again only when the action occurs that day.
   * Discards actions while disabled until a later day's load or focus check enables reporting.
   */
  reportDaily(key: string, event: VisitEvent): void;
  /**
   * Holds up to 64 copied visits per `storageKey` in localStorage while a permission check is
   * pending; they survive page close and UTC rollover for 35 days and send after an enabled
   * receipt. A full queue drops new ones. Opt-out discards held visits, even late writes from
   * other tabs. Racing tabs or a crash after a send starts can send a visit twice.
   */
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
  /** Drops every claim whose key starts with one of `prefixes`, from page memory and storage. */
  const forget = (...prefixes: string[]) => {
    const matches = (key: string) => prefixes.some((start) => key.startsWith(start));
    for (const key of memory.keys()) if (matches(key)) memory.delete(key);
    try {
      for (const item of Object.keys(localStorage))
        if (matches(item)) localStorage.removeItem(item);
    } catch {
      /* Blocked storage holds no claims to drop. */
    }
  };
  return { has, add, forget };
}

/**
 * Keeps one synchronous localStorage record per visit, so held visits survive page close
 * without tabs overwriting each other. Each record carries the opt-out token current at
 * its admission; reads discard records whose token no longer matches, so a stale tab's
 * write that lands after an opt-out never sends, whatever the clocks say.
 */
function pendingOutcomes(prefix: string) {
  type Outcome = {
    event: VisitEvent;
    options?: VisitOptions;
    rank: number;
    day: string;
    token: string;
  };
  const records = `${prefix}outcome.v1.`,
    tokenKey = `${prefix}optout`;
  const page = new Map<string, Outcome>();
  let memory = new Map<string, Outcome>();
  let pageOnly = false,
    pageToken = "";
  const forget = () => {
    page.clear();
    memory.clear();
  };
  /** The opt-out token, read fresh from storage; absent until the first opt-out. */
  const token = () => {
    try {
      return localStorage.getItem(tokenKey) ?? "";
    } catch {
      return pageToken;
    }
  };
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const valid = (value: unknown): value is Outcome =>
    object(value) &&
    typeof value["day"] === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value["day"]) &&
    typeof value["token"] === "string" &&
    Number.isSafeInteger(value["rank"]) &&
    Number(value["rank"]) > 0 &&
    object(value["event"]) &&
    typeof value["event"]["event"] === "string" &&
    object(value["event"]["properties"]) &&
    (value["options"] === undefined ||
      (object(value["options"]) &&
        (value["options"]["keepalive"] === undefined ||
          typeof value["options"]["keepalive"] === "boolean")));
  const remove = (key: string) => {
    memory.delete(key);
    page.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      // The page still consumes its copy when storage is blocked.
    }
  };
  const read = () => {
    const current = token();
    try {
      if (!pageOnly) {
        const shared = new Map<string, Outcome>();
        for (const key of Object.keys(localStorage).filter((key) => key.startsWith(records))) {
          const raw = localStorage.getItem(key);
          if (raw === null) continue; // Another tab may have consumed it after enumeration.
          let value: unknown;
          try {
            value = JSON.parse(raw);
          } catch {
            /* Remove malformed records independently. */
          }
          if (valid(value)) shared.set(key, value);
          else remove(key);
        }
        memory = new Map([...shared, ...page]);
      }
    } catch {
      // Unreadable storage leaves this page's mirror authoritative.
      pageOnly = true;
    }
    // Like claim history, visits older than 35 days are discarded rather than replayed.
    const oldest = Date.parse(today()) - 35 * 86_400_000;
    for (const [key, outcome] of memory)
      if (outcome.token !== current || !(Date.parse(outcome.day) >= oldest)) remove(key);
    memory = new Map([...memory].sort(([a, x], [b, y]) => x.rank - y.rank || a.localeCompare(b)));
    return memory;
  };
  return {
    token,
    /** Holds a visit admitted on `day` under the opt-out `admitted` token. */
    add(event: VisitEvent, options: VisitOptions | undefined, day: string, admitted: string) {
      if (read().size >= 64) return;
      try {
        const rank = Math.max(0, ...[...memory.values()].map((item) => item.rank)) + 1;
        const outcome = structuredClone({
          event,
          options,
          rank,
          day,
          token: admitted,
        });
        const key = records + crypto.getRandomValues(new Uint32Array(4)).join("-");
        memory.set(key, outcome);
        try {
          if (pageOnly) page.set(key, outcome);
          else localStorage.setItem(key, JSON.stringify(outcome));
        } catch {
          // One failed write keeps only this visit on the page; later writes still try storage.
          page.set(key, outcome);
        }
      } catch {
        // Optional reporting must not interrupt callers with an uncopyable payload.
      }
    },
    size: () => read().size,
    /** The oldest held visit and its record key, left stored until its send starts. */
    first: () => read().entries().next().value,
    remove,
    /** Drops this page's copies; stored records stay for other reporters. */
    forget,
    /**
     * Removes every stored outcome version, freeing space first, then publishes a fresh
     * random token so visits admitted under any earlier token, including late writes, are discarded.
     */
    optOut() {
      forget();
      try {
        for (const item of Object.keys(localStorage))
          if (item.startsWith(`${prefix}outcome.`)) localStorage.removeItem(item);
      } catch {
        /* Blocked storage holds no records to drop. */
      }
      pageToken = crypto.getRandomValues(new Uint32Array(4)).join("-");
      try {
        localStorage.setItem(tokenKey, pageToken);
      } catch {
        /* Page memory keeps the token when storage is blocked. */
      }
    },
  };
}

/** Names the gate claim a 202 receipt earns: `check` when enabled, `quiet` when disabled. */
const receiptClaim = (status: number, data: unknown) => {
  const reply = data && typeof data === "object" && "status" in data ? data.status : undefined;
  if (status !== 202) return undefined;
  if (reply === "disabled") return "quiet";
  return reply === "queued" || reply === "skipped" ? "check" : undefined;
};

/** Today's next unsent check as `send` arguments: the app open, then the first unclaimed screen. */
const nextCheck = (
  claims: ReturnType<typeof claimHistory>,
  storageKey: string,
  surface: string,
  screens: Set<string>,
  day: string,
): [VisitEvent, string] | undefined => {
  if (!claims.has(storageKey, day))
    return [{ event: "app_opened", properties: { surface } }, storageKey];
  for (const screen of screens) {
    const key = `${storageKey}.browser.v1.screen.${encodeURIComponent(screen)}`;
    if (!claims.has(key, day))
      return [{ event: "screen_viewed", properties: { surface, screen } }, key];
  }
  return undefined;
};

/** Reports daily app-open, screens, and keyed events; gates visits until an enabled receipt. */
export function startBrowserTelemetry({
  route,
  surface,
  storageKey,
  post,
}: BrowserTelemetryOptions): BrowserTelemetryReporter {
  const prefix = `${storageKey}.browser.v1.`,
    claims = claimHistory(storageKey);
  const screens = new Set<string>(),
    daily = new Map<string, VisitEvent | undefined>(),
    listeners = new Set<(quiet: boolean, reason: BrowserTelemetryQuietReason) => void>();
  const outcomes = pendingOutcomes(prefix);
  const pending = new Map<string, { queued: boolean }>();
  let day = today(),
    generation = {},
    gate: "unknown" | "enabled" | "disabled" = "unknown";
  let stopped = false,
    failures = 0,
    ordinaryEligibleAt = 0;
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastReason: BrowserTelemetryQuietReason = "checking";
  const due = () => nextCheck(claims, storageKey, surface, screens, day);
  const nextDaily = (): [VisitEvent, string] | undefined => {
    for (const [key, event] of daily) {
      if (event && !claims.has(key, day)) return [event, key];
      daily.set(key, undefined);
    }
    return undefined;
  };
  // No open, screen, or daily action remains to check, and permission is unknown.
  const exhausted = () =>
    gate === "unknown" && !pending.has(day) && !retry && !due() && !nextDaily();
  const reason = (): BrowserTelemetryQuietReason =>
    stopped
      ? "stopped"
      : gate === "disabled"
        ? "disabled"
        : failures >= 6 || exhausted()
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
  // Opting out also drops stored screen names and caller keys.
  const forgetHistory = () => {
    claims.forget(`${prefix}screen.`, `${prefix}daily.`);
    daily.clear();
  };
  const disabled = (): boolean => {
    gate = readGate();
    if (gate === "disabled") {
      cancelRetry();
      // A page that only reads the opt-out leaves stored visits alone: other tabs may have
      // admitted them under a newer token after a clock change.
      outcomes.forget();
      // Storage can't check and write atomically across tabs, so a racing tab's late
      // screen claim can outlive the opt-out; every page that sees the opt-out drops it.
      forgetHistory();
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
    daily.clear();
    if (currentScreen !== undefined) screens.add(currentScreen);
    notify();
  };
  const send = async (
    event: VisitEvent,
    key?: string,
    options?: VisitOptions,
    queued = false,
    checking = key !== undefined,
    started?: () => void,
  ) => {
    const sending = day;
    const owner = generation;
    const record = { queued };
    if (checking || queued) pending.set(sending, record);
    const release = () => {
      if ((checking || queued) && pending.get(sending) === record) pending.delete(sending);
    };
    let response: TelemetryReceipt | undefined, data: unknown;
    try {
      const request = post(route, event, options);
      started?.();
      response = await request;
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
    // Transport failures, 5xx, and 401 leave daily claims free.
    const claim = response && receiptClaim(response.status, data);
    const unauthorized = response?.status === 401;
    const failed = !response || (response.status >= 500 && response.status < 600);
    // Opting out drops held visits before the quiet claim is written, freeing space for it.
    if (claim === "quiet") outcomes.optOut();
    // Claims keep the sending date, even after cleanup, so a restarted page doesn't resend them.
    if (claim) claims.add(`${prefix}${claim}`, sending);
    // Another tab's opt-out may have deleted screen history this page's stale gate can't see.
    const optedOut =
      claim === "quiet" ||
      gate === "disabled" ||
      [sending, day, today()].some((date) => claims.has(`${prefix}quiet`, date));
    if (!failed && !unauthorized && key !== undefined && !optedOut) {
      claims.add(key, sending);
      if (owner === generation && daily.has(key)) daily.set(key, undefined);
    }
    if (claim === "quiet") forgetHistory();
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
    if (queued) release();
    if (failures < 6 && (checking || (!pending.has(day) && !retry))) {
      failures = 0;
      ordinaryEligibleAt = 0;
    }
    release();
    pump();
  };
  const pump = (visit?: VisitEvent, options?: VisitOptions, wake = false) => {
    rollover(wake);
    // A visit takes the opt-out token before the gate check, so an opt-out that lands
    // between the check and its write still discards it.
    const token = visit && outcomes.token();
    if (stopped || disabled() || failures >= 6) return;
    if (visit) {
      if (gate === "enabled" && options?.keepalive) return void send(visit, undefined, options);
      if (gate === "unknown" || outcomes.size() > 0 || pending.get(day)?.queued) {
        outcomes.add(visit, options, day, token!);
        pump();
        return;
      }
      if (performance.now() < ordinaryEligibleAt) return;
      void send(visit, undefined, options);
      return;
    }
    if (retry || pending.has(day)) return;
    const check = due() ?? nextDaily();
    const held = gate === "enabled" ? outcomes.first() : undefined;
    if (!held && !check) return;
    const delay = ordinaryEligibleAt - performance.now();
    if (delay > 0) {
      retry = setTimeout(() => {
        retry = undefined;
        pump();
      }, delay);
      return;
    }
    if (held) {
      const [id, outcome] = held;
      // Removed once its request starts; a crash before the reply may resend it after restart.
      void send(outcome.event, undefined, outcome.options, true, false, () => outcomes.remove(id));
    } else if (check) void send(...check);
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
      daily.clear();
      outcomes.forget();
      notify();
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    disable() {
      outcomes.optOut();
      for (const date of new Set([day, today()])) claims.add(`${prefix}quiet`, date);
      gate = "disabled";
      forgetHistory();
      cancelRetry();
      notify();
    },
    reportScreen(screen: string) {
      currentScreen = screen;
      screens.add(screen);
      pump();
    },
    reportDaily(key: string, event: VisitEvent) {
      if (stopped || gate === "disabled") return;
      rollover();
      const claim = `${prefix}daily.${encodeURIComponent(key)}`;
      if (daily.has(claim)) return;
      try {
        daily.set(claim, structuredClone(event));
      } catch {
        // Optional reporting must not interrupt the action when its payload can't be copied.
        return;
      }
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
