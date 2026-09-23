import type { Snippet } from "svelte";
import { type CardLevel, type CardTone } from "./Card.svelte";
interface Props {
    label: string;
    value: string;
    meta?: string | undefined;
    tone?: CardTone | undefined;
    level?: CardLevel;
    ariaLabel?: string | undefined;
    children?: Snippet;
    footer?: Snippet;
}
declare const MetricCard: import("svelte").Component<Props, {}, "">;
type MetricCard = ReturnType<typeof MetricCard>;
export default MetricCard;
