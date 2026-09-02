# HarnessMark

`HarnessMark` renders the wordmark of a coding-agent harness (Claude Code,
Codex, Gemini, …) at an icon-like height. The artwork was consolidated from
the agentsview docs landing page and is bundled into the component, so a mark
never costs an extra asset request.

```svelte
<script lang="ts">
  import { HARNESSES, HarnessMark, isHarnessId } from "@kenn-io/kit-ui";
</script>

<HarnessMark harness="claude-code" />
<HarnessMark harness="codex" size={16} mono />

{#if isHarnessId(session.agent)}
  <HarnessMark harness={session.agent} size={14} decorative />
{/if}
{session.agentLabel}
```

## Props

| Prop         | Type        | Default      | Notes                                                                 |
| ------------ | ----------- | ------------ | --------------------------------------------------------------------- |
| `harness`    | `HarnessId` | required     | Which mark to draw                                                    |
| `label`      | `string`    | display name | Accessible name (`role="img"`)                                        |
| `decorative` | `boolean`   | `false`      | Hides the mark from assistive tech when nearby text names the harness |
| `size`       | `number`    | `20`         | Root height in px; width follows the artwork's aspect ratio           |
| `mono`       | `boolean`   | `false`      | Flattens brand colours to `currentColor`                              |
| `class`      | `string`    | —            | Additional class on the mark root                                     |

The root is an inline-flex span sized by `--harness-mark-size`, so marks sit
on the text baseline and inherit the surrounding `color`. A muted row dims its
marks along with its text.

Two marks carry an optical correction (`HarnessInfo.opticalScale`): Gemini
and Forge are drawn taller than `size` and centred on the root box, mirroring
the agentsview docs matrix where they are shown at 30 and 28 px against a 22 px
baseline. The root box itself stays at `size`, so line boxes and row heights do
not change. The docs matrix also doubles Codex, which suits its wide grid cells
but overwhelms inline text; kit-ui leaves that mark at 1×.

## Harnesses

`HARNESSES` lists every id with its display name, in the order the agentsview
docs present them. `isHarnessId(value)` narrows an arbitrary string (a
session's agent name, say) to `HarnessId`, and `harnessInfo(id)` returns the
entry.

| Id               | Artwork                                              | Colour                                  |
| ---------------- | ---------------------------------------------------- | --------------------------------------- |
| `claude-code`    | vector                                               | orange asterisk, text in `currentColor` |
| `codex`          | vector (the OpenAI wordmark, as agentsview ships it) | `currentColor`                          |
| `gemini`         | vector                                               | brand gradient                          |
| `copilot`        | vector                                               | `currentColor`                          |
| `cursor`         | vector                                               | `currentColor`                          |
| `opencode`       | vector                                               | `currentColor` at three opacities       |
| `forge`          | raster (PNG, transparent)                            | orange; `mono` has no effect            |
| `openhands`      | typeset                                              | brand colour                            |
| `amp`            | typeset                                              | brand colour                            |
| `vscode-copilot` | typeset                                              | brand colour                            |
| `positron`       | typeset                                              | brand colour                            |
| `openclaw`       | typeset                                              | brand colour                            |
| `pi`             | typeset                                              | brand colour                            |
| `iflow`          | typeset                                              | brand colour                            |
| `zencoder`       | typeset                                              | brand colour                            |
| `kimi`           | typeset                                              | brand colour                            |
| `warp`           | typeset                                              | brand colour                            |
| `hermes`         | typeset                                              | brand colour                            |
| `cortex-code`    | typeset                                              | brand colour                            |
| `kiro`           | typeset                                              | brand colour                            |

Typeset marks are bold text in the inherited font at the mark height. The
agentsview docs ship these as `<text>` SVGs in the system font; rendering them
as real text keeps them crisp and lets the font fall back cleanly.

## Provenance and theming

Sources are the agent wordmarks on the AgentsView documentation site's landing page. The vector marks
were adjusted for a themeable library: `width`/`height` attributes dropped so
CSS sizes them, `fill="white"` and Claude's cream text changed to
`currentColor`, OpenCode's three greys mapped to `currentColor` at 100 / 72 /
30 % opacity, and no-op clip paths and masks removed. Gemini keeps its gradient
and mask under namespaced ids. Brand geometry is unchanged.

Each logo remains a trademark of its owner. Use the marks to identify the
harness a session ran in, not to imply endorsement.
