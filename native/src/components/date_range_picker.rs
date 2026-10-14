use std::{cell::Cell, rc::Rc};

use crate::{
    components::calendar::{Calendar, CalendarChanged},
    theme::{control, label, row, stack, theme},
};
use chrono::{Datelike, Duration, Local, Months, NaiveDate};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Debug)]
pub struct RangeChanged {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Relative,
    Calendar,
    Custom,
}

#[derive(Clone, Copy, PartialEq)]
enum Unit {
    Day,
    Week,
    Month,
}

/// Inclusive range picker. Calendar edits remain a draft until Apply; Cancel
/// restores the selected range. Custom ranges are picked with two clicks.
pub struct DateRangePicker {
    pub selected: (NaiveDate, NaiveDate),
    pub max_date: Option<NaiveDate>,
    pub earliest_date: Option<NaiveDate>,
    pub disabled: bool,
    pub align_right: bool,
    calendar: Entity<Calendar>,
    focus: FocusHandle,
    open: bool,
    mode: Mode,
    unit: Unit,
    draft: (NaiveDate, NaiveDate),
    pending: bool,
    _subscription: Subscription,
}

impl EventEmitter<RangeChanged> for DateRangePicker {}

impl DateRangePicker {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let today = Local::now().date_naive();
        let calendar = cx.new(Calendar::new);
        let subscription = cx.subscribe(
            &calendar,
            |this: &mut Self, _, event: &CalendarChanged, cx| {
                if this.disabled || this.max_date.is_some_and(|max| event.date > max) {
                    return;
                }
                if this.mode == Mode::Calendar {
                    this.draft = Self::period(this.unit, event.date);
                    this.pending = false;
                } else if this.pending {
                    this.draft = (this.draft.0.min(event.date), this.draft.0.max(event.date));
                    this.pending = false;
                } else {
                    this.draft = (event.date, event.date);
                    this.pending = true;
                }
                this.sync_calendar(false, cx);
                cx.notify();
            },
        );
        Self {
            selected: (today - Duration::days(6), today),
            max_date: None,
            earliest_date: None,
            disabled: false,
            align_right: false,
            calendar,
            focus: cx.focus_handle().tab_stop(true),
            open: false,
            mode: Mode::Relative,
            unit: Unit::Week,
            draft: (today - Duration::days(6), today),
            pending: false,
            _subscription: subscription,
        }
    }

    pub fn set_range(&mut self, start: NaiveDate, end: NaiveDate, cx: &mut Context<Self>) {
        self.selected = (start.min(end), start.max(end));
        self.draft = self.selected;
        self.pending = false;
        self.sync_calendar(true, cx);
        cx.notify();
    }

    fn period(unit: Unit, anchor: NaiveDate) -> (NaiveDate, NaiveDate) {
        match unit {
            Unit::Day => (anchor, anchor),
            Unit::Week => {
                let start = anchor - Duration::days(anchor.weekday().num_days_from_monday() as i64);
                (start, start + Duration::days(6))
            }
            Unit::Month => {
                let start = anchor.with_day(1).unwrap();
                let end = start.checked_add_months(Months::new(1)).unwrap() - Duration::days(1);
                (start, end)
            }
        }
    }

    fn sync_calendar(&self, reveal: bool, cx: &mut Context<Self>) {
        let (start, end) = self.draft;
        let max_date = self.max_date;
        self.calendar.update(cx, |calendar, cx| {
            if reveal {
                calendar.set_date(end, cx);
            }
            calendar.max_date = max_date;
            calendar.set_range(start, end, cx);
        });
    }

    fn toggle(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        self.open = !self.open;
        if self.open {
            self.draft = self.selected;
            self.pending = false;
            self.sync_calendar(true, cx);
        }
        self.focus.focus(window);
        cx.notify();
    }

    fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        self.pending = false;
        self.focus.focus(window);
        cx.notify();
    }

    fn preset(&mut self, days: i64, cx: &mut Context<Self>) {
        let today = Local::now().date_naive();
        let end = self.max_date.map_or(today, |max| max.min(today));
        let start = if days == 0 {
            self.earliest_date
                .unwrap_or(end - Duration::days(365))
                .min(end)
        } else {
            end - Duration::days(days - 1)
        };
        self.draft = (start, end);
        self.pending = false;
        self.sync_calendar(true, cx);
        cx.notify();
    }
}

impl Focusable for DateRangePicker {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl Render for DateRangePicker {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.disabled {
            self.open = false;
        }
        let t = theme(cx);
        let mut trigger = control(
            "date-range-trigger",
            format!(
                "{} – {}  {}",
                self.selected.0,
                self.selected.1,
                if self.open { "⌃" } else { "⌄" }
            ),
            cx,
        )
        .relative()
        .track_focus(&self.focus);
        if self.disabled {
            return trigger.opacity(0.45).tab_stop(false).cursor_default();
        }
        trigger = trigger
            .on_click(cx.listener(|this, _, window, cx| this.toggle(window, cx)))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if event.keystroke.key == "escape" && this.open {
                    this.close(window, cx);
                    window.prevent_default();
                    cx.stop_propagation();
                }
            }));
        if !self.open {
            return trigger;
        }
        let mut tabs = row().flex_nowrap();
        for (index, mode, text) in [
            (0, Mode::Relative, "Relative"),
            (1, Mode::Calendar, "Calendar"),
            (2, Mode::Custom, "Custom"),
        ] {
            tabs = tabs.child(
                control(("date-range-mode", index as usize), text, cx)
                    .flex_1()
                    .when(self.mode == mode, |tab| {
                        tab.bg(t.accent).text_color(t.on_accent)
                    })
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.mode = mode;
                        this.pending = false;
                        if mode == Mode::Calendar {
                            this.draft = Self::period(this.unit, this.draft.1);
                        }
                        this.sync_calendar(true, cx);
                        cx.notify();
                    })),
            );
        }
        let mut panel = stack()
            .id("date-range-panel")
            .occlude()
            .w(px(310.))
            .p(px(12.))
            .gap(px(12.))
            .rounded(px(6.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .cursor_default()
            .on_click(|_, _, cx| cx.stop_propagation())
            .child(tabs);
        match self.mode {
            Mode::Relative => {
                let mut presets = row();
                for (index, days, text) in [
                    (0, 1, "Today"),
                    (1, 7, "7 days"),
                    (2, 30, "30 days"),
                    (3, 90, "90 days"),
                    (4, 365, "1 year"),
                    (5, 0, "All"),
                ] {
                    presets = presets.child(
                        control(("date-range-preset", index as usize), text, cx)
                            .on_click(cx.listener(move |this, _, _, cx| this.preset(days, cx))),
                    );
                }
                panel = panel.child(presets);
            }
            Mode::Calendar => {
                let mut units = row().flex_nowrap();
                for (index, unit, text) in [
                    (0, Unit::Day, "Day"),
                    (1, Unit::Week, "Week"),
                    (2, Unit::Month, "Month"),
                ] {
                    units = units.child(
                        control(("date-range-unit", index as usize), text, cx)
                            .flex_1()
                            .when(self.unit == unit, |pill| {
                                pill.bg(t.accent).text_color(t.on_accent)
                            })
                            .on_click(cx.listener(move |this, _, _, cx| {
                                this.unit = unit;
                                this.draft = Self::period(unit, this.draft.1);
                                this.pending = false;
                                this.sync_calendar(false, cx);
                                cx.notify();
                            })),
                    );
                }
                panel = panel.child(units).child(self.calendar.clone());
            }
            Mode::Custom => {
                panel = panel
                    .child(label(
                        if self.pending {
                            "Choose the end date"
                        } else {
                            "Choose the start date"
                        },
                        cx,
                    ))
                    .child(self.calendar.clone());
            }
        }
        let valid = !self.pending && self.max_date.is_none_or(|max| self.draft.1 <= max);
        let apply = control("date-range-apply", "Apply", cx);
        let apply = if valid {
            apply
                .bg(t.accent)
                .text_color(t.on_accent)
                .on_click(cx.listener(|this, _, window, cx| {
                    this.selected = this.draft;
                    cx.emit(RangeChanged {
                        start: this.selected.0,
                        end: this.selected.1,
                    });
                    this.close(window, cx);
                    cx.stop_propagation();
                }))
        } else {
            apply.opacity(0.35).tab_stop(false).cursor_default()
        };
        panel = panel
            .child(label(
                format!(
                    "{} – {}",
                    self.draft.0,
                    if self.pending {
                        "…".into()
                    } else {
                        self.draft.1.to_string()
                    }
                ),
                cx,
            ))
            .when(!self.pending && !valid, |panel| {
                panel.child(label("Range exceeds the latest allowed date", cx))
            })
            .child(
                row()
                    .justify_end()
                    .child(
                        control("date-range-cancel", "Cancel", cx).on_click(cx.listener(
                            |this, _, window, cx| {
                                this.close(window, cx);
                                cx.stop_propagation();
                            },
                        )),
                    )
                    .child(apply),
            );
        let anchor = Rc::new(Cell::new(None::<Bounds<Pixels>>));
        let outside_anchor = anchor.clone();
        panel = panel.on_mouse_down_out(cx.listener(
            move |this, event: &MouseDownEvent, window, cx| {
                if !outside_anchor
                    .get()
                    .is_some_and(|bounds| bounds.contains(&event.position))
                {
                    this.close(window, cx);
                }
            },
        ));
        let mut panel = panel.into_any_element();
        let align_right = self.align_right;
        trigger.child(
            canvas(
                move |bounds, window, cx| {
                    anchor.set(Some(bounds));
                    let viewport = window.viewport_size();
                    let measured = panel.layout_as_root(
                        size(
                            AvailableSpace::Definite(px(310.)),
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
                    window.defer_draw(panel, point(x, y), 50);
                },
                |_, _, _, _| {},
            )
            .absolute()
            .top_0()
            .left_0()
            .size_full(),
        )
    }
}

struct DateRangeDemo {
    picker: Entity<DateRangePicker>,
    changes: usize,
    _subscription: Subscription,
}

impl Render for DateRangeDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let selected = self.picker.read(cx).selected;
        stack()
            .child(label("Report period", cx))
            .child(self.picker.clone())
            .child(label(
                format!("Selected: {} – {}", selected.0, selected.1),
                cx,
            ))
            .child(label(format!("Applied ranges: {}", self.changes), cx))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let picker = cx.new(|cx| {
            let mut picker = DateRangePicker::new(cx);
            picker.earliest_date = Some(Local::now().date_naive() - Duration::days(730));
            picker
        });
        let subscription = cx.subscribe(
            &picker,
            |this: &mut DateRangeDemo, _, event: &RangeChanged, cx| {
                let _range = (event.start, event.end);
                this.changes += 1;
                cx.notify();
            },
        );
        DateRangeDemo {
            picker,
            changes: 0,
            _subscription: subscription,
        }
    })
    .into()
}
