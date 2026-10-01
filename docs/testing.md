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

CI runs Chromium only. Run Firefox and WebKit locally with
`bunx playwright test --browser=firefox` (or `webkit`) after
`bunx playwright install firefox webkit`. Tests that need the Chrome
DevTools Protocol (real touch input, the URL-bar height override) skip
there; clipboard tests read through `clipboardReader` in `helpers.ts`,
since only Chromium grants automation clipboard access.

## What's covered (`tests/browser/`)

| Spec                           | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `focus-trap.spec.ts`           | Modal + DetailDrawer: initial focus, Tab/Shift+Tab containment, Escape close, focus restore to trigger; wrapping at both edges past unfocusable controls, through iframe content, and into a checked radio                                                                                                                                                                                                                                             |
| `flash.spec.ts`                | Flash stack cap (5) and per-banner dismiss                                                                                                                                                                                                                                                                                                                                                                                                             |
| `top-bar.spec.ts`              | Tab collapse into the nav dropdown and back across width sweeps; selection preserved through collapse                                                                                                                                                                                                                                                                                                                                                  |
| `fit-stages.spec.ts`           | Stage transitions across widths, full recovery to the richest stage                                                                                                                                                                                                                                                                                                                                                                                    |
| `adaptive-action-grid.spec.ts` | Row, grid, and compact transitions; live label remeasurement; DOM identity and Tab order; resize and disclosure focus handling; shared control sizing; coarse-pointer trigger target; zero-gap joined geometry                                                                                                                                                                                                                                         |
| `contrast.spec.ts`             | WCAG AA (4.5:1) for chip tones and button surfaces in light/dark/high-contrast, alpha-composited from real rendered colors. Measured pre-existing failures are baselined in `KNOWN_FAILURES` (remediation: kata y1v0); the suite fails on new failures or degradation                                                                                                                                                                                  |
| `chip.spec.ts`                 | Icon alignment: label-composed svgs stay centered without growing the pill (md + sm), the trailing snippet centers exactly and survives label truncation                                                                                                                                                                                                                                                                                               |
| `status-dot.spec.ts`           | Working and waiting indicators are static by default; opt-in motion uses the dedicated compositor-friendly animations                                                                                                                                                                                                                                                                                                                                  |
| `command-palette.spec.ts`      | Combobox ARIA state, disabled-skip highlight, Escape clear-then-close, shortcut scope suspension, empty-result inertness                                                                                                                                                                                                                                                                                                                               |
| `typeahead.spec.ts`            | Clear row + meta search, custom-value Enter, veto/error row, grouped-option tree (mouse + ArrowRight/ArrowLeft expand-collapse, filter-forced expansion), header snippet through the loading row, forced `placement="top"`                                                                                                                                                                                                                             |
| `virtual-list.spec.ts`         | Windowed DOM, container keyboard nav + `aria-activedescendant`, Enter activation, `scrollToIndex`, nested-control key isolation                                                                                                                                                                                                                                                                                                                        |
| `markdown.spec.ts`             | Sanitizer against real DOMPurify (script/style/inline-style vectors, faked-shiki nonce check, `rel` hardening), dual-theme code colors, CodeBlock line numbers / wrap toggle / clipboard copy                                                                                                                                                                                                                                                          |
| `mention-textarea.spec.ts`     | Trigger detection at word boundaries (and not mid-word), async search states, ArrowUp/Down cycling + Tab/Enter insert + Escape dismiss, caret placement after insert, custom trigger char and row snippet, start-only slash trigger, `hideEmpty` key passthrough, embedded composer field (frame, growth, `textareaEl`, `onpaste`)                                                                                                                     |
| `refresh-control.spec.ts`      | Width reservation: the age label box measures the same across the narrowest, widest, and overlong variants, and the element after the control does not move; `ageTooltip` opens on hover with the caller's content and closes on leave                                                                                                                                                                                                                 |
| `mermaid.spec.ts`              | Mermaid post-processor against real mermaid: fence → pan/zoom viewer, wheel zoom + reset, source copy, expand into MediaViewer (Escape/backdrop close, focus restore), invalid-diagram source fallback, theme-flip re-render                                                                                                                                                                                                                           |
| `media-viewer.spec.ts`         | Paging by buttons and arrow keys (wrapping), zoom reset on page and when a different item takes the index, no image upscaling, page gallery across markdown images/diagrams/ImagePreview, hidden-tab and modal-layer eligibility, linked markdown images, the onViewerOpen hook (loops, replacement), opens that race an unmount, disconnect, re-render, or targeted close, index wrapping and fallback names, localized counter and name, theme flips |
| `media-viewer-touch.spec.ts`   | Touch-enabled context. Chromium only (real touch over CDP): swipe paging (and panning once zoomed), double-tap zoom and reset, tap rules (movement, pinch in between), gradual two-finger pinch, inline Mermaid scroll-through at scale 1 with no leftover offset, drifting inline pinch. Every engine: 44px touch controls, phone layout, and a backdrop tap that closes without activating the page control underneath                               |

Conventions: specs drive the gallery pages (`/#page-id`) through
`helpers.ts` (`gotoPage`, `setSlider`, `setTheme`, `contrastOf`) —
when a component's demo changes its hooks (labels, classes), the spec is
part of the change. New components with browser-only behavior should add
a spec alongside their demo page.

Unit-testable logic stays in `checks/*.test.ts` (bun test): checker
rules, windowing math, shortcut parsing/matching, markdown highlight
planning. The split is deliberate — bun tests gate every commit cheaply;
the browser suite verifies integrated behavior.
