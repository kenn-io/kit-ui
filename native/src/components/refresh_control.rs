use super::spinner::Spinner;
use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use std::time::{Duration, Instant, SystemTime};

#[derive(Clone, Copy, Debug)]
pub struct RefreshRequested {
    pub automatic: bool,
}

/// A manual refresh button and an automatic cadence, with no initial fetch.
/// The owner handles RefreshRequested and supplies the last successful timestamp.
pub struct RefreshControl {
    pub last_updated_at: Option<SystemTime>,
    pub busy: bool,
    pub label: SharedString,
    pub age_width: Option<f32>,
    interval: Duration,
    next_refresh: Instant,
    timer: Option<Task<()>>,
}
impl EventEmitter<RefreshRequested> for RefreshControl {}
impl RefreshControl {
    pub fn new(cx: &mut Context<Self>) -> Self {
        let interval = Duration::from_secs(5 * 60);
        let timer = cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor().timer(Duration::from_secs(1)).await;
                if this
                    .update(cx, |this, cx| {
                        if Instant::now() >= this.next_refresh {
                            this.refresh(true, cx);
                        }
                        cx.notify();
                    })
                    .is_err()
                {
                    break;
                }
            }
        });
        Self {
            last_updated_at: None,
            busy: false,
            label: "Refresh".into(),
            age_width: None,
            interval,
            next_refresh: Instant::now() + interval,
            timer: Some(timer),
        }
    }
    pub fn set_interval(&mut self, interval: Duration, cx: &mut Context<Self>) {
        self.interval = interval.max(Duration::from_secs(1));
        self.next_refresh = Instant::now() + self.interval;
        cx.notify();
    }
    pub fn refresh_now(&mut self, cx: &mut Context<Self>) {
        self.refresh(false, cx);
    }
    pub fn mark_updated(&mut self, cx: &mut Context<Self>) {
        self.last_updated_at = Some(SystemTime::now());
        self.busy = false;
        cx.notify();
    }
    pub fn set_busy(&mut self, busy: bool, cx: &mut Context<Self>) {
        self.busy = busy;
        cx.notify();
    }
    pub fn stop(&mut self, cx: &mut Context<Self>) {
        self.timer = None;
        cx.notify();
    }
    fn refresh(&mut self, automatic: bool, cx: &mut Context<Self>) {
        self.next_refresh = Instant::now() + self.interval;
        if !self.busy {
            cx.emit(RefreshRequested { automatic });
        }
        cx.notify();
    }
}

pub fn format_refresh_age(last_updated_at: Option<SystemTime>, now: SystemTime) -> String {
    let Some(updated) = last_updated_at else {
        return "—".into();
    };
    let minutes = now.duration_since(updated).unwrap_or_default().as_secs() / 60;
    match minutes {
        0 => "Updated just now".into(),
        1..=59 => format!("Updated {minutes}m ago"),
        60..=1439 => format!("Updated {}h ago", minutes / 60),
        _ => format!("Updated {}d ago", minutes / 1440),
    }
}

impl Render for RefreshControl {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let busy = self.busy;
        row()
            .child(
                div()
                    .id("refresh-control-button")
                    .size(px(28.))
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded(px(4.))
                    .text_color(t.muted)
                    .when(!busy, |button| {
                        button
                            .focusable()
                            .tab_stop(true)
                            .cursor_pointer()
                            .hover(|s| s.bg(t.inset))
                            .focus(|s| s.border_1().border_color(t.accent))
                            .on_click(cx.listener(|this, _, _, cx| this.refresh_now(cx)))
                    })
                    .when(busy, |button| button.opacity(0.75))
                    .child(if busy {
                        Spinner {
                            size: 14.,
                            label: None,
                        }
                        .element("refresh-control-spinner", cx)
                    } else {
                        div().text_size(px(20.)).child("↻").into_any_element()
                    })
                    .tooltip({
                        let text = self.label.clone();
                        move |_, cx| cx.new(|_| RefreshTooltip(text.clone())).into()
                    }),
            )
            .child(
                label(
                    format_refresh_age(self.last_updated_at, SystemTime::now()),
                    cx,
                )
                .when_some(self.age_width, |age, width| age.w(px(width)).truncate())
                .id("refresh-control-age")
                .when_some(self.last_updated_at, |age, updated| {
                    let timestamp: chrono::DateTime<chrono::Local> = updated.into();
                    let text: SharedString =
                        timestamp.format("%Y-%m-%d %H:%M:%S %Z").to_string().into();
                    age.tooltip(move |_, cx| cx.new(|_| RefreshTooltip(text.clone())).into())
                }),
            )
    }
}
struct RefreshTooltip(SharedString);
impl Render for RefreshTooltip {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        div()
            .px(px(8.))
            .py(px(4.))
            .rounded(px(4.))
            .bg(t.surface)
            .border_1()
            .border_color(t.border)
            .child(label(self.0.clone(), cx))
    }
}

struct RefreshDemo {
    control: Entity<RefreshControl>,
    completed: usize,
    last_trigger: &'static str,
    completion: Option<Task<()>>,
}
impl Render for RefreshDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(self.control.clone())
            .child(label(
                format!("Completed refreshes: {}", self.completed),
                cx,
            ))
            .child(label(format!("Last trigger: {}", self.last_trigger), cx))
            .child(label("Auto-refresh every 5 seconds", cx))
            .child(
                control("refresh-age-example", "Show older timestamp", cx).on_click(cx.listener(
                    |this, _, _, cx| {
                        this.control.update(cx, |control, cx| {
                            control.last_updated_at =
                                Some(SystemTime::now() - Duration::from_secs(7 * 60));
                            cx.notify();
                        });
                    },
                )),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let control = cx.new(|cx| {
            let mut control = RefreshControl::new(cx);
            control.set_interval(Duration::from_secs(5), cx);
            control.age_width = Some(145.);
            control
        });
        cx.subscribe(
            &control,
            |this: &mut RefreshDemo, control, event: &RefreshRequested, cx| {
                this.last_trigger = if event.automatic {
                    "Automatic"
                } else {
                    "Manual"
                };
                control.update(cx, |control, cx| control.set_busy(true, cx));
                let timer = cx.background_executor().timer(Duration::from_millis(600));
                this.completion = Some(cx.spawn(async move |this, cx| {
                    timer.await;
                    let _ = this.update(cx, |this, cx| {
                        this.completed += 1;
                        this.control
                            .update(cx, |control, cx| control.mark_updated(cx));
                        cx.notify();
                    });
                }));
                cx.notify();
            },
        )
        .detach();
        RefreshDemo {
            control,
            completed: 0,
            last_trigger: "None",
            completion: None,
        }
    })
    .into()
}
