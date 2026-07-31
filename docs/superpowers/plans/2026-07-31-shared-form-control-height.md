# Shared Form Control Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make kit-ui's large form inputs and actions share the approved 36px minimum height.

**Architecture:** Keep the existing `lg` size API. Update the three primitives that own large control geometry, then let `FormField` and `ProviderButton` continue inheriting that geometry through composition. Browser coverage will protect the cross-component relationship at the default and enlarged root type sizes while rejecting both the compact 28px and oversized 40px endpoints at the default size.

**Tech Stack:** Svelte 5, scoped CSS, Playwright, Vite+

## Global Constraints

- The shared `lg` form-control minimum height is 36px.
- Large inputs and actions grow together when the root type size needs more room.
- Do not add application-specific CSS, copy, or authentication behavior.
- Keep ProviderButton's public `--provider-button-height` override.
- Commit locally; do not push.

---

### Task 1: Balance Shared Large Controls

**Files:**

- Modify: `src/lib/components/Button.svelte`
- Modify: `src/lib/components/TextInput.svelte`
- Modify: `src/lib/components/ProviderButton.svelte`
- Modify: `tests/browser/button.spec.ts`
- Modify: `tests/browser/auth-components.spec.ts`
- Modify: `src/demo/pages/TextInputDemo.svelte`
- Modify: `docs/components/button.md`
- Modify: `docs/components/text-input.md`
- Modify: `docs/components/auth-surfaces.md`
- Modify: `docs/components/provider-brand.md`

**Interfaces:**

- Consumes: Existing `size="lg"` on `Button` and `TextInput`; existing `--provider-button-height` CSS property.
- Produces: A 36px minimum large control height shared by `Button`, `TextInput`, `FormField`, and `ProviderButton`.

- [x] **Step 1: Write the failing browser relationship test**

  Update `tests/browser/button.spec.ts` so the large Button and FormField input must have equal rendered heights, the large Button remains taller than the medium Button, and the shared height is below the rejected 40px endpoint. Remove the exact FormField height assertion from `tests/browser/auth-components.spec.ts`; the new cross-component relationship supersedes it.

- [x] **Step 2: Run the focused browser test and verify the oversized endpoint fails**

  Run `bun run test:browser -- tests/browser/button.spec.ts -g "large buttons share" --reporter=line`. Expect failure because the current large height is 40px.

- [x] **Step 3: Implement the 36px shared size**

  Give `.kit-button--lg` and `.kit-text-input--lg` a 36px minimum height, and change ProviderButton's default `--provider-button-height` fallback to 36px. Preserve all existing padding, typography, state, and public override behavior.

- [x] **Step 4: Update demo copy and component documentation**

  Replace the obsolete 40px large-size descriptions with 36px in the TextInput demo and the Button, TextInput, auth-surface, and provider-brand references.

- [x] **Step 5: Verify the focused behavior and full kit checks**

  Run the focused browser test, the provider-brand browser spec, format, lint, Svelte check, unit tests, full browser tests, usage checking, production build, Svelte autofixers for the three changed components, and the Impeccable detector. Inspect the rendered large input and actions together and confirm each computes to 36px by default and grows without clipping at enlarged root type sizes.

- [x] **Step 6: Commit locally**

  `git commit -m "Balance large form control sizing"`
