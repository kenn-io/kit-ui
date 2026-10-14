use std::{cell::Cell, rc::Rc};

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone)]
pub struct SelectOption {
    pub value: SharedString,
    pub label: SharedString,
    pub disabled: bool,
}
impl SelectOption {
    pub fn new(value: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            disabled: false,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
}

#[derive(Clone, Debug)]
pub struct SelectionChanged {
    pub value: SharedString,
}

/// A native select menu. Subscribe to SelectionChanged and update value to accept a selection.
pub struct SelectDropdown {
    pub options: Vec<SelectOption>,
    pub value: SharedString,
    pub disabled: bool,
    focus: FocusHandle,
    open: bool,
    highlighted: usize,
    scroll: ScrollHandle,
}
impl EventEmitter<SelectionChanged> for SelectDropdown {}
impl SelectDropdown {
    pub fn new(
        options: Vec<SelectOption>,
        value: impl Into<SharedString>,
        cx: &mut Context<Self>,
    ) -> Self {
        Self {
            options,
            value: value.into(),
            disabled: false,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            highlighted: 0,
            scroll: ScrollHandle::new(),
        }
    }
    pub fn set_value(&mut self, value: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.value = value.into();
        cx.notify();
    }
    fn toggle(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        self.open = !self.open;
        self.highlighted = self
            .options
            .iter()
            .position(|o| o.value == self.value)
            .unwrap_or(0);
        self.focus.focus(window);
        self.scroll.scroll_to_item(self.highlighted);
        cx.notify();
    }
    fn choose(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if let Some(option) = self.options.get(index).filter(|o| !o.disabled) {
            cx.emit(SelectionChanged {
                value: option.value.clone(),
            });
            self.open = false;
            self.focus.focus(window);
            cx.notify();
        }
    }
    fn move_highlight(&mut self, delta: isize) {
        let count = self.options.len();
        if count == 0 {
            return;
        }
        for step in 1..=count {
            let index = (self.highlighted as isize + delta * step as isize)
                .rem_euclid(count as isize) as usize;
            if !self.options[index].disabled {
                self.highlighted = index;
                self.scroll.scroll_to_item(index);
                break;
            }
        }
    }
}
impl Focusable for SelectDropdown {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}
impl Render for SelectDropdown {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let selected = self
            .options
            .iter()
            .find(|o| o.value == self.value)
            .or(self.options.first());
        let text = selected
            .map(|o| o.label.clone())
            .unwrap_or(self.value.clone());
        let mut trigger = div()
            .id("select-trigger")
            .relative()
            .flex()
            .items_center()
            .justify_between()
            .w(px(240.))
            .px(px(12.))
            .py(px(8.))
            .rounded(px(4.))
            .border_1()
            .border_color(if self.open { t.accent } else { t.border })
            .bg(t.inset)
            .text_color(t.text)
            .text_size(px(13.))
            .child(text)
            .child("⌄");
        if self.disabled {
            return trigger.opacity(0.45);
        }
        trigger = trigger
            .cursor_pointer()
            .track_focus(&self.focus)
            .focusable()
            .tab_stop(true)
            .focus(|s| s.border_color(t.accent))
            .capture_key_up(|event, window, cx| {
                if matches!(event.keystroke.key.as_str(), "enter" | "space") {
                    window.prevent_default();
                    cx.stop_propagation();
                }
            })
            .on_click(cx.listener(|this, _, window, cx| this.toggle(window, cx)))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                match event.keystroke.key.as_str() {
                    "down" | "up" => {
                        if !this.open {
                            this.toggle(window, cx);
                        } else {
                            this.move_highlight(if event.keystroke.key == "down" { 1 } else { -1 });
                        }
                    }
                    "enter" | "space" => {
                        if this.open {
                            this.choose(this.highlighted, window, cx);
                        } else {
                            this.toggle(window, cx);
                        }
                    }
                    "escape" | "tab" => {
                        this.open = false;
                    }
                    _ => return,
                }
                if event.keystroke.key != "tab" {
                    window.prevent_default();
                    cx.stop_propagation();
                }
                cx.notify();
            }));
        if self.open {
            let anchor = Rc::new(Cell::new(None::<Bounds<Pixels>>));
            let outside_anchor = anchor.clone();
            let mut menu = div()
                .id("select-menu")
                .occlude()
                .flex()
                .flex_col()
                .w(px(240.))
                .max_h(px(280.))
                .overflow_y_scroll()
                .track_scroll(&self.scroll)
                .p(px(4.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.surface)
                .text_color(t.text)
                .text_size(px(13.))
                .on_mouse_down_out(cx.listener(move |this, event: &MouseDownEvent, _, cx| {
                    if !outside_anchor
                        .get()
                        .is_some_and(|b| b.contains(&event.position))
                    {
                        this.open = false;
                        cx.notify();
                    }
                }));
            for (index, option) in self.options.iter().enumerate() {
                let selected = option.value == self.value;
                let mut item = div()
                    .id(("select-option", index))
                    .flex()
                    .items_center()
                    .justify_between()
                    .px(px(8.))
                    .py(px(7.))
                    .rounded(px(4.))
                    .bg(if index == self.highlighted {
                        t.inset
                    } else {
                        t.surface
                    })
                    .text_color(if selected { t.accent } else { t.text })
                    .child(option.label.clone())
                    .child(if selected { "✓" } else { "" });
                if option.disabled {
                    item = item.opacity(0.4);
                } else {
                    item = item
                        .cursor_pointer()
                        .on_hover(cx.listener(move |this, hovered, _, cx| {
                            if *hovered {
                                this.highlighted = index;
                                cx.notify();
                            }
                        }))
                        .on_click(cx.listener(move |this, _, window, cx| {
                            this.choose(index, window, cx);
                            cx.stop_propagation();
                        }));
                }
                menu = menu.child(item);
            }
            let menu = menu.into_any_element();
            trigger = trigger.child(
                canvas(
                    move |bounds, window, cx| {
                        anchor.set(Some(bounds));
                        let viewport = window.viewport_size();
                        let mut menu = menu;
                        let size = menu.layout_as_root(
                            size(
                                AvailableSpace::Definite(px(240.)),
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
        }
        trigger
    }
}

struct SelectDemo {
    select: Entity<SelectDropdown>,
    disabled: Entity<SelectDropdown>,
    changes: usize,
    _subscription: Subscription,
}
impl Render for SelectDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label("Project visibility", cx))
            .child(self.select.clone())
            .child(label(
                format!(
                    "Selected: {} · Changes: {}",
                    self.select.read(cx).value,
                    self.changes
                ),
                cx,
            ))
            .child(label("Managed setting", cx))
            .child(self.disabled.clone())
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let options = vec![
            SelectOption::new("private", "Private"),
            SelectOption::new("team", "Team"),
            SelectOption::new("public", "Public"),
            SelectOption::new("enterprise", "Enterprise only").disabled(true),
        ];
        let select = cx.new(|cx| SelectDropdown::new(options.clone(), "private", cx));
        let disabled = cx.new(|cx| {
            let mut select = SelectDropdown::new(options, "team", cx);
            select.disabled = true;
            select
        });
        let subscription = cx.subscribe(
            &select,
            |this: &mut SelectDemo, entity, event: &SelectionChanged, cx| {
                entity.update(cx, |select, cx| select.set_value(event.value.clone(), cx));
                this.changes += 1;
                cx.notify();
            },
        );
        SelectDemo {
            select,
            disabled,
            changes: 0,
            _subscription: subscription,
        }
    })
    .into()
}
