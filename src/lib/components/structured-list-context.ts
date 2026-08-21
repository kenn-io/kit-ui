export interface StructuredListLabels {
  readonly primary: string;
  readonly secondary: string;
  readonly description: string;
  readonly status: string;
}

export const structuredListLabelsContext = Symbol("structured-list-labels");
