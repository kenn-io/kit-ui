use std::{cell::Cell, rc::Rc};

use crate::{
    components::calendar::{Calendar, CalendarChanged},
    theme::{control, label, row, stack, theme},
};
use chrono::{Local, NaiveDate};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Debug)]
pub struct DatePickerChanged {
    pub date: Option<NaiveDate>,
}

/// Single-date picker with a calendar popover and an optional inclusive maximum.
pub struct DatePicker {
    pub selected: Option<NaiveDate>,
    pub max_date: Option<NaiveDate>,
    pub disabled: bool,
    pub placeholder: SharedString,
    pub date_format: SharedString,
    pub align_right: bool,
    calendar: Entity<Calendar>,
    focus: FocusHandle,
    open: bool,
    restore_focus: bool,
    _subscription: Subscription,
}

impl EventEmitter<DatePickerChanged> for DatePicker {}

impl DatePicker {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let calendar = cx.new(Calendar::new);
        let subscription = cx.subscribe(
            &calendar,
            |this: &mut Self, _, event: &CalendarChanged, cx| {
                if this.disabled || this.max_date.is_some_and(|max| event.date > max) {
                    return;
                }
                this.selected = Some(event.date);
                this.open = false;
                this.restore_focus = true;
                cx.emit(DatePickerChanged {
                    date: this.selected,
                });
                cx.notify();
            },
        );
        Self {
            selected: None,
            max_date: None,
            disabled: false,
            placeholder: "Choose a date".into(),
            date_format: "%b %-d, %Y".into(),
            align_right: false,
            calendar,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            restore_focus: false,
            _subscription: subscription,
        }
    }

    pub fn set_date(&mut self, date: Option<NaiveDate>, cx: &mut Context<Self>) {
        self.selected = date;
        cx.notify();
    }

    fn toggle(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        self.open = !self.open;
        if self.open {
            let selected = self.selected;
            let max_date = self.max_date;
            self.calendar.update(cx, |calendar, cx| {
                calendar.set_date(selected.unwrap_or_else(|| Local::now().date_naive()), cx);
                calendar.selected = selected;
                calendar.max_date = max_date;
            });
        }
        self.focus.focus(window);
        cx.notify();
    }
}

impl Focusable for DatePicker {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl Render for DatePicker {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.restore_focus && !self.disabled {
            self.focus.focus(window);
            self.restore_focus = false;
        }
        if self.disabled {
            self.open = false;
        }
        let t = theme(cx);
        let text = self.selected.map_or_else(
            || self.placeholder.clone(),
            |date| date.format(self.date_format.as_ref()).to_string().into(),
        );
        let mut trigger = div()
            .id("date-picker-trigger")
            .relative()
            .flex()
            .items_center()
            .justify_between()
            .w(px(200.))
            .px(px(12.))
            .py(px(8.))
            .rounded(px(4.))
            .border_1()
            .border_color(if self.open { t.accent } else { t.border })
            .bg(t.inset)
            .text_size(px(13.))
            .text_color(if self.selected.is_some() {
                t.text
            } else {
                t.muted
            })
            .child(text)
            .child(if self.open { "⌃" } else { "⌄" });
        if self.disabled {
            return trigger.opacity(0.45);
        }
        trigger = trigger
            .track_focus(&self.focus)
            .focusable()
            .tab_stop(true)
            .cursor_pointer()
            .focus(|style| style.border_color(t.accent))
            .on_click(cx.listener(|this, _, window, cx| this.toggle(window, cx)))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if event.keystroke.key == "escape" && this.open {
                    this.open = false;
                    this.focus.focus(window);
                    window.prevent_default();
                    cx.stop_propagation();
                    cx.notify();
                }
            }));
        if self.open {
            let anchor = Rc::new(Cell::new(None::<Bounds<Pixels>>));
            let outside_anchor = anchor.clone();
            let align_right = self.align_right;
            let menu = stack()
                .id("date-picker-calendar")
                .occlude()
                .w(px(276.))
                .p(px(12.))
                .border_1()
                .border_color(t.border)
                .rounded(px(6.))
                .bg(t.surface)
                .text_color(t.text)
                .cursor_default()
                .on_click(|_, _, cx| cx.stop_propagation())
                .on_mouse_down_out(cx.listener(move |this, event: &MouseDownEvent, _, cx| {
                    if !outside_anchor
                        .get()
                        .is_some_and(|bounds| bounds.contains(&event.position))
                    {
                        this.open = false;
                        cx.notify();
                    }
                }))
                .child(self.calendar.clone())
                .when(self.selected.is_some(), |menu| {
                    menu.child(control("date-picker-clear", "Clear date", cx).on_click(
                        cx.listener(|this, _, window, cx| {
                            this.selected = None;
                            this.open = false;
                            this.focus.focus(window);
                            cx.emit(DatePickerChanged { date: None });
                            cx.stop_propagation();
                            cx.notify();
                        }),
                    ))
                })
                .into_any_element();
            trigger = trigger.child(
                canvas(
                    move |bounds, window, cx| {
                        anchor.set(Some(bounds));
                        let viewport = window.viewport_size();
                        let mut menu = menu;
                        let measured = menu.layout_as_root(
                            size(
                                AvailableSpace::Definite(px(276.)),
                                AvailableSpace::MinContent,
                            ),
                            window,
                            cx,
                        );
                        let desired_x = if align_right {
                            bounds.right() - measured.width
                        } else {
                            bounds.origin.x
                        };
                        let x = desired_x
                            .max(px(8.))
                            .min((viewport.width - measured.width - px(8.)).max(px(8.)));
                        let below = bounds.bottom() + px(6.);
                        let y = if below + measured.height <= viewport.height - px(8.) {
                            below
                        } else {
                            (bounds.origin.y - measured.height - px(6.)).max(px(8.))
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

struct DatePickerDemo {
    picker: Entity<DatePicker>,
    disabled: Entity<DatePicker>,
    changes: usize,
    _subscription: Subscription,
}

impl Render for DatePickerDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected = self.picker.read(cx).selected;
        stack()
            .child(label("Due date", cx))
            .child(self.picker.clone())
            .child(label(
                selected.map_or("No date selected".to_string(), |date| {
                    format!("Selected: {date}")
                }),
                cx,
            ))
            .child(label(format!("Changes: {}", self.changes), cx))
            .child(row().child(
                control("date-picker-reset", "Reset", cx).on_click(cx.listener(
                    |this, _, _, cx| {
                        this.picker
                            .update(cx, |picker, cx| picker.set_date(None, cx));
                        cx.notify();
                    },
                )),
            ))
            .child(label("Read-only date", cx))
            .child(self.disabled.clone())
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let picker = cx.new(|cx| {
            let mut picker = DatePicker::new(cx);
            picker.max_date = Some(Local::now().date_naive());
            picker
        });
        let disabled = cx.new(|cx| {
            let mut picker = DatePicker::new(cx);
            picker.selected = Some(Local::now().date_naive());
            picker.disabled = true;
            picker
        });
        let subscription = cx.subscribe(
            &picker,
            |this: &mut DatePickerDemo, _, _: &DatePickerChanged, cx| {
                this.changes += 1;
                cx.notify();
            },
        );
        DatePickerDemo {
            picker,
            disabled,
            changes: 0,
            _subscription: subscription,
        }
    })
    .into()
}
