import type { ProviderBrand } from "./provider-brand.js";
interface Props {
    provider: ProviderBrand;
    label: string;
    iconUrl?: string;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    title?: string;
    ariaLabel?: string;
    class?: string;
    onclick?: (event: MouseEvent) => void;
}
declare const ProviderButton: import("svelte").Component<Props, {}, "">;
type ProviderButton = ReturnType<typeof ProviderButton>;
export default ProviderButton;
