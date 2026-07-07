export interface MentionOption {
  /** Stable identity for row keying. */
  id: string;
  /** Inserted after the trigger character on select (e.g. an issue id). */
  insert: string;
  /** Primary row text. */
  label: string;
  /** Secondary text, rendered dim at the row's trailing edge. */
  meta?: string;
}
