import type { Snippet } from "svelte";
interface Props {
    primary: Snippet;
    secondary?: Snippet;
    description?: Snippet;
    status?: Snippet;
    detail?: Snippet;
    ariaLabel?: string;
}
declare const StructuredListRow: import("svelte").Component<Props, {}, "">;
type StructuredListRow = ReturnType<typeof StructuredListRow>;
export default StructuredListRow;
