# kit-ui

Shared Svelte 5 component library for kenn-io frontends (middleman,
agentsview). Consumed as source: `package.json` exports point at
`src/lib/index.ts`; there is no library build step. `vite build` bundles the
demo gallery only.

## Commands

```bash
bun install
bun run dev      # demo gallery (Vite dev server)
bun run check    # svelte-check — must stay at 0 errors / 0 warnings
bun run build    # builds the demo gallery
bun test         # checker rule tests (checks/rules.test.ts)
bun run check:usage        # dogfood kit-ui-check against src/demo (must be clean)
bun run svelte-mcp <cmd>   # Svelte 5 docs lookup / autofixer (see skills/)
```

## Layout

- `src/lib/` — the published library: `index.ts` (barrel), `theme.css`
  (design tokens), `breakpoints.ts` (shared responsive breakpoints),
  `components/`, `stores/`, `utils/`
- `bin/kit-ui-check.mjs` + `checks/` — usage checker external projects run to
  detect hand-rolled component equivalents (docs/checking.md). Rules are pure
  functions in `checks/rules.mjs` with tests alongside
- `src/demo/` — gallery app (`App.svelte` shell + `pages/*Demo.svelte`, one per
  component)
- `docs/` — per-component reference (`docs/components/*.md`), `theming.md`,
  `utilities.md`
- `skills/` — Svelte 5 skills replicated from middleman, symlinked into
  `.claude/skills/`

## Conventions

- **Svelte 5 runes only** — `$props()` with an explicit `interface Props`,
  `$derived` for computed values, `$effect` only as an escape hatch (event
  listeners on document/window while open). Follow
  `skills/svelte-core-bestpractices/SKILL.md`; validate non-trivial components
  with `bun run svelte-mcp svelte-autofixer <file>`.
- **Styling**: scoped `<style>` blocks, class names prefixed `kit-` with
  BEM-ish modifiers (`kit-button--solid`, `kit-chip__dot`). Components read
  only the CSS variables defined in `src/lib/theme.css` — no hard-coded
  palette colors (fallbacks like `var(--accent-green, #22c55e)` are fine).
- **No app coupling**: components take data via props (e.g. StatusDot takes a
  `status` string, not a session object). i18n-able strings are props with
  English defaults.
- **Spacing**: gaps/padding from the `--space-1…8` ladder (px on purpose —
  spacing shouldn't scale with the user's font preference).
- **Breakpoints**: only 640/760/900px in `@media` rules (see
  `src/lib/breakpoints.ts`); use `MEDIA.touch` / `MEDIA.reducedMotion`
  conventions.
- **Typography**: rem tokens only (`--font-size-2xs` … `--font-size-2xl`);
  the scale redefines itself on handheld touch devices (pointer-keyed, not
  width-keyed; force with the `kit-type-touch` root class), so components
  never write type media queries and apps never pin `html { font-size }`.
- **Icons**: `@lucide/svelte` via per-icon deep imports
  (`@lucide/svelte/icons/check`), which is a peer dependency.
- **Checker parity**: when adding a component that replaces a common
  hand-rolled pattern, add a detection rule to `checks/rules.mjs` (+ test) so
  external projects get steered to it.
- **Exports**: every new component/type/util must be added to
  `src/lib/index.ts`, given a demo page in `src/demo/pages/` (and registered in
  `src/demo/App.svelte`), and documented in `docs/components/`.

## Provenance

Components were consolidated from `../middleman` (`packages/ui`) and
`../agentsview` (`frontend/src/lib`). When changing a component's API, check
whether those apps have since diverged before renaming props.
