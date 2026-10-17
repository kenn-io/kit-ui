/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
    event: "app_opened";
    properties: {
        surface: string;
    };
}
export interface ScreenViewedEvent {
    event: "screen_viewed";
    properties: {
        surface: string;
        screen: string;
    };
}
/** Visit names and properties belong to the consuming product. */
export interface VisitEvent {
    event: string;
    properties: Record<string, unknown>;
}
export type BrowserTelemetryEvent = AppOpenedEvent | ScreenViewedEvent | VisitEvent;
export interface VisitOptions {
    keepalive?: boolean;
}
export interface AppOpenedOptions {
    /** Daemon route that accepts UI telemetry. */
    route: string;
    surface: string;
    /** Stable key unique to the product or installation and surface. */
    storageKey: string;
    /** Resolve HTTP errors; reject only when no response arrived. Preserve receipts. */
    post: (route: string, event: BrowserTelemetryEvent, options?: VisitOptions) => Promise<{
        status: number;
        data?: unknown;
        json?: () => Promise<unknown>;
    }>;
}
export interface AppOpenedReporter {
    (): void;
    reportScreen(screen: string): void;
    reportVisit(event: VisitEvent, options?: VisitOptions): void;
    /** Immediately receives the current quiet state; returns an unsubscribe function. */
    onQuietChange(listener: (quiet: boolean) => void): () => void;
}
/** Shared daily browser reports, bounded retries, and a persisted quiet UTC day. */
export declare function startAppOpenedReporting({ route, surface, storageKey, post, }: AppOpenedOptions): AppOpenedReporter;
