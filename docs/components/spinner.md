# Spinner

Simple loading spinner (`role="status"`). Extracted from agentsview's modal
spinner.

```svelte
<Spinner />
<Spinner size={16} />
<Spinner size={40} label="Loading sessions" />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `number` | `24` | Diameter in px |
| `label` | `string` | `"Loading"` | aria-label |
