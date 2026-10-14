# Kit UI in GPUI

An experimental native Rust port of all 70 exported Kit UI components. The gallery renders with GPUI, without a browser or webview. It keeps demo state in memory and does not connect to Forge services.

## Run

On macOS, install Rust and Xcode with its command-line tools, then run from the repository root:

```sh
cargo run --locked --manifest-path native/Cargo.toml
```

The app opens a native window. Select components in the left sidebar, search by name, switch between light and dark themes, and reset the current demo. Interactive demos update their displayed state. Scroll the sidebar to reach all 70 components.

| Shortcut      | Action                    |
| ------------- | ------------------------- |
| Cmd F         | Find a component          |
| Cmd Up / Down | Previous / next component |
| Cmd D         | Switch theme              |
| Cmd R         | Reset current demo        |
| Cmd Q         | Quit                      |

The published GPUI 0.2.2 release is pinned. The lockfile records its dependencies. Linux and Windows require GPUI's platform prerequisites and have not been verified in this experiment. The current shortcut labels and font choice target macOS.

## Initial selection

The first 25 components were selected by Forge usage. The expanded gallery includes all exported Kit UI components, sorted alphabetically.

Counts are opening component tags in production `.svelte` files under Forge's `frontend/src`, excluding browser/test files, at Forge revision `7559101e3`. These count occurrences, rather than runtime frequency or imports. Ties follow Kit UI's export order. This is a snapshot of the locally available Forge checkout.

| Component         | Occurrences |
| ----------------- | ----------: |
| Button            |         154 |
| Chip              |          69 |
| Spinner           |          51 |
| IconButton        |          43 |
| Checkbox          |          31 |
| Modal             |          29 |
| Card              |          29 |
| StatusDot         |          24 |
| Toggle            |          22 |
| SelectDropdown    |          21 |
| SearchInput       |          19 |
| ScrollBox         |          16 |
| EmptyState        |          15 |
| TextInput         |          14 |
| TableHeaderCell   |          13 |
| FilterDropdown    |          10 |
| SplitResizeHandle |           9 |
| Typeahead         |           8 |
| SidebarToggle     |           7 |
| HarnessIcon       |           6 |
| DiffStats         |           6 |
| KbdBadge          |           5 |
| CopyButton        |           4 |
| CommentCard       |           4 |
| CodeBlock         |           3 |

## Using the ports

`src/components` contains reusable Rust components and a `demo(&mut App) -> AnyView` for each. Builder components implement GPUI's `IntoElement`; stateful controls use GPUI entities. The gallery in `src/main.rs` registers all demos. Consumers must set a `Theme` global, call `components::text_input::init` for editing bindings, and provide an asset source such as `assets::Assets` for SVGs. This experiment reads assets from its checkout.

These ports cover the main visual states and interactions, rather than promising complete Svelte API parity. Rust callbacks and entity events replace Svelte bindings and snippets. SelectDropdown and Typeahead emit selection events; callers accept changes by setting their value. FilterDropdown owns its selected options and emits the full selection. The public APIs live in each component module.

Markdown renders parsed content, with HTML omitted, images represented by alt text, and Mermaid fences shown as code. MentionTextarea supports multiline native editing and synchronous mention suggestions; it uses logical lines without soft wrapping. VirtualList uses actual viewport virtualization for fixed-height rows; variable-height rows are not implemented.

TextInput uses the native text handler with grapheme selection, clipboard actions, and IME composition hooks. It is single-line and does not provide password masking, undo/redo, or word selection. Native IME composition still needs manual verification with an input method. Screen-reader parity is not established. Modal callers supply their focusable controls for Tab cycling. StatusDot's pulse approximates the web animation. These are experiment limits, not claims of production readiness.

## Verify

```sh
cargo fmt --manifest-path native/Cargo.toml --check
cargo check --locked --manifest-path native/Cargo.toml
cargo test --locked --manifest-path native/Cargo.toml
```

The tests exercise actual GPUI input dispatch, caller-visible click/selection behavior, text editing, resize limits, search events, and mounting every demo in both themes. Headless render checks do not establish visual quality or OS accessibility.

## References and licensing

The implementation consulted a shallow clone of [Zed](https://github.com/zed-industries/zed), revision `3e145061d861ed32bb6a08dad7b03f2b5e455ad8`, and the published GPUI 0.2.2 examples. TextInput adapts GPUI's Apache-2.0 input example; its license is included under `licenses/`. Lucide icon artwork is covered by the bundled ISC license. Harness and provider SVGs come from Kit UI's existing asset collection. The web library is unchanged.
