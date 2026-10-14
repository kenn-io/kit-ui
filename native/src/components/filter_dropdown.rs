use std::{cell::Cell, rc::Rc};

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone)]
pub struct FilterOption {
    pub id: SharedString,
    pub label: SharedString,
    pub count: Option<usize>,
    pub active: bool,
    pub disabled: bool,
}
impl FilterOption {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            count: None,
            active: false,
            disabled: false,
        }
    }
}
#[derive(Clone)]
pub struct FilterSection {
    pub title: SharedString,
    pub options: Vec<FilterOption>,
}
#[derive(Clone)]
pub struct FiltersChanged {
    pub selected: Vec<SharedString>,
}

/// Multi-select filter menu. Selection stays open and emits the complete selection.
pub struct FilterDropdown {
    pub label: SharedString,
    pub sections: Vec<FilterSection>,
    pub disabled: bool,
    focus: FocusHandle,
    open: bool,
    highlighted: usize,
}
impl EventEmitter<FiltersChanged> for FilterDropdown {}
impl Focusable for FilterDropdown {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}
impl FilterDropdown {
    pub fn new(
        label: impl Into<SharedString>,
        sections: Vec<FilterSection>,
        cx: &mut Context<Self>,
    ) -> Self {
        Self {
            label: label.into(),
            sections,
            disabled: false,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            highlighted: 0,
        }
    }
    pub fn selected(&self) -> Vec<SharedString> {
        self.sections
            .iter()
            .flat_map(|s| &s.options)
            .filter(|o| o.active)
            .map(|o| o.id.clone())
            .collect()
    }
    fn changed(&self, cx: &mut Context<Self>) {
        cx.emit(FiltersChanged {
            selected: self.selected(),
        });
        cx.notify();
    }
    fn select(&mut self, index: usize, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        if let Some(option) = self
            .sections
            .iter_mut()
            .flat_map(|s| &mut s.options)
            .nth(index)
            .filter(|o| !o.disabled)
        {
            option.active = !option.active;
            self.changed(cx);
        }
    }
    fn bulk(&mut self, active: bool, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        for option in self
            .sections
            .iter_mut()
            .flat_map(|s| &mut s.options)
            .filter(|o| !o.disabled)
        {
            option.active = active;
        }
        self.changed(cx);
    }
    fn move_highlight(&mut self, delta: isize) {
        let options: Vec<_> = self.sections.iter().flat_map(|s| &s.options).collect();
        let count = options.len();
        if count == 0 {
            return;
        }
        for step in 1..=count {
            let index = (self.highlighted as isize + delta * step as isize)
                .rem_euclid(count as isize) as usize;
            if !options[index].disabled {
                self.highlighted = index;
                break;
            }
        }
    }
}
impl Render for FilterDropdown {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        if self.disabled {
            self.open = false;
        }
        let count = self.selected().len();
        let mut trigger = div()
            .id("filter-trigger")
            .relative()
            .flex()
            .items_center()
            .gap(px(8.))
            .px(px(12.))
            .py(px(8.))
            .rounded(px(4.))
            .border_1()
            .border_color(if count > 0 || self.open {
                t.accent
            } else {
                t.border
            })
            .bg(t.inset)
            .text_color(if count > 0 { t.accent } else { t.text })
            .text_size(px(13.))
            .child(self.label.clone())
            .child(format!("{count} selected  ⌄"));
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
                this.open = !this.open;
                this.focus.focus(window);
                cx.notify();
            }))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                match event.keystroke.key.as_str() {
                    "down" | "up" => {
                        if !this.open {
                            this.open = true;
                        } else {
                            this.move_highlight(if event.keystroke.key == "down" { 1 } else { -1 });
                        }
                    }
                    "enter" | "space" => {
                        if this.open {
                            this.select(this.highlighted, cx);
                        } else {
                            this.open = true;
                        }
                    }
                    "escape" | "tab" => this.open = false,
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
            let outside = anchor.clone();
            let mut menu = div()
                .id("filter-menu")
                .occlude()
                .flex()
                .flex_col()
                .w(px(260.))
                .max_h(px(380.))
                .overflow_y_scroll()
                .p(px(4.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.surface)
                .text_color(t.text)
                .text_size(px(13.))
                .on_mouse_down_out(cx.listener(move |this, event: &MouseDownEvent, _, cx| {
                    if !outside
                        .get()
                        .is_some_and(|bounds| bounds.contains(&event.position))
                    {
                        this.open = false;
                        cx.notify();
                    }
                }))
                .child(
                    div()
                        .id("filter-select-all")
                        .px(px(8.))
                        .py(px(7.))
                        .text_color(t.accent)
                        .cursor_pointer()
                        .hover(|s| s.bg(t.inset))
                        .child("Select all")
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.bulk(true, cx);
                            cx.stop_propagation();
                        })),
                );
            let mut index = 0;
            for section in &self.sections {
                menu = menu.child(
                    div()
                        .px(px(8.))
                        .py(px(6.))
                        .text_color(t.muted)
                        .child(section.title.clone()),
                );
                for option in &section.options {
                    let option_index = index;
                    index += 1;
                    let mut item = div()
                        .id(("filter-option", option_index))
                        .flex()
                        .items_center()
                        .gap(px(8.))
                        .px(px(8.))
                        .py(px(7.))
                        .rounded(px(4.))
                        .bg(if option_index == self.highlighted {
                            t.inset
                        } else {
                            t.surface
                        })
                        .child(
                            div()
                                .w(px(18.))
                                .text_color(t.accent)
                                .child(if option.active { "☑" } else { "☐" }),
                        )
                        .child(div().flex_1().child(option.label.clone()));
                    if let Some(count) = option.count {
                        item = item.child(div().text_color(t.muted).child(count.to_string()));
                    }
                    if option.disabled {
                        item = item.opacity(0.4);
                    } else {
                        item = item
                            .cursor_pointer()
                            .on_hover(cx.listener(move |this, hovered, _, cx| {
                                if *hovered {
                                    this.highlighted = option_index;
                                    cx.notify();
                                }
                            }))
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.select(option_index, cx);
                                cx.stop_propagation();
                            }));
                    }
                    menu = menu.child(item);
                }
            }
            menu = menu.child(
                div()
                    .id("filter-clear")
                    .px(px(8.))
                    .py(px(8.))
                    .border_t_1()
                    .border_color(t.border)
                    .text_color(t.muted)
                    .cursor_pointer()
                    .hover(|s| s.bg(t.inset))
                    .child("Clear filters")
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.bulk(false, cx);
                        cx.stop_propagation();
                    })),
            );
            let menu = menu.into_any_element();
            trigger = trigger.child(
                canvas(
                    move |bounds, window, cx| {
                        anchor.set(Some(bounds));
                        let mut menu = menu;
                        let size = menu.layout_as_root(
                            size(
                                AvailableSpace::Definite(px(260.)),
                                AvailableSpace::MinContent,
                            ),
                            window,
                            cx,
                        );
                        let viewport = window.viewport_size();
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

struct FilterDemo {
    filter: Entity<FilterDropdown>,
    selected: Vec<SharedString>,
    _subscription: Subscription,
}
impl Render for FilterDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let tasks = [
            ("Build native gallery", "running"),
            ("Review component APIs", "waiting"),
            ("Ship tokens", "done"),
            ("Run accessibility checks", "waiting"),
        ];
        let visible: Vec<_> = tasks
            .into_iter()
            .filter(|(_, status)| {
                self.selected.is_empty() || self.selected.iter().any(|s| s.as_ref() == *status)
            })
            .collect();
        let mut content = stack()
            .child(self.filter.clone())
            .child(label(format!("{} of 4 tasks", visible.len()), cx));
        for (name, status) in visible {
            content = content.child(
                div()
                    .flex()
                    .justify_between()
                    .p(px(12.))
                    .rounded(px(4.))
                    .bg(theme(cx).inset)
                    .child(name)
                    .child(label(status, cx)),
            );
        }
        content
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let mut options = vec![
            FilterOption::new("running", "Running"),
            FilterOption::new("waiting", "Waiting"),
            FilterOption::new("done", "Done"),
        ];
        for (option, count) in options.iter_mut().zip([1, 2, 1]) {
            option.count = Some(count);
        }
        let filter = cx.new(|cx| {
            FilterDropdown::new(
                "Status",
                vec![FilterSection {
                    title: "Task status".into(),
                    options,
                }],
                cx,
            )
        });
        let subscription = cx.subscribe(
            &filter,
            |this: &mut FilterDemo, _, event: &FiltersChanged, cx| {
                this.selected = event.selected.clone();
                cx.notify();
            },
        );
        FilterDemo {
            filter,
            selected: Vec::new(),
            _subscription: subscription,
        }
    })
    .into()
}
