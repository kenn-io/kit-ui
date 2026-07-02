# CopyButton

Icon button that copies text and flashes a check mark. Extracted from
agentsview.

## Self-managed (most common)

Pass `text`; the component copies it (with a legacy fallback for non-secure
contexts) and shows the check for 1.5 s:

```svelte
<CopyButton text={sessionId} />
```

## Controlled

Omit `text` and drive the state yourself:

```svelte
<CopyButton copied={copiedFlag} onclick={copyComputedContent} />
```

## Props

| Prop                            | Type                                           | Default               | Notes                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`                          | `string`                                       | —                     | Enables self-managed mode                                                                                                                              |
| `copied`                        | `boolean`                                      | `false`               | Controlled mode indicator                                                                                                                              |
| `ariaLabel` / `copiedAriaLabel` | `string`                                       | `"Copy"` / `"Copied"` |                                                                                                                                                        |
| `title` / `copiedTitle`         | `string`                                       | `"Copy"` / `"Copied"` |                                                                                                                                                        |
| `revealOnHover`                 | `boolean`                                      | `false`               | Start invisible; the parent reveals `.kit-copy-btn` on hover (`.parent:hover .kit-copy-btn { opacity: 1; }`). Always visible on touch and when focused |
| `onclick`                       | `(event: MouseEvent) => void \| Promise<void>` | —                     | Runs after the self-managed copy, if any                                                                                                               |
| `class`                         | `string`                                       | `""`                  |                                                                                                                                                        |
