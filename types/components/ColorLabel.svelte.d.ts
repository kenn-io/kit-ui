export type ColorLabelSize = "sm" | "md";
interface Props {
    /** Label text. */
    name: string;
    /** Background hex color, with or without `#` (3 or 6 digits). Invalid
     * values fall back to a neutral gray. */
    color: string;
    size?: ColorLabelSize;
    title?: string | undefined;
    class?: string;
}
declare const ColorLabel: import("svelte").Component<Props, {}, "">;
type ColorLabel = ReturnType<typeof ColorLabel>;
export default ColorLabel;
