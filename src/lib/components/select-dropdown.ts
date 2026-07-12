/** Tone of an option's status dot. `neutral` renders muted (`--text-muted`);
 * the semantic tones resolve through the shared `data-kit-tone` accent map. */
export type SelectDropdownIndicatorTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Small status dot after an option's label. Color alone shouldn't carry
 * the meaning — give it a `title` describing what the dot signals. */
export interface SelectDropdownIndicator {
  tone?: SelectDropdownIndicatorTone;
  /** Tooltip / accessible description ("roborev daemon unreachable"). */
  title?: string;
}

export interface SelectDropdownOption {
  value: string;
  label: string;
  triggerLabel?: string;
  disabled?: boolean;
  indicator?: SelectDropdownIndicator;
}
