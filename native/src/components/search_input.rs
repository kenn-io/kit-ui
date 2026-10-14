use crate::components::icon_button::{IconButton, IconButtonSize};
use crate::components::text_input::{InputChanged, TextInput};
use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Debug)]
pub struct SearchChanged {
    pub text: SharedString,
}

/// Editable native search field. Listen for `SearchChanged` to filter results.
pub struct SearchInput {
    input: Entity<TextInput>,
    disabled: bool,
    readonly: bool,
}
impl EventEmitter<SearchChanged> for SearchInput {}
impl SearchInput {
    pub fn new(placeholder: impl Into<SharedString>, cx: &mut Context<Self>) -> Self {
        let placeholder = placeholder.into();
        let input = cx.new(|cx| TextInput::new(placeholder, cx));
        cx.subscribe(&input, |_, _, event: &InputChanged, cx| {
            cx.emit(SearchChanged {
                text: event.text.clone(),
            });
            cx.notify();
        })
        .detach();
        Self {
            input,
            disabled: false,
            readonly: false,
        }
    }

    pub fn value(&self, cx: &App) -> SharedString {
        self.input.read(cx).value()
    }

    pub fn set_value(&mut self, value: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.input
            .update(cx, |input, cx| input.set_value(value, cx));
        cx.notify();
    }

    pub fn set_disabled(&mut self, disabled: bool, cx: &mut Context<Self>) {
        self.disabled = disabled;
        self.input.update(cx, |input, cx| {
            input.disabled = disabled;
            cx.notify();
        });
        cx.notify();
    }

    pub fn set_readonly(&mut self, readonly: bool, cx: &mut Context<Self>) {
        self.readonly = readonly;
        self.input.update(cx, |input, cx| {
            input.readonly = readonly;
            cx.notify();
        });
        cx.notify();
    }

    fn clear(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled || self.readonly {
            return;
        }
        self.set_value("", cx);
        window.focus(&self.input.read(cx).focus_handle(cx));
    }
}
impl Focusable for SearchInput {
    fn focus_handle(&self, cx: &App) -> FocusHandle {
        self.input.read(cx).focus_handle(cx)
    }
}
impl Render for SearchInput {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .id("search-input")
            .flex()
            .items_center()
            .gap(px(8.))
            .w_full()
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if event.keystroke.key == "escape"
                    && !this.value(cx).is_empty()
                    && !this.disabled
                    && !this.readonly
                {
                    this.clear(window, cx);
                    cx.stop_propagation();
                }
            }))
            .child(
                svg()
                    .path(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/icons/search.svg"
                    ))
                    .size(px(14.))
                    .flex_shrink_0()
                    .text_color(theme(cx).muted)
                    .opacity(if self.disabled { 0.5 } else { 1. }),
            )
            .child(div().flex_1().min_w(px(0.)).child(self.input.clone()))
            .when(
                !self.value(cx).is_empty() && !self.disabled && !self.readonly,
                |d| {
                    d.child(
                        IconButton::new(
                            "clear-search",
                            "Clear search",
                            concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/x.svg"),
                        )
                        .size(IconButtonSize::Small)
                        .on_click(cx.listener(|this, _, window, cx| this.clear(window, cx))),
                    )
                },
            )
    }
}

struct Demo {
    search: Entity<SearchInput>,
    disabled: bool,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let query = self.search.read(cx).value(cx).to_lowercase();
        let projects = [
            "Forge",
            "Agentsview",
            "Kit UI",
            "GPUI gallery",
            "Documentation",
        ];
        let matches: Vec<_> = projects
            .into_iter()
            .filter(|name| name.to_lowercase().contains(&query))
            .collect();
        let mut results = stack().gap(px(8.));
        for name in &matches {
            results = results.child(
                div()
                    .px(px(12.))
                    .py(px(8.))
                    .rounded(px(4.))
                    .bg(theme(cx).surface)
                    .text_color(theme(cx).text)
                    .child(*name),
            );
        }
        if matches.is_empty() {
            results = results.child(label("No projects found", cx));
        }
        stack()
            .max_w(px(440.))
            .child(label("Projects", cx))
            .child(self.search.clone())
            .child(
                row().child(
                    control(
                        "toggle-search-disabled",
                        if self.disabled {
                            "Enable search"
                        } else {
                            "Disable search"
                        },
                        cx,
                    )
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.disabled = !this.disabled;
                        this.search
                            .update(cx, |search, cx| search.set_disabled(this.disabled, cx));
                        cx.notify();
                    })),
                ),
            )
            .child(label(format!("{} projects", matches.len()), cx))
            .child(results)
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let search = cx.new(|cx| SearchInput::new("Search projects…", cx));
        cx.subscribe(&search, |_, _, _: &SearchChanged, cx| cx.notify())
            .detach();
        Demo {
            search,
            disabled: false,
        }
    })
    .into()
}
