import { type SearchByMeaningLabels, type SearchByMeaningState } from "./search-by-meaning.js";
interface Props {
    state: SearchByMeaningState;
    itemNoun: string;
    labels?: Partial<SearchByMeaningLabels>;
    onturnon: () => void;
    onusebuiltin: () => void;
}
declare const SearchByMeaningRow: import("svelte").Component<Props, {}, "">;
type SearchByMeaningRow = ReturnType<typeof SearchByMeaningRow>;
export default SearchByMeaningRow;
