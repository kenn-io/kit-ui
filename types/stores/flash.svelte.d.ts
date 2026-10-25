export type FlashTone = "neutral" | "info" | "success" | "warning" | "danger";
/** A single follow-up control in a banner, such as Undo. Running it
 * dismisses the flash. */
export interface FlashAction {
    label: string;
    onclick: () => void;
}
export interface FlashOptions {
    durationMs?: number;
    /** Semantic accent for the banner (neutral default). */
    tone?: FlashTone;
    action?: FlashAction;
}
export interface FlashState {
    message: string;
    durationMs: number;
    /** Optional on the public shape (external mocks/wrappers predate it);
     * consumers should read it as `tone ?? "neutral"`. */
    tone?: FlashTone;
    action?: FlashAction;
    /** Increments per showFlash call; keys each banner and its countdown. */
    id: number;
}
/** Show a flash. The second argument keeps the original duration-only
 * form (`showFlash("Saved", 10000)`) and also accepts an options object
 * (`showFlash("Merged", { tone: "success" })`). */
export declare function showFlash(msg: string, durationMs?: number): number;
export declare function showFlash(msg: string, options?: FlashOptions): number;
/** Run a flash's action and dismiss it. A flash that has already been
 * dismissed (timer, X, or the stack cap) does nothing. */
export declare function runFlashAction(id: number): void;
/** All currently visible flashes, oldest first. */
export declare function getFlashes(): FlashState[];
/** The most recent flash (or null). Kept for single-flash consumers. */
export declare function getFlash(): FlashState | null;
export declare function getFlashMessage(): string | null;
/** Dismiss one flash by id, or every flash when called without one.
 * Non-number arguments dismiss everything too, so the pre-stacking usage
 * `onclick={dismissFlash}` (which passes the event) keeps working — the
 * unknown overload makes that legal under strict TypeScript as well. */
export declare function dismissFlash(id?: number): void;
export declare function dismissFlash(event: unknown): void;
