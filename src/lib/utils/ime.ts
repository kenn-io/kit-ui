/**
 * Whether a keydown belongs to an input method composing text, such as
 * Enter confirming a Japanese candidate, Escape cancelling it, or an arrow
 * moving between candidates. A handler that acts on those keys should leave
 * such an event alone. Safari ends a composition with a keydown whose
 * `isComposing` is false, so key code 229 counts too.
 */
export function isComposingKey(event: KeyboardEvent): boolean {
  // keyCode is deprecated, but it is the only signal Safari gives.
  return event.isComposing || event.keyCode === 229;
}
