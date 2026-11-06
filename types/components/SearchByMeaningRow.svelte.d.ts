import { type SearchByMeaningLabels, type SearchByMeaningState } from "./search-by-meaning.js";
interface Props {
    state: SearchByMeaningState;
    /** Noun selected by the caller for itemCount or total, including plural rules. */
    itemNoun: string;
    labels?: Partial<SearchByMeaningLabels>;
    /** BCP 47 locale for numbers, download sizes, and durations; defaults to the runtime locale. */
    locale?: string | undefined;
    /** Show status only, with no button, for viewers who can't change it. */
    readonly?: boolean;
    onturnon: () => void;
    onusebuiltin: () => void;
}
declare const SearchByMeaningRow: import("svelte").Component<Props, {}, "">;
type SearchByMeaningRow = ReturnType<typeof SearchByMeaningRow>;
export default SearchByMeaningRow;
