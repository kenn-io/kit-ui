use crate::theme::{control, label, row, stack, theme};
use chrono::{Datelike, Duration, Local, NaiveDate};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Debug)]
pub struct CalendarChanged {
    pub date: NaiveDate,
}

#[derive(Clone, Copy, PartialEq)]
enum View {
    Days,
    Months,
    Years,
}

/// Monday-first calendar. Consumers subscribe to CalendarChanged and can set an
/// inclusive range after each pick, or use the built-in single-date selection.
pub struct Calendar {
    pub selected: Option<NaiveDate>,
    pub range: Option<(NaiveDate, NaiveDate)>,
    pub max_date: Option<NaiveDate>,
    month: NaiveDate,
    zoom_year: i32,
    view: View,
}

impl EventEmitter<CalendarChanged> for Calendar {}

impl Calendar {
    pub fn new(_cx: &mut Context<Self>) -> Self {
        let today = Local::now().date_naive();
        Self {
            selected: None,
            range: None,
            max_date: None,
            month: today.with_day(1).unwrap(),
            zoom_year: today.year(),
            view: View::Days,
        }
    }

    pub fn set_date(&mut self, date: NaiveDate, cx: &mut Context<Self>) {
        self.selected = Some(date);
        self.range = None;
        self.month = date.with_day(1).unwrap();
        self.view = View::Days;
        cx.notify();
    }

    pub fn set_range(&mut self, from: NaiveDate, to: NaiveDate, cx: &mut Context<Self>) {
        self.range = Some((from.min(to), from.max(to)));
        cx.notify();
    }

    fn step(&mut self, delta: i32, cx: &mut Context<Self>) {
        match self.view {
            View::Days => {
                let index = self.month.year() * 12 + self.month.month0() as i32 + delta;
                if let Some(month) = NaiveDate::from_ymd_opt(
                    index.div_euclid(12),
                    index.rem_euclid(12) as u32 + 1,
                    1,
                ) {
                    self.month = month;
                }
            }
            View::Months => self.zoom_year += delta,
            View::Years => self.zoom_year += delta * 12,
        }
        cx.notify();
    }

    fn next_disabled(&self) -> bool {
        let Some(max) = self.max_date else {
            return false;
        };
        match self.view {
            View::Days => {
                let next = self.month + Duration::days(32);
                next.with_day(1).unwrap() > max
            }
            View::Months => self.zoom_year + 1 > max.year(),
            View::Years => self.zoom_year.div_euclid(12) * 12 + 12 > max.year(),
        }
    }

    fn pick(&mut self, date: NaiveDate, cx: &mut Context<Self>) {
        if self.max_date.is_some_and(|max| date > max) {
            return;
        }
        self.selected = Some(date);
        cx.emit(CalendarChanged { date });
        cx.notify();
    }
}

impl Render for Calendar {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let header = match self.view {
            View::Days => self.month.format("%B %Y").to_string(),
            View::Months => self.zoom_year.to_string(),
            View::Years => {
                let start = self.zoom_year.div_euclid(12) * 12;
                format!("{}–{}", start, start + 11)
            }
        };
        let title = control("calendar-title", header, cx).flex_1();
        let title = if self.view == View::Years {
            title
        } else {
            title.on_click(cx.listener(|this, _, _, cx| {
                if this.view == View::Days {
                    this.zoom_year = this.month.year();
                    this.view = View::Months;
                } else {
                    this.view = View::Years;
                }
                cx.notify();
            }))
        };
        let next = control("calendar-next", "›", cx);
        let next = if self.next_disabled() {
            next.opacity(0.35).tab_stop(false).cursor_default()
        } else {
            next.on_click(cx.listener(|this, _, _, cx| this.step(1, cx)))
        };
        let mut body = div().flex().flex_col().gap(px(2.));
        if self.view == View::Days {
            body = body.child(
                row().gap_0().children(
                    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                        .into_iter()
                        .map(|day| {
                            div()
                                .w(px(36.))
                                .text_center()
                                .text_size(px(10.))
                                .text_color(t.muted)
                                .child(day)
                        }),
                ),
            );
            let first =
                self.month - Duration::days(self.month.weekday().num_days_from_monday() as i64);
            let today = Local::now().date_naive();
            for week in 0..6 {
                let mut cells = row().gap_0();
                for weekday in 0..7 {
                    let date = first + Duration::days(week * 7 + weekday);
                    let disabled = self.max_date.is_some_and(|max| date > max);
                    let selected = self
                        .range
                        .map_or(self.selected == Some(date), |(from, to)| {
                            date >= from && date <= to
                        });
                    let endpoint = self
                        .range
                        .map_or(selected, |(from, to)| date == from || date == to);
                    let mut cell = div()
                        .id(("calendar-day", (week * 7 + weekday) as usize))
                        .w(px(36.))
                        .h(px(32.))
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(px(4.))
                        .text_size(px(12.))
                        .text_color(if selected {
                            if endpoint { t.on_accent } else { t.accent }
                        } else if date.month() == self.month.month() {
                            t.text
                        } else {
                            t.muted
                        })
                        .when(selected, |cell| {
                            cell.bg(if endpoint { t.accent } else { t.inset })
                        })
                        .when(date == today, |cell| cell.border_1().border_color(t.border))
                        .child(date.day().to_string());
                    if disabled {
                        cell = cell.opacity(0.35);
                    } else {
                        cell = cell
                            .focusable()
                            .tab_stop(true)
                            .cursor_pointer()
                            .focus(|s| s.border_1().border_color(t.accent))
                            .hover(|s| s.bg(if endpoint { t.accent } else { t.inset }))
                            .on_click(cx.listener(move |this, _, _, cx| this.pick(date, cx)));
                    }
                    cells = cells.child(cell);
                }
                body = body.child(cells);
            }
        } else {
            let start = self.zoom_year.div_euclid(12) * 12;
            for unit_row in 0..4 {
                let mut cells = row().gap(px(2.));
                for col in 0..3 {
                    let index = unit_row * 3 + col;
                    let (value, text, disabled) = if self.view == View::Months {
                        let month = NaiveDate::from_ymd_opt(self.zoom_year, index + 1, 1).unwrap();
                        (
                            index as i32 + 1,
                            month.format("%b").to_string(),
                            self.max_date.is_some_and(|max| month > max),
                        )
                    } else {
                        let year = start + index as i32;
                        (
                            year,
                            year.to_string(),
                            self.max_date.is_some_and(|max| year > max.year()),
                        )
                    };
                    let cell = control(("calendar-unit", index as usize), text, cx)
                        .w(px(82.))
                        .h(px(42.));
                    cells = cells.child(if disabled {
                        cell.opacity(0.35).tab_stop(false).cursor_default()
                    } else {
                        cell.on_click(cx.listener(move |this, _, _, cx| {
                            if this.view == View::Months {
                                if let Some(month) =
                                    NaiveDate::from_ymd_opt(this.zoom_year, value as u32, 1)
                                {
                                    this.month = month;
                                    this.view = View::Days;
                                }
                            } else {
                                this.zoom_year = value;
                                this.view = View::Months;
                            }
                            cx.notify();
                        }))
                    });
                }
                body = body.child(cells);
            }
        }
        stack()
            .w(px(252.))
            .gap(px(8.))
            .child(
                row()
                    .flex_nowrap()
                    .child(
                        control("calendar-prev", "‹", cx)
                            .on_click(cx.listener(|this, _, _, cx| this.step(-1, cx))),
                    )
                    .child(title)
                    .child(next),
            )
            .child(body)
    }
}

struct CalendarDemo {
    calendar: Entity<Calendar>,
    selected: Option<NaiveDate>,
    _subscription: Subscription,
}

impl Render for CalendarDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack().child(self.calendar.clone()).child(label(
            self.selected.map_or("Choose a date".into(), |date| {
                format!("Selected: {}", date.format("%B %-d, %Y"))
            }),
            cx,
        ))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let calendar = cx.new(Calendar::new);
        let subscription = cx.subscribe(
            &calendar,
            |this: &mut CalendarDemo, _, event: &CalendarChanged, cx| {
                this.selected = Some(event.date);
                cx.notify();
            },
        );
        CalendarDemo {
            calendar,
            selected: None,
            _subscription: subscription,
        }
    })
    .into()
}
