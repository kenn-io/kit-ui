import type { ProviderBrand } from "./provider-brand.js";
interface Props {
    provider: ProviderBrand;
    iconUrl?: string;
    label?: string;
    size?: number;
    class?: string;
}
declare const ProviderBrandMark: import("svelte").Component<Props, {}, "">;
type ProviderBrandMark = ReturnType<typeof ProviderBrandMark>;
export default ProviderBrandMark;
