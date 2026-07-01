export interface TypeaheadOption {
  name: string;
  label: string;
  /** Shown on the closed trigger instead of `label` when provided. */
  displayLabel?: string;
  count?: number;
}
