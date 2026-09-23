export type StructuredListLevel = "inset" | "default" | "raised";
import type { Snippet } from "svelte";
interface Props {
    ariaLabel: string;
    primaryLabel: string;
    secondaryLabel?: string;
    descriptionLabel?: string;
    statusLabel?: string;
    level?: StructuredListLevel;
    children?: Snippet;
}
declare const StructuredList: import("svelte").Component<Props, {}, "">;
type StructuredList = ReturnType<typeof StructuredList>;
export default StructuredList;
