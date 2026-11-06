/** Shared by Accordion and the Disclosures inside it. `name` is the native
 * `<details name>` group that makes the accordion exclusive; it is
 * undefined when several items may stay open at once. */
export interface AccordionContext {
  readonly name: string | undefined;
}

export const accordionContext = Symbol("kit-accordion");
