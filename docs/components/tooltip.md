# Tooltip

Hover/focus tooltip with rich-content support, generalized from Forge's
diff-summary popover on the PR page. The bubble centers on its trigger with
a small gap, flips above when there's no room below, and shifts sideways to
stay on screen; its arrow always points at the trigger's center. Open/close
delays give hover intent, Escape dismisses, and the panel has
`role="tooltip"`. While open, its id is added to the `aria-describedby` of
the wrapped control that has keyboard focus, or of the first wrapped control
when the pointer opened it (the wrapper itself with `focusable`), so
assistive technology reads it as that control's description. The id stays
when the control changes its own `aria-describedby` while the tooltip is
open. Pressing the trigger hides the tooltip, so it does not cover a menu or
list the press opens. A press is a click, a touch tap, or Enter or Space on a
wrapped control other than a form field (an input, text area, or select)
or an editable region. The tooltip shows again the next time the pointer enters
the trigger or keyboard focus lands on it. On touch screens the tooltip on a
control opens when the control gains keyboard focus. A `focusable` trigger has
no action, so pressing it does not hide the tooltip, and a tap opens it.

## Text tooltip

```svelte
<Tooltip text="Rebases and fast-forwards the branch">
  <Button size="sm" label="Update branch" />
</Tooltip>
```

## Rich content

```svelte
<Tooltip>
  {#snippet content()}
    {#each breakdown as row}
      <div class="row">{row.label} <DiffStats {...row} /></div>
    {/each}
  {/snippet}
  <Chip tone="muted"><DiffStats additions={14430} deletions={9822} /></Chip>
</Tooltip>
```

## Props

| Prop           | Type                           | Default    | Notes                                                                                         |
| -------------- | ------------------------------ | ---------- | --------------------------------------------------------------------------------------------- |
| `children`     | `Snippet`                      | required   | The trigger                                                                                   |
| `text`         | `string`                       | —          | Simple tooltip body                                                                           |
| `content`      | `Snippet`                      | —          | Rich tooltip body (wins over `text`)                                                          |
| `focusable`    | `boolean`                      | `false`    | Adds `tabindex="0"` to the trigger wrapper — set when the child isn't focusable itself        |
| `align`        | `"start" \| "center" \| "end"` | `"center"` | Horizontal placement against the trigger; the arrow points at the trigger's center either way |
| `openDelayMs`  | `number`                       | `250`      | Hover intent; focus opens immediately                                                         |
| `closeDelayMs` | `number`                       | `100`      | Lets the pointer cross into the tooltip (rich content stays open while hovered)               |
| `class`        | `string`                       | `""`       | Extra classes on the panel                                                                    |

Reach for `Tooltip` when a plain `title=` attribute isn't enough (formatted
content, guaranteed timing, keyboard visibility). `title=` remains fine for
simple hints.
