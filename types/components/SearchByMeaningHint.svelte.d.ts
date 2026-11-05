import { type SearchByMeaningLabels } from "./search-by-meaning.js";
interface Props {
    onturnon: () => void;
    labels?: Partial<SearchByMeaningLabels>;
}
declare const SearchByMeaningHint: import("svelte").Component<Props, {}, "">;
type SearchByMeaningHint = ReturnType<typeof SearchByMeaningHint>;
export default SearchByMeaningHint;
