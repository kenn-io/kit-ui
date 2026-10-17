/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
  event: "app_opened";
  properties: { surface: string };
}
interface Receipt {
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
  post: (route: string, event: AppOpenedEvent) => Promise<Receipt>;
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
  post: (route: string, event: BrowserTelemetryEvent, options?: VisitOptions) => Promise<Receipt>;
}
export interface AppOpenedReporter {
  (): void;
  reportScreen(screen: string): void;
  reportVisit(event: VisitEvent, options?: VisitOptions): void;
  /** Immediately receives the current state; returns an unsubscribe function. */
  onQuietChange(listener: (quiet: boolean) => void): () => void;
}
interface DailyState {
  day: string;
  quiet: boolean;
  screens: string[];
}
const NOT_READY = new Set([502, 503, 504]);
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
  let day = today(),
    appDay = "",
    stopped = false,
    active = false,
    failures = 0;
  let state: DailyState = { day: "", quiet: false, screens: [] };
  let currentScreen: string | undefined,
    retry: ReturnType<typeof setTimeout> | undefined,
    lastQuiet = false;
  const pending = new Set<string>(),
    listeners = new Set<(quiet: boolean) => void>();
  const visits: [VisitEvent, VisitOptions | undefined][] = [];
  const stateKey = `${storageKey}.state`;
  const quiet = (): boolean => stopped || state.quiet;
  const notify = (): void => {
    if (lastQuiet === quiet()) return;
    lastQuiet = quiet();
    for (const listener of listeners) listener(lastQuiet);
  };
  const sync = (): void => {
    try {
      appDay = [appDay, localStorage.getItem(storageKey) ?? ""].sort().at(-1)!;
      const saved: DailyState = JSON.parse(localStorage.getItem(stateKey) ?? "null");
      if (saved?.day > state.day) state = saved;
      else if (saved?.day === state.day)
        state = {
          day: state.day,
          quiet: state.quiet || saved.quiet,
          screens: [...new Set([...state.screens, ...saved.screens])],
        };
    } catch {
      /* Missing or blocked storage leaves page memory intact. */
    }
    notify();
  };
  const enabled = (): boolean =>
    (state.day === day && !state.quiet) || (appDay >= day && state.day !== day);
  const send = async (visit?: VisitEvent, options?: VisitOptions): Promise<void> => {
    if (stopped) return;
    rollover();
    if (retry || failures >= 6 || (state.day === day && state.quiet)) return;
    sync();
    if (state.day === day && state.quiet) return;
    if (active && (!visit || !enabled())) {
      if (visit) visits.push([visit, options]);
      return;
    }
    const screen = [...pending].find((name) => state.day !== day || !state.screens.includes(name));
    const event =
      visit ??
      (appDay < day
        ? { event: "app_opened", properties: { surface } }
        : screen === undefined
          ? undefined
          : { event: "screen_viewed", properties: { surface, screen } });
    if (!event) return;
    const sending = day;
    const blocking = !visit || !enabled();
    if (blocking) active = true;
    let response: Receipt | undefined, data: unknown;
    try {
      response = await (post as BrowserTelemetryOptions["post"])(route, event, options);
      if (response.status === 202) {
        try {
          data = response.data ?? (await response.json?.());
        } catch {
          /* Legacy terminal response. */
        }
      }
    } catch {
      /* Transport failures share the retry budget. */
    }
    if (stopped || sending !== day || sending !== today()) return;
    if (blocking) active = false;
    if (state.day === day && state.quiet) return;
    if (!response || NOT_READY.has(response.status)) {
      clearTimeout(retry);
      if (++failures < 6)
        retry = setTimeout(
          () => {
            retry = undefined;
            void send();
          },
          1000 * 2 ** (failures - 1),
        );
      else {
        retry = undefined;
        visits.length = 0;
      }
      return;
    }
    failures = 0;
    clearTimeout(retry);
    retry = undefined;
    sync();
    const disabled =
      data && typeof data === "object" && "status" in data && data.status === "disabled";
    const screens = state.day === day ? state.screens : [];
    state = { day, quiet: (state.day === day && state.quiet) || !!disabled, screens };
    if (!visit && event.event === "app_opened") {
      appDay = [appDay, sending].sort().at(-1)!;
    }
    if (!visit && event.event === "screen_viewed" && screen !== undefined) {
      state.screens = [...new Set([...screens, screen])];
      pending.delete(screen);
    }
    try {
      localStorage.setItem(storageKey, appDay);
      localStorage.setItem(stateKey, JSON.stringify(state));
    } catch {
      /* Page memory holds failed writes. */
    }
    notify();
    if (state.quiet) {
      pending.clear();
      visits.length = 0;
      return;
    }
    for (const [visit, options] of visits.splice(0)) void send(visit, options);
    void send();
  };
  const rollover = (): void => {
    if (day === today()) return;
    day = today();
    active = false;
    failures = 0;
    clearTimeout(retry);
    retry = undefined;
    pending.clear();
    visits.length = 0;
    if (currentScreen !== undefined) pending.add(currentScreen);
  };
  const report = (): void => {
    if (stopped || (day === today() && state.day === day && state.quiet)) return;
    void send();
  };
  report();
  window.addEventListener("focus", report);
  return Object.assign(
    () => {
      stopped = true;
      clearTimeout(retry);
      pending.clear();
      visits.length = 0;
      notify();
      listeners.clear();
      window.removeEventListener("focus", report);
    },
    {
      reportScreen(screen: string) {
        currentScreen = screen;
        if (quiet()) return;
        pending.add(screen);
        void send();
      },
      reportVisit(event: VisitEvent, options?: VisitOptions) {
        if (!quiet()) void send(event, options);
      },
      onQuietChange(listener: (quiet: boolean) => void) {
        listener(quiet());
        if (!stopped) listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
  );
}
