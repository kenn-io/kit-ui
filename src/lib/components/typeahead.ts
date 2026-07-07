export interface TypeaheadOption {
  name: string;
  label: string;
  /** Shown on the closed trigger instead of `label` when provided. */
  displayLabel?: string;
  count?: number;
  /** Secondary text: searched together with the label, rendered dim at the
   * row's trailing edge. */
  meta?: string;
  /** Makes this option a group row: it expands/collapses its children
   * instead of being selectable. `name` must still be unique across the
   * whole tree (it keys rows and tracks expansion). */
  children?: TypeaheadOption[];
  /** Initial expansion for a group row (default true). */
  expanded?: boolean;
}
