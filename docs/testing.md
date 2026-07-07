# Browser tests

Playwright suite driving the demo gallery in real Chromium — the
behaviors unit tests can't reach: focus traps, measurement loops,
computed-color contrast, ARIA state under real keyboard events, and the
sanitizer running against real DOMPurify.

```bash
bun run test:browser              # full suite (starts the Vite dev server itself)
bunx playwright test focus-trap   # one spec
bunx playwright test --ui         # interactive debugging
```

The config (`playwright.config.ts`) boots Vite on an OS-assigned
ephemeral port claimed per run, so parallel checkouts/worktrees never
reuse each other's dev server (which would silently test the other
checkout's code). Set `KIT_UI_TEST_PORT` to pin the port and keep one
server alive across runs while iterating. Chromium comes from
`bunx playwright install chromium` (one-time locally; CI installs it in
`.github/workflows/ci.yml` with the download cached on `bun.lock`).

## What's covered (`tests/browser/`)

| Spec                       | Covers                                                                                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `focus-trap.spec.ts`       | Modal + DetailDrawer: initial focus, Tab/Shift+Tab containment, Escape close, focus restore to trigger                                                                                                                                                                |
| `flash.spec.ts`            | Flash stack cap (5) and per-banner dismiss                                                                                                                                                                                                                            |
| `top-bar.spec.ts`          | Tab collapse into the nav dropdown and back across width sweeps; selection preserved through collapse                                                                                                                                                                 |
| `fit-stages.spec.ts`       | Stage transitions across widths, full recovery to the richest stage                                                                                                                                                                                                   |
| `contrast.spec.ts`         | WCAG AA (4.5:1) for chip tones and button surfaces in light/dark/high-contrast, alpha-composited from real rendered colors. Measured pre-existing failures are baselined in `KNOWN_FAILURES` (remediation: kata y1v0); the suite fails on new failures or degradation |
| `chip.spec.ts`             | Icon alignment: label-composed svgs stay centered without growing the pill (md + sm), the trailing snippet centers exactly and survives label truncation                                                                                                              |
| `command-palette.spec.ts`  | Combobox ARIA state, disabled-skip highlight, Escape clear-then-close, shortcut scope suspension, empty-result inertness                                                                                                                                              |
| `typeahead.spec.ts`        | Clear row + meta search, custom-value Enter, veto/error row, grouped-option tree (mouse + ArrowRight/ArrowLeft expand-collapse, filter-forced expansion), header snippet through the loading row, forced `placement="top"`                                            |
| `virtual-list.spec.ts`     | Windowed DOM, container keyboard nav + `aria-activedescendant`, Enter activation, `scrollToIndex`, nested-control key isolation                                                                                                                                       |
| `markdown.spec.ts`         | Sanitizer against real DOMPurify (script/style/inline-style vectors, faked-shiki nonce check, `rel` hardening), dual-theme code colors, CodeBlock line numbers / wrap toggle / clipboard copy                                                                         |
| `mention-textarea.spec.ts` | Trigger detection at word boundaries (and not mid-word), async search states, ArrowUp/Down cycling + Tab/Enter insert + Escape dismiss, caret placement after insert, custom trigger char and row snippet                                                             |
| `mermaid.spec.ts`          | Mermaid post-processor against real mermaid: fence → pan/zoom viewer, wheel zoom + reset, source copy, expand lightbox (Escape/backdrop close, focus restore), invalid-diagram source fallback, theme-flip re-render                                                  |

Conventions: specs drive the gallery pages (`/#page-id`) through
`helpers.ts` (`gotoPage`, `setSlider`, `setTheme`, `contrastOf`) —
when a component's demo changes its hooks (labels, classes), the spec is
part of the change. New components with browser-only behavior should add
a spec alongside their demo page.

Unit-testable logic stays in `checks/*.test.ts` (bun test): checker
rules, windowing math, shortcut parsing/matching, markdown highlight
planning. The split is deliberate — bun tests gate every commit cheaply;
the browser suite verifies integrated behavior.
