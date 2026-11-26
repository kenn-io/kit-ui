export type StructuredListLevel = "inset" | "default" | "raised";
export interface StructuredListLabels {
    readonly primary: string;
    readonly secondary: string;
    readonly description: string;
    readonly status: string;
}
export declare const structuredListLabelsContext: unique symbol;
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
