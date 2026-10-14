use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use std::time::Duration;

#[derive(Clone, Copy, Default, Debug)]
pub enum FlashTone {
    #[default]
    Neutral,
    Info,
    Success,
    Warning,
    Danger,
}

pub struct FlashMessage {
    pub id: u64,
    pub message: SharedString,
    pub tone: FlashTone,
    pub duration: Duration,
    _expiry: Task<()>,
}

/// Transient messages positioned inside a relative parent. Keeps at most five
/// messages; dismissing a message also cancels its expiry task.
pub struct FlashBanner {
    pub top: f32,
    messages: Vec<FlashMessage>,
    next_id: u64,
}
impl Default for FlashBanner {
    fn default() -> Self {
        Self {
            top: 44.,
            messages: Vec::new(),
            next_id: 0,
        }
    }
}
impl FlashBanner {
    pub fn messages(&self) -> &[FlashMessage] {
        &self.messages
    }
    pub fn show(
        &mut self,
        message: impl Into<SharedString>,
        tone: FlashTone,
        duration: Duration,
        cx: &mut Context<Self>,
    ) -> u64 {
        let duration = if duration.is_zero() {
            Duration::from_secs(4)
        } else {
            duration
        };
        self.next_id += 1;
        let id = self.next_id;
        let timer = cx.background_executor().timer(duration);
        let expiry = cx.spawn(async move |this, cx| {
            timer.await;
            let _ = this.update(cx, |this, cx| this.dismiss(id, cx));
        });
        if self.messages.len() == 5 {
            self.messages.remove(0);
        }
        self.messages.push(FlashMessage {
            id,
            message: message.into(),
            tone,
            duration,
            _expiry: expiry,
        });
        cx.notify();
        id
    }
    pub fn dismiss(&mut self, id: u64, cx: &mut Context<Self>) {
        self.messages.retain(|flash| flash.id != id);
        cx.notify();
    }
    pub fn dismiss_all(&mut self, cx: &mut Context<Self>) {
        self.messages.clear();
        cx.notify();
    }
}
impl Render for FlashBanner {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        div()
            .absolute()
            .top(px(self.top))
            .left(px(16.))
            .right(px(16.))
            .flex()
            .justify_center()
            .child(
                div()
                    .id("flash-stack")
                    .w_full()
                    .max_w(px(480.))
                    .max_h(px(260.))
                    .overflow_y_scroll()
                    .rounded(px(6.))
                    .flex()
                    .flex_col()
                    .children(self.messages.iter().map(|flash| {
                        let (accent, prefix) = match flash.tone {
                            FlashTone::Neutral => (t.accent, ""),
                            FlashTone::Info => (t.accent, "Info: "),
                            FlashTone::Success => (t.success, "Success: "),
                            FlashTone::Warning => (t.warning, "Warning: "),
                            FlashTone::Danger => (t.danger, "Error: "),
                        };
                        let id = flash.id;
                        div()
                            .id(("flash-message", id))
                            .relative()
                            .flex()
                            .items_center()
                            .gap(px(10.))
                            .px(px(16.))
                            .py(px(8.))
                            .border_1()
                            .border_color(t.border.blend(accent.opacity(0.3)))
                            .bg(t.surface.blend(accent.opacity(0.08)))
                            .text_color(t.text)
                            .text_size(px(13.))
                            .child(
                                div()
                                    .flex_1()
                                    .min_w_0()
                                    .child(format!("{prefix}{}", flash.message)),
                            )
                            .child(
                                control(("flash-dismiss", id), "×", cx).on_click(cx.listener(
                                    move |this, _, _, cx| {
                                        this.dismiss(id, cx);
                                    },
                                )),
                            )
                            .child(
                                div()
                                    .absolute()
                                    .left_0()
                                    .bottom_0()
                                    .h(px(2.))
                                    .bg(accent)
                                    .with_animation(
                                        ("flash-countdown", id),
                                        Animation::new(flash.duration),
                                        |bar, progress| bar.w(relative(1. - progress)),
                                    ),
                            )
                    })),
            )
    }
}

struct FlashDemo {
    banner: Entity<FlashBanner>,
    sent: usize,
}
impl Render for FlashDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut actions = row();
        for (index, (title, message, tone)) in [
            ("Save", "Changes saved", FlashTone::Success),
            ("Info", "A new version is available", FlashTone::Info),
            ("Warning", "Connection is unstable", FlashTone::Warning),
            ("Error", "The upload failed", FlashTone::Danger),
            ("Neutral", "Workspace updated", FlashTone::Neutral),
        ]
        .into_iter()
        .enumerate()
        {
            actions = actions.child(control(("flash-send", index), title, cx).on_click(
                cx.listener(move |this, _, _, cx| {
                    this.banner.update(cx, |banner, cx| {
                        banner.show(message, tone, Duration::from_secs(4), cx);
                    });
                    this.sent += 1;
                    cx.notify();
                }),
            ));
        }
        stack()
            .child(actions)
            .child(label(format!("Messages sent: {}", self.sent), cx))
            .child(
                div()
                    .relative()
                    .h(px(310.))
                    .w_full()
                    .rounded(px(6.))
                    .bg(t.inset)
                    .border_1()
                    .border_color(t.border)
                    .child(self.banner.clone()),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| FlashDemo {
        banner: cx.new(|_| FlashBanner {
            top: 12.,
            ..Default::default()
        }),
        sent: 0,
    })
    .into()
}
