use crate::components::text_input::{InputChanged, TextInput};
use crate::theme::{control, label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Debug)]
pub enum FindBarEvent {
    QueryChanged(SharedString),
    Next,
    Previous,
    Closed,
}

#[derive(Clone, Copy, Default)]
pub enum FindBarVariant {
    #[default]
    Pinned,
    Floating,
}

/// Native find controls. The caller supplies match counts and handles navigation.
pub struct FindBar {
    pub match_count: usize,
    pub current_index: usize,
    pub variant: FindBarVariant,
    pub no_matches_label: SharedString,
    input: Entity<TextInput>,
    autofocus: bool,
    return_focus: Option<FocusHandle>,
}
impl EventEmitter<FindBarEvent> for FindBar {}
impl FindBar {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let input = cx.new(|cx| {
            let mut input = TextInput::new("Find…", cx);
            input.block = true;
            input
        });
        cx.subscribe(&input, |_, _, event: &InputChanged, cx| {
            cx.emit(FindBarEvent::QueryChanged(event.text.clone()));
            cx.notify();
        })
        .detach();
        Self {
            match_count: 0,
            current_index: 0,
            variant: FindBarVariant::Pinned,
            no_matches_label: "No matches".into(),
            input,
            autofocus: true,
            return_focus: None,
        }
    }
    pub fn query(&self, cx: &App) -> SharedString {
        self.input.read(cx).value()
    }
    pub fn set_query(&mut self, query: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.input
            .update(cx, |input, cx| input.set_value(query, cx));
        cx.notify();
    }
    pub fn set_autofocus(&mut self, autofocus: bool) {
        self.autofocus = autofocus;
    }
    pub fn set_return_focus(&mut self, focus: FocusHandle) {
        self.return_focus = Some(focus);
    }
    pub fn focus(&self, window: &mut Window, cx: &App) {
        window.focus(&self.input.read(cx).focus_handle(cx));
    }
    fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(focus) = &self.return_focus {
            window.focus(focus);
        }
        cx.emit(FindBarEvent::Closed);
    }
}
impl Focusable for FindBar {
    fn focus_handle(&self, cx: &App) -> FocusHandle {
        self.input.read(cx).focus_handle(cx)
    }
}
impl Render for FindBar {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.autofocus {
            self.autofocus = false;
            self.focus(window, cx);
        }
        let t = theme(cx);
        let has_query = !self.query(cx).trim().is_empty();
        let count = if self.match_count == 0 {
            self.no_matches_label.clone()
        } else {
            format!(
                "{} of {}",
                self.current_index.min(self.match_count - 1) + 1,
                self.match_count
            )
            .into()
        };
        let has_matches = self.match_count > 0;
        div()
            .id("find-bar")
            .flex()
            .items_center()
            .gap(px(8.))
            .p(px(8.))
            .w_full()
            .bg(t.surface)
            .border_color(if has_query && !has_matches {
                t.danger
            } else {
                t.border
            })
            .when(matches!(self.variant, FindBarVariant::Pinned), |d| {
                d.border_b_1()
            })
            .when(matches!(self.variant, FindBarVariant::Floating), |d| {
                d.border_1().rounded(px(6.)).shadow_md()
            })
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                match event.keystroke.key.as_str() {
                    "escape" => {
                        this.close(window, cx);
                        cx.stop_propagation();
                    }
                    "enter" if this.focus_handle(cx).is_focused(window) => {
                        if this.match_count > 0 {
                            cx.emit(if event.keystroke.modifiers.shift {
                                FindBarEvent::Previous
                            } else {
                                FindBarEvent::Next
                            });
                        }
                        cx.stop_propagation();
                    }
                    _ => {}
                }
            }))
            .child(div().flex_1().min_w(px(100.)).child(self.input.clone()))
            .when(has_query, |d| {
                d.child(label(count, cx).text_color(if has_matches { t.muted } else { t.danger }))
            })
            .child(
                control("find-previous", "↑", cx)
                    .tab_stop(has_matches)
                    .opacity(if has_matches { 1. } else { 0.4 })
                    .on_click(cx.listener(|this, _, _, cx| {
                        if this.match_count > 0 {
                            cx.emit(FindBarEvent::Previous);
                        }
                    })),
            )
            .child(
                control("find-next", "↓", cx)
                    .tab_stop(has_matches)
                    .opacity(if has_matches { 1. } else { 0.4 })
                    .on_click(cx.listener(|this, _, _, cx| {
                        if this.match_count > 0 {
                            cx.emit(FindBarEvent::Next);
                        }
                    })),
            )
            .child(
                control("find-close", "×", cx)
                    .on_click(cx.listener(|this, _, window, cx| this.close(window, cx))),
            )
    }
}

const LINES: [&str; 6] = [
    "Native components share the Kit UI theme.",
    "FindBar searches the text in this document.",
    "Components respond to keyboard and pointer input.",
    "Each component has a native GPUI demo.",
    "Use Enter to find the next matching line.",
    "Shift+Enter selects the previous matching line.",
];
struct Demo {
    bar: Entity<FindBar>,
    open: bool,
    matches: Vec<usize>,
    current: usize,
    focus: FocusHandle,
}
impl Demo {
    fn sync(&self, cx: &mut Context<Self>) {
        self.bar.update(cx, |bar, cx| {
            bar.match_count = self.matches.len();
            bar.current_index = self.current;
            cx.notify();
        });
        cx.notify();
    }
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected = self.matches.get(self.current).copied();
        let t = theme(cx);
        let mut document = stack().gap(px(8.)).p(px(16.));
        for (index, line) in LINES.iter().enumerate() {
            document = document.child(
                div()
                    .p(px(8.))
                    .rounded(px(4.))
                    .bg(if selected == Some(index) {
                        t.accent.opacity(0.2)
                    } else if self.matches.contains(&index) {
                        t.inset
                    } else {
                        t.surface
                    })
                    .text_color(t.text)
                    .child(*line),
            );
        }
        stack()
            .max_w(px(700.))
            .child(label("Find in document", cx))
            .child(
                control("open-find", "Find", cx)
                    .track_focus(&self.focus)
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.open = true;
                        this.bar.read(cx).focus(window, cx);
                        cx.notify();
                    })),
            )
            .child(
                stack()
                    .gap(px(0.))
                    .border_1()
                    .border_color(t.border)
                    .rounded(px(6.))
                    .overflow_hidden()
                    .when(self.open, |d| d.child(self.bar.clone()))
                    .child(document),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let focus = cx.focus_handle().tab_stop(true);
        let bar = cx.new(|cx| {
            let mut bar = FindBar::new(cx);
            bar.set_autofocus(false);
            bar.set_return_focus(focus.clone());
            bar
        });
        cx.subscribe(&bar, |this: &mut Demo, _, event: &FindBarEvent, cx| {
            match event {
                FindBarEvent::QueryChanged(query) => {
                    let query = query.trim().to_lowercase();
                    this.matches = if query.is_empty() {
                        vec![]
                    } else {
                        LINES
                            .iter()
                            .enumerate()
                            .filter_map(|(i, line)| {
                                line.to_lowercase().contains(&query).then_some(i)
                            })
                            .collect()
                    };
                    this.current = 0;
                }
                FindBarEvent::Next if !this.matches.is_empty() => {
                    this.current = (this.current + 1) % this.matches.len()
                }
                FindBarEvent::Previous if !this.matches.is_empty() => {
                    this.current = (this.current + this.matches.len() - 1) % this.matches.len()
                }
                FindBarEvent::Closed => this.open = false,
                _ => {}
            }
            this.sync(cx);
        })
        .detach();
        Demo {
            bar,
            open: true,
            matches: vec![],
            current: 0,
            focus,
        }
    })
    .into()
}
