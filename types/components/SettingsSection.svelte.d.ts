import type { Snippet } from "svelte";
interface Props {
    title: string;
    /** Muted helper text under the title. */
    description?: string;
    /** The setting rows. */
    children: Snippet;
}
declare const SettingsSection: import("svelte").Component<Props, {}, "">;
type SettingsSection = ReturnType<typeof SettingsSection>;
export default SettingsSection;
