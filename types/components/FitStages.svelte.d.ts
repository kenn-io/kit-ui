import type { Snippet } from "svelte";
interface Props {
    /** Renderings of the same control at decreasing widths, ordered richest
     * first, most compact last. The last stage is the unconditional
     * fallback when nothing fits. */
    stages: Snippet[];
    /** Index of the currently rendered stage (bindable, read-only in
     * spirit) — lets the surrounding code react to a downgrade. */
    stage?: number;
    /** Fires whenever measurement switches the rendered stage. */
    onstagechange?: (stage: number) => void;
    class?: string;
}
declare const FitStages: import("svelte").Component<Props, {}, "stage">;
type FitStages = ReturnType<typeof FitStages>;
export default FitStages;
