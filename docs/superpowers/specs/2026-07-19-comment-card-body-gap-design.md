# CommentCard body-gap normalization — design

Approved 2026-07-19. Prevent consumer-provided content margins from adding a
second vertical gap between a `CommentCard` header and its body.

## Behavior

`CommentCard` continues to use `Card`'s standard header-to-body gap. The
component resets only the block-start margin of the first direct child rendered
inside its body wrapper. This makes `CommentCard` the single owner of that
boundary while preserving margins within Markdown and other rich content.

The change does not add a public prop, alter generic `Card` spacing, or reach
into nested consumer markup.

## Verification

Add a browser regression case with a Markdown-like child whose first wrapper
has a top margin. Assert from rendered geometry that the margin does not enlarge
the standard header-to-body gap, while ordinary content remains visible and
otherwise unchanged.

## Out of scope

- Changing spacing inside consumer-provided Markdown.
- Changing header action sizing or generic `Card` layout.
- Adding a configurable `CommentCard` gap API.
