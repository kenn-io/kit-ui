# ButtonBase

Low-level native button for structural controls whose layout and resting
appearance belong to the consuming application. Use it for navigation rows,
menu items, sortable headers, graph nodes, and other controls that should not
look like standard action buttons.

ButtonBase resets browser button chrome and centralizes Kit's keyboard focus,
disabled opacity, press motion, transition timing, and pointer coordinates for
theme effects. Consumer styles should use Kit theme tokens for their resting
and hover appearance.

```svelte
<script lang="ts">
  import { ButtonBase } from "@kenn-io/kit-ui";

  let trigger = $state<HTMLButtonElement>();
  let selected = $state(false);
</script>

<ButtonBase
  bind:element={trigger}
  class="project-row"
  role="menuitemcheckbox"
  aria-checked={selected}
  data-project={project.uid}
  onclick={() => (selected = !selected)}
>
  <span>{project.name}</span>
  <span>{project.openCount}</span>
</ButtonBase>
```

## Interface

ButtonBase accepts the native Svelte `HTMLButtonAttributes` interface, apart
from `class`, `children`, `onpointermove`, and `type`, which it declares with
component-specific types. This includes standard `role`, `aria-*`, `data-*`,
keyboard, pointer, and form attributes.

| Prop            | Type                                    | Default    | Notes                                                  |
| --------------- | --------------------------------------- | ---------- | ------------------------------------------------------ |
| `class`         | `ClassValue`                            | `""`       | Consumer-owned structural and resting styles           |
| `element`       | `HTMLButtonElement`                     |            | Bindable native element for focus or popover placement |
| `type`          | `"button" \| "submit" \| "reset"`       | `"button"` |                                                        |
| `onpointermove` | `HTMLButtonAttributes["onpointermove"]` |            | Runs after Kit updates its theme pointer coordinates   |
| `children`      | `Snippet`                               | required   | Complete structural content                            |

Use [Button](button.md) for ordinary Save, Cancel, Delete, and other actions
that should use Kit's standard tone, surface, size, and label treatment.
