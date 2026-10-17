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
    route: string;
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
    reportScreen(screen: string): void;
    reportVisit(event: VisitEvent, options?: VisitOptions): void;
    /** Immediately receives the current state; returns an unsubscribe function. */
    onQuietChange(listener: (quiet: boolean) => void): () => void;
}
export declare function startAppOpenedReporting(options: BrowserTelemetryOptions): AppOpenedReporter;
export declare function startAppOpenedReporting(options: AppOpenedOptions): () => void;
