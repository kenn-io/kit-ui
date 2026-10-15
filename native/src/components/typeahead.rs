use std::{cell::Cell, rc::Rc};

use crate::{
    components::text_input::{InputChanged, TextInput},
    theme::{label, stack, theme},
};
use gpui::{prelude::*, *};

#[derive(Clone, Debug)]
pub struct TypeaheadOption {
    pub value: SharedString,
    pub label: SharedString,
    pub meta: SharedString,
}
impl TypeaheadOption {
    pub fn new(value: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            meta: "".into(),
        }
    }
    pub fn meta(mut self, meta: impl Into<SharedString>) -> Self {
        self.meta = meta.into();
        self
    }
}

#[derive(Clone, Debug)]
pub struct TypeaheadSelected {
    pub value: SharedString,
}

pub struct Typeahead {
    pub options: Vec<TypeaheadOption>,
    pub value: SharedString,
    pub fallback_label: SharedString,
    pub empty_label: SharedString,
    pub disabled: bool,
    input: Entity<TextInput>,
    focus: FocusHandle,
    open: bool,
    highlighted: usize,
    scroll: ScrollHandle,
    _input_subscription: Subscription,
}
impl EventEmitter<TypeaheadSelected> for Typeahead {}
impl Typeahead {
    pub fn new(
        options: Vec<TypeaheadOption>,
        placeholder: impl Into<SharedString>,
        cx: &mut Context<Self>,
    ) -> Self {
        let input = cx.new(|cx| {
            let mut input = TextInput::new(placeholder, cx);
            input.block = true;
            input
        });
        let subscription = cx.subscribe(&input, |this, _, _: &InputChanged, cx| {
            this.highlighted = 0;
            this.scroll.scroll_to_item(0);
            cx.notify();
        });
        Self {
            options,
            value: "".into(),
            fallback_label: "Choose a project".into(),
            empty_label: "No matches".into(),
            disabled: false,
            input,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            highlighted: 0,
            scroll: ScrollHandle::new(),
            _input_subscription: subscription,
        }
    }
    pub fn set_value(&mut self, value: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.value = value.into();
        cx.notify();
    }
    fn matches(&self, cx: &App) -> Vec<usize> {
        let query = self.input.read(cx).value().trim().to_lowercase();
        self.options
            .iter()
            .enumerate()
            .filter_map(|(index, option)| {
                [
                    option.value.as_ref(),
                    option.label.as_ref(),
                    option.meta.as_ref(),
                ]
                .iter()
                .any(|text| text.to_lowercase().contains(&query))
                .then_some(index)
            })
            .collect()
    }
    fn open(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        self.input.update(cx, |input, cx| input.set_value("", cx));
        self.open = true;
        self.highlighted = 0;
        self.input.read(cx).focus_handle(cx).focus(window);
        cx.notify();
    }
    fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        self.focus.focus(window);
        cx.notify();
    }
    fn choose(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if let Some(option) = self.options.get(index) {
            cx.emit(TypeaheadSelected {
                value: option.value.clone(),
            });
            self.close(window, cx);
        }
    }
}
impl Focusable for Typeahead {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}
impl Render for Typeahead {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let matches = self.matches(cx);
        let text = self
            .options
            .iter()
            .find(|o| o.value == self.value)
            .map(|o| o.label.clone())
            .unwrap_or(self.fallback_label.clone());
        let mut root = div()
            .id("typeahead")
            .relative()
            .w(px(300.))
            .text_size(px(13.))
            .track_focus(&self.focus)
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if this.disabled {
                    return;
                }
                match event.keystroke.key.as_str() {
                    "down" | "up" => {
                        if !this.open {
                            this.open(window, cx);
                        } else {
                            let count = this.matches(cx).len();
                            if count > 0 {
                                let delta = if event.keystroke.key == "down" { 1 } else { -1 };
                                this.highlighted = (this.highlighted as isize + delta)
                                    .rem_euclid(count as isize)
                                    as usize;
                                this.scroll.scroll_to_item(this.highlighted);
                            }
                        }
                    }
                    "enter" => {
                        if this.open {
                            if let Some(index) = this.matches(cx).get(this.highlighted).copied() {
                                this.choose(index, window, cx);
                            }
                        } else {
                            this.open(window, cx);
                        }
                    }
                    "escape" if this.open => this.close(window, cx),
                    "space" if !this.open => this.open(window, cx),
                    "tab" => {
                        this.open = false;
                        cx.notify();
                        return;
                    }
                    _ => return,
                }
                window.prevent_default();
                cx.stop_propagation();
                cx.notify();
            }));
        if self.open && !self.disabled {
            root = root.child(self.input.clone());
            let anchor = Rc::new(Cell::new(None::<Bounds<Pixels>>));
            let outside_anchor = anchor.clone();
            let mut menu = div()
                .id("typeahead-menu")
                .occlude()
                .flex()
                .flex_col()
                .w(px(300.))
                .max_h(px(280.))
                .overflow_y_scroll()
                .track_scroll(&self.scroll)
                .p(px(4.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.surface)
                .on_mouse_down_out(cx.listener(move |this, event: &MouseDownEvent, _, cx| {
                    if !outside_anchor
                        .get()
                        .is_some_and(|bounds| bounds.contains(&event.position))
                    {
                        this.open = false;
                        cx.notify();
                    }
                }));
            for (row, index) in matches.iter().copied().enumerate() {
                let option = &self.options[index];
                menu = menu.child(
                    div()
                        .id(("typeahead-option", index))
                        .flex()
                        .items_center()
                        .justify_between()
                        .gap(px(8.))
                        .px(px(8.))
                        .py(px(7.))
                        .rounded(px(4.))
                        .bg(if row == self.highlighted {
                            t.inset
                        } else {
                            t.surface
                        })
                        .text_color(if option.value == self.value {
                            t.accent
                        } else {
                            t.text
                        })
                        .cursor_pointer()
                        .child(option.label.clone())
                        .child(label(option.meta.clone(), cx))
                        .on_hover(cx.listener(move |this, hovered, _, cx| {
                            if *hovered {
                                this.highlighted = row;
                                cx.notify();
                            }
                        }))
                        .on_mouse_down(
                            MouseButton::Left,
                            cx.listener(move |this, _, window, cx| {
                                this.choose(index, window, cx);
                                cx.stop_propagation();
                            }),
                        ),
                );
            }
            if matches.is_empty() {
                menu = menu.child(label(self.empty_label.clone(), cx).p(px(8.)));
            }
            let menu = menu.into_any_element();
            root = root.child(
                canvas(
                    move |bounds, window, cx| {
                        anchor.set(Some(bounds));
                        let viewport = window.viewport_size();
                        let mut menu = menu;
                        let size = menu.layout_as_root(
                            size(
                                AvailableSpace::Definite(px(300.)),
                                AvailableSpace::MinContent,
                            ),
                            window,
                            cx,
                        );
                        let x = bounds
                            .origin
                            .x
                            .min((viewport.width - size.width - px(8.)).max(px(8.)));
                        let below = bounds.bottom() + px(3.);
                        let y = if below + size.height <= viewport.height - px(8.) {
                            below
                        } else {
                            (bounds.origin.y - size.height - px(3.)).max(px(8.))
                        };
                        window.defer_draw(menu, point(x, y), 50);
                    },
                    |_, _, _, _| {},
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            );
        } else {
            let mut trigger = div()
                .id("typeahead-trigger")
                .flex()
                .items_center()
                .justify_between()
                .h(px(28.))
                .px(px(8.))
                .rounded(px(4.))
                .border_1()
                .border_color(t.border)
                .bg(t.inset)
                .text_color(t.text)
                .child(text)
                .child("⌄");
            if self.disabled {
                trigger = trigger.opacity(0.5);
            } else {
                trigger = trigger
                    .focusable()
                    .tab_stop(true)
                    .track_focus(&self.focus)
                    .cursor_pointer()
                    .focus(|style| style.border_color(t.accent))
                    .on_click(cx.listener(|this, _, window, cx| this.open(window, cx)));
            }
            root = root.child(trigger);
        }
        root
    }
}

struct Demo {
    picker: Entity<Typeahead>,
    disabled: Entity<Typeahead>,
    _subscription: Subscription,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label("Project", cx))
            .child(self.picker.clone())
            .child(label(
                format!("Selected: {}", self.picker.read(cx).value),
                cx,
            ))
            .child(label("Disabled", cx))
            .child(self.disabled.clone())
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let options = vec![
            TypeaheadOption::new("forge", "Forge").meta("Application"),
            TypeaheadOption::new("agentsview", "Agentsview").meta("Application"),
            TypeaheadOption::new("kit-ui", "Kit UI").meta("Library"),
            TypeaheadOption::new("gpui", "GPUI").meta("Framework"),
            TypeaheadOption::new("zed", "Zed").meta("Editor"),
        ];
        let picker = cx.new(|cx| {
            let mut picker = Typeahead::new(options.clone(), "Find a project…", cx);
            picker.value = "kit-ui".into();
            picker
        });
        let subscription = cx.subscribe(&picker, |_, picker, event: &TypeaheadSelected, cx| {
            picker.update(cx, |picker, cx| picker.set_value(event.value.clone(), cx));
            cx.notify();
        });
        let disabled = cx.new(|cx| {
            let mut picker = Typeahead::new(options, "Unavailable", cx);
            picker.disabled = true;
            picker.value = "forge".into();
            picker
        });
        Demo {
            picker,
            disabled,
            _subscription: subscription,
        }
    })
    .into()
}
