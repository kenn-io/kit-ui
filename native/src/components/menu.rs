use std::{
    cell::Cell,
    rc::Rc,
    time::{Duration, Instant},
};

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone)]
pub struct MenuOption {
    pub id: SharedString,
    pub label: SharedString,
    pub disabled: bool,
    pub danger: bool,
}
impl MenuOption {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            disabled: false,
            danger: false,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn danger(mut self, danger: bool) -> Self {
        self.danger = danger;
        self
    }
}

#[derive(Clone, Debug)]
pub struct MenuSelected {
    pub id: SharedString,
}

/// An anchored action menu. Subscribe to MenuSelected to handle an action.
pub struct Menu {
    pub label: SharedString,
    pub items: Vec<MenuOption>,
    pub disabled: bool,
    focus: FocusHandle,
    open: bool,
    highlighted: Option<usize>,
    scroll: ScrollHandle,
    typeahead: String,
    typed_at: Option<Instant>,
}
impl EventEmitter<MenuSelected> for Menu {}
impl Menu {
    pub fn new(
        label: impl Into<SharedString>,
        items: Vec<MenuOption>,
        cx: &mut Context<Self>,
    ) -> Self {
        Self {
            label: label.into(),
            items,
            disabled: false,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            highlighted: None,
            scroll: ScrollHandle::new(),
            typeahead: String::new(),
            typed_at: None,
        }
    }
    pub fn is_open(&self) -> bool {
        self.open
    }
    fn edge(&mut self, last: bool) {
        self.highlighted = if last {
            self.items.iter().rposition(|item| !item.disabled)
        } else {
            self.items.iter().position(|item| !item.disabled)
        };
        if let Some(index) = self.highlighted {
            self.scroll.scroll_to_item(index);
        }
    }
    fn show(&mut self, last: bool, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        self.open = true;
        self.typeahead.clear();
        self.typed_at = None;
        self.edge(last);
        self.focus.focus(window);
        cx.notify();
    }
    fn close(&mut self, restore_focus: bool, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        self.typeahead.clear();
        if restore_focus {
            self.focus.focus(window);
        }
        cx.notify();
    }
    fn choose(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if let Some(item) = self.items.get(index).filter(|item| !item.disabled) {
            let id = item.id.clone();
            self.close(true, window, cx);
            cx.emit(MenuSelected { id });
        }
    }
    fn step(&mut self, direction: isize) {
        let count = self.items.len();
        if count == 0 {
            return;
        }
        let start = self
            .highlighted
            .map(|index| index as isize)
            .unwrap_or(if direction > 0 { -1 } else { 0 });
        for offset in 1..=count {
            let index = (start + direction * offset as isize).rem_euclid(count as isize) as usize;
            if !self.items[index].disabled {
                self.highlighted = Some(index);
                self.scroll.scroll_to_item(index);
                break;
            }
        }
    }
    fn typeahead(&mut self, key: &str) {
        let now = Instant::now();
        if self
            .typed_at
            .is_none_or(|last| now.duration_since(last) > Duration::from_millis(500))
        {
            self.typeahead.clear();
        }
        let key = key.to_lowercase();
        if !self.typeahead.is_empty()
            && self
                .typeahead
                .chars()
                .all(|character| character.to_string() == key)
        {
            self.typeahead.clear();
        }
        self.typeahead.push_str(&key);
        self.typed_at = Some(now);
        let count = self.items.len();
        let start = self.highlighted.map(|index| index as isize).unwrap_or(-1);
        for offset in 1..=count {
            let index = (start + offset as isize).rem_euclid(count as isize) as usize;
            if !self.items[index].disabled
                && self.items[index]
                    .label
                    .trim()
                    .to_lowercase()
                    .starts_with(&self.typeahead)
            {
                self.highlighted = Some(index);
                self.scroll.scroll_to_item(index);
                break;
            }
        }
    }
}
impl Focusable for Menu {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}
impl Render for Menu {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let viewport = window.viewport_size();
        let width = px(240.).min((viewport.width - px(16.)).max(px(1.)));
        let mut trigger = div()
            .id("menu-trigger")
            .relative()
            .flex()
            .items_center()
            .gap(px(8.))
            .px(px(12.))
            .py(px(7.))
            .rounded(px(4.))
            .border_1()
            .border_color(if self.open { t.accent } else { t.border })
            .bg(t.inset)
            .text_color(t.text)
            .text_size(px(13.))
            .child(self.label.clone())
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
            .on_click(cx.listener(|this, _, window, cx| {
                if this.open {
                    this.close(true, window, cx);
                } else {
                    this.show(false, window, cx);
                }
            }))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                let key = event.keystroke.key.as_str();
                match key {
                    "down" | "up" => {
                        if this.open {
                            this.step(if key == "down" { 1 } else { -1 });
                        } else {
                            this.show(key == "up", window, cx);
                        }
                    }
                    "home" | "end" if this.open => this.edge(key == "end"),
                    "enter" | "space" => {
                        if this.open {
                            if let Some(index) = this.highlighted {
                                this.choose(index, window, cx);
                            }
                        } else {
                            this.show(false, window, cx);
                        }
                    }
                    "escape" if this.open => this.close(true, window, cx),
                    "tab" if this.open => {
                        this.close(false, window, cx);
                        return;
                    }
                    _ if this.open
                        && key.chars().count() == 1
                        && !event.keystroke.modifiers.control
                        && !event.keystroke.modifiers.platform
                        && !event.keystroke.modifiers.alt =>
                    {
                        this.typeahead(key)
                    }
                    _ => return,
                }
                window.prevent_default();
                cx.stop_propagation();
                cx.notify();
            }));
        if self.open {
            let anchor = Rc::new(Cell::new(None::<Bounds<Pixels>>));
            let outside_anchor = anchor.clone();
            let mut menu = div()
                .id("menu-popup")
                .occlude()
                .flex()
                .flex_col()
                .w(width)
                .max_h(px(360.).min((viewport.height - px(16.)).max(px(1.))))
                .overflow_y_scroll()
                .track_scroll(&self.scroll)
                .p(px(4.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.surface)
                .text_color(t.text)
                .text_size(px(13.))
                .on_mouse_down_out(
                    cx.listener(move |this, event: &MouseDownEvent, window, cx| {
                        if !outside_anchor
                            .get()
                            .is_some_and(|bounds| bounds.contains(&event.position))
                        {
                            this.close(false, window, cx);
                        }
                    }),
                );
            for (index, item) in self.items.iter().enumerate() {
                let mut row = div()
                    .id(("menu-action", index))
                    .px(px(8.))
                    .py(px(7.))
                    .rounded(px(4.))
                    .bg(if self.highlighted == Some(index) {
                        t.inset
                    } else {
                        t.surface
                    })
                    .text_color(if item.danger { t.danger } else { t.text })
                    .child(item.label.clone());
                if item.disabled {
                    row = row.opacity(0.45);
                } else {
                    row = row
                        .cursor_pointer()
                        .on_hover(cx.listener(move |this, hovered, _, cx| {
                            if *hovered {
                                this.highlighted = Some(index);
                                cx.notify();
                            }
                        }))
                        .on_click(cx.listener(move |this, _, window, cx| {
                            this.choose(index, window, cx);
                            cx.stop_propagation();
                        }));
                }
                menu = menu.child(row);
            }
            let menu = menu.into_any_element();
            trigger = trigger.child(
                canvas(
                    move |bounds, window, cx| {
                        anchor.set(Some(bounds));
                        let viewport = window.viewport_size();
                        let mut menu = menu;
                        let size = menu.layout_as_root(
                            size(AvailableSpace::Definite(width), AvailableSpace::MinContent),
                            window,
                            cx,
                        );
                        let x = bounds
                            .origin
                            .x
                            .min((viewport.width - size.width - px(8.)).max(px(8.)))
                            .max(px(8.));
                        let below = bounds.bottom() + px(3.);
                        let y = if below + size.height <= viewport.height - px(8.) {
                            below
                        } else {
                            (bounds.origin.y - size.height - px(3.))
                                .max(px(8.))
                                .min((viewport.height - size.height - px(8.)).max(px(8.)))
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

struct MenuDemo {
    menu: Entity<Menu>,
    last_action: SharedString,
    _subscription: Subscription,
}
impl Render for MenuDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(self.menu.clone())
            .child(label(format!("Last action: {}", self.last_action), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let menu = cx.new(|cx| {
            Menu::new(
                "File actions",
                vec![
                    MenuOption::new("open", "Open file"),
                    MenuOption::new("duplicate", "Duplicate file"),
                    MenuOption::new("share", "Share file").disabled(true),
                    MenuOption::new("delete", "Delete file").danger(true),
                ],
                cx,
            )
        });
        let subscription =
            cx.subscribe(&menu, |this: &mut MenuDemo, _, event: &MenuSelected, cx| {
                this.last_action = event.id.clone();
                cx.notify();
            });
        MenuDemo {
            menu,
            last_action: "None".into(),
            _subscription: subscription,
        }
    })
    .into()
}
