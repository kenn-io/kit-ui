export type StatusDotStatus = "working" | "waiting" | "idle" | "stale" | "unclean" | "quiet";
interface Props {
    status: StatusDotStatus;
    /** Accessible label / tooltip; defaults to the status name. */
    label?: string;
    size?: number;
    /** Opt into compositor-friendly motion for working and waiting states. */
    animated?: boolean;
}
declare const StatusDot: import("svelte").Component<Props, {}, "">;
type StatusDot = ReturnType<typeof StatusDot>;
export default StatusDot;
