# StatusDot

Tiny presence/status indicator for session lists and tables. Extracted from
agentsview and decoupled from its session store — you pass the computed status.

- `working` — pulsing green dot (attention-grabbing glow)
- `waiting` — dimmed, slowly breathing speech bubble ("your turn")
- `idle` — smaller muted-green dot (recently active)
- `stale` — amber
- `unclean` — red
- `quiet` — invisible placeholder (keeps row alignment)

```svelte
<script lang="ts">
  import { StatusDot, type StatusDotStatus } from "@kenn-io/kit-ui";
</script>

<StatusDot status="working" label="Agent is writing" />
<StatusDot status="waiting" label="Waiting for your input" />
<StatusDot status="stale" size={8} />
```

## Props

| Prop     | Type                                                                  | Default     | Notes                                                 |
| -------- | --------------------------------------------------------------------- | ----------- | ----------------------------------------------------- |
| `status` | `"working" \| "waiting" \| "idle" \| "stale" \| "unclean" \| "quiet"` | required    |                                                       |
| `label`  | `string`                                                              | status name | Tooltip + aria-label                                  |
| `size`   | `number`                                                              | `6`         | Dot diameter in px (the waiting bubble is fixed 10px) |

The waiting bubble color comes from `--status-waiting`.
