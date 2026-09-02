# HarnessIcon

`HarnessIcon` renders the glyph of a coding-agent harness (Claude, Codex via
the OpenAI mark, Gemini, …) as a square, monochrome icon. The artwork is the
icon sprite from the AgentsView documentation landing page, bundled into the
component so an icon never costs an extra asset request.

```svelte
<script lang="ts">
  import { HARNESS_ICONS, HarnessIcon, isHarnessIconId } from "@kenn-io/kit-ui";
</script>

<HarnessIcon harness="claude" />
<HarnessIcon harness="openai" size={20} />

{#if isHarnessIconId(session.agent)}
  <HarnessIcon harness={session.agent} size={14} decorative />
{/if}
{session.agentLabel}
```

## Props

| Prop         | Type            | Default    | Notes                                                                 |
| ------------ | --------------- | ---------- | --------------------------------------------------------------------- |
| `harness`    | `HarnessIconId` | required   | Which glyph to draw                                                   |
| `label`      | `string`        | brand name | Accessible name (`role="img"`)                                        |
| `decorative` | `boolean`       | `false`    | Hides the icon from assistive tech when nearby text names the harness |
| `size`       | `number`        | `16`       | Width and height in px                                                |
| `class`      | `string`        | —          | Additional class on the icon root                                     |

The root is an inline-flex square sized by `--harness-icon-size`, so icons sit
on the text baseline like a lucide icon and inherit the surrounding `color`. A
muted row dims its icons along with its text. Every glyph paints in
`currentColor`; there are no brand colours to flatten.

## Harnesses

`HARNESS_ICONS` lists every id with its brand name and the agent products the
AgentsView docs draw with it, in the order the docs present them.
`isHarnessIconId(value)` narrows an arbitrary string to `HarnessIconId`, and
`harnessIconInfo(id)` returns the entry. Ids are brand glyphs, not agent
products: Codex draws `openai`, Cortex Code draws `snowflake`, and Positron
draws `posit`. Map product names on the consumer side.

| Id             | Brand         | Agents                                 |
| -------------- | ------------- | -------------------------------------- |
| `claude`       | Claude        | Claude Code, OpenClaude, Claude Cowork |
| `openai`       | OpenAI        | Codex                                  |
| `gemini`       | Gemini        | Gemini                                 |
| `copilot`      | Copilot       | Copilot                                |
| `vscode`       | VS Code       | VS Code Copilot                        |
| `visualstudio` | Visual Studio | Visual Studio Copilot                  |
| `cursor`       | Cursor        | Cursor, Cursor IDE                     |
| `warp`         | Warp          | Warp                                   |
| `qwen`         | Qwen          | Qwen Code, QwenPaw                     |
| `deepseek`     | DeepSeek      | DeepSeek TUI, DeepSeek Harness         |
| `mistral`      | Mistral       | Mistral Vibe                           |
| `zed`          | Zed           | Zed                                    |
| `posit`        | Posit         | Positron, Posit Assistant              |
| `sourcegraph`  | Sourcegraph   | Amp (historical)                       |
| `opencode`     | OpenCode      | OpenCode                               |
| `antigravity`  | Antigravity   | Antigravity                            |
| `kilo`         | Kilo          | Kilo, Kilo (legacy)                    |
| `kimi`         | Kimi          | Kimi, Kimi Work                        |
| `kiro`         | Kiro          | Kiro                                   |
| `openhands`    | OpenHands     | OpenHands                              |
| `zencoder`     | Zencoder      | Zencoder                               |
| `snowflake`    | Snowflake     | Cortex Code                            |
| `goose`        | Goose         | Goose                                  |
| `grok`         | Grok          | Grok                                   |
| `hermes`       | Hermes        | Hermes                                 |
| `xiaomi`       | Xiaomi        | MiMoCode                               |
| `openclaw`     | OpenClaw      | OpenClaw                               |
| `pi`           | Pi            | Pi                                     |
| `poolside`     | Poolside      | Poolside                               |
| `qoder`        | Qoder         | Qoder                                  |
| `roocode`      | RooCode       | RooCode                                |
| `trae`         | Trae          | Trae, TraeX                            |
| `aider`        | Aider         | Aider                                  |
| `gptme`        | gptme         | gptme                                  |
| `omnigent`     | Omnigent      | Omnigent                               |
| `zai`          | Z.ai          | ZCode                                  |
| `commandcode`  | Command Code  | Command Code                           |
| `codebuff`     | Codebuff      | Codebuff, Freebuff                     |
| `forge`        | Forge         | Forge                                  |
| `iflow`        | iFlow         | iFlow                                  |
| `omp`          | OhMyPi        | OhMyPi                                 |
| `prime`        | Prime Agent   | Prime Agent                            |
| `piebald`      | Piebald       | Piebald                                |
| `tencent`      | Tencent       | QClaw                                  |
| `reasonix`     | Reasonix      | Reasonix                               |
| `shelley`      | Shelley       | Shelley                                |
| `workbuddy`    | WorkBuddy     | WorkBuddy                              |
| `windsurf`     | Windsurf      | Windsurf                               |
| `devin`        | Devin         | Devin CLI                              |

## Provenance

Sources are the `<symbol>` definitions in the AgentsView documentation landing
page sprite, split into one 24×24 file each with the geometry unchanged. Each
logo remains a trademark of its owner. Use the icons to identify the harness a
session ran in, not to imply endorsement.
