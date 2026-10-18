/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
    event: "app_opened";
    properties: {
        surface: string;
    };
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
    properties: {
        surface: string;
        screen: string;
    };
}
export type BrowserTelemetryEvent = AppOpenedEvent | ScreenViewedEvent | VisitEvent;
export interface VisitOptions {
    keepalive?: boolean;
}
export interface BrowserTelemetryOptions extends Omit<AppOpenedOptions, "post"> {
    post: (route: string, event: BrowserTelemetryEvent, options?: VisitOptions) => Promise<TelemetryReceipt>;
}
export interface AppOpenedReporter {
    (): void;
    /** Use a stable, finite set of screen names, such as route names without IDs. */
    reportScreen(screen: string): void;
    reportVisit(event: VisitEvent, options?: VisitOptions): void;
    /** Immediately receives the current state; returns an unsubscribe function. */
    onQuietChange(listener: (quiet: boolean) => void): () => void;
}
/** Reports daily app-open and screens, gates visits, and pauses trackers until an enabled receipt. Call the reporter to stop. */
export declare function startAppOpenedReporting(options: BrowserTelemetryOptions): AppOpenedReporter;
/** Reports daily app-open on load or later UTC-day focus. Returns cleanup; retries stop after six failures until reload or the next UTC day. */
export declare function startAppOpenedReporting(options: AppOpenedOptions): () => void;
