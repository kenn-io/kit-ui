/** Body posted for each app open. Daemons drop properties their allowlist lacks. */
export interface AppOpenedEvent {
    event: "app_opened";
    properties: {
        surface: string;
    };
}
export interface AppOpenedOptions {
    /** Daemon route that accepts UI telemetry, e.g. "/api/v1/telemetry/events". */
    route: string;
    /** Where the open happened, e.g. "web". */
    surface: string;
    /** Stable localStorage key, unique to the product or installation and surface. */
    storageKey: string;
    /** Resolves with the HTTP status, including errors. Rejects only when no response arrived. */
    post: (route: string, event: AppOpenedEvent) => Promise<{
        status: number;
    }>;
}
/**
 * Posts `app_opened` now and on the first window focus of each later UTC day;
 * returns a cleanup. Retries back off from 1 to 30 seconds until the backend
 * answers, then ignores the outcome. localStorage carries the day across reloads
 * and tabs, though tabs that open together may each send one; when storage is
 * blocked, memory still holds it for this page.
 */
export declare function startAppOpenedReporting({ route, surface, storageKey, post, }: AppOpenedOptions): () => void;
