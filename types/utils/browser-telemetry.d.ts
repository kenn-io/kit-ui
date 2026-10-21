/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
    event: "app_opened";
    properties: {
        surface: string;
    };
}
export interface VisitEvent {
    event: string;
    properties: Record<string, unknown>;
}
export interface ScreenViewedEvent {
    event: "screen_viewed";
    properties: {
        surface: string;
        screen: string;
    };
}
export type BrowserTelemetryEvent = AppOpenedEvent | ScreenViewedEvent | VisitEvent;
export interface VisitOptions {
    keepalive?: boolean;
}
/** Why the reporter is quiet, or `enabled` when it is not. */
export type BrowserTelemetryQuietReason = "checking" | "enabled" | "disabled" | "unavailable" | "stopped";
/** A daemon reply with its body: a `Response` with an unread body, or the parsed `data`. */
export type TelemetryReceipt = {
    status: number;
    data: unknown;
} | {
    status: number;
    json: () => Promise<unknown>;
};
export interface BrowserTelemetryOptions {
    /** Daemon route that accepts UI telemetry, e.g. "/api/v1/telemetry/events". */
    route: string;
    /** Where the open happened, e.g. "web". */
    surface: string;
    /** Stable key unique to the product or installation and surface. */
    storageKey: string;
    /** Resolve HTTP errors with their receipt; reject only when no response arrived. */
    post: (route: string, event: BrowserTelemetryEvent, options?: VisitOptions) => Promise<TelemetryReceipt>;
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
    onQuietChange(listener: (quiet: boolean, reason: BrowserTelemetryQuietReason) => void): () => void;
}
/** Reports daily app-open, screens, and keyed events; gates visits until an enabled receipt. */
export declare function startBrowserTelemetry({ route, surface, storageKey, post, }: BrowserTelemetryOptions): BrowserTelemetryReporter;
