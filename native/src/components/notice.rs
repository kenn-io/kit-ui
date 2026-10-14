use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum NoticeTone {
    #[default]
    Info,
    Success,
    Warning,
    Error,
}

/// Persistent inline status with an optional recovery action.
#[derive(IntoElement)]
pub struct Notice {
    id: ElementId,
    tone: NoticeTone,
    tone_label: Option<SharedString>,
    title: Option<SharedString>,
    message: SharedString,
    action: Option<(
        SharedString,
        Box<dyn Fn(&ClickEvent, &mut Window, &mut App)>,
    )>,
}
impl Notice {
    pub fn new(id: impl Into<ElementId>, message: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            tone: NoticeTone::Info,
            tone_label: None,
            title: None,
            message: message.into(),
            action: None,
        }
    }
    pub fn tone(mut self, tone: NoticeTone) -> Self {
        self.tone = tone;
        self
    }
    pub fn tone_label(mut self, label: impl Into<SharedString>) -> Self {
        self.tone_label = Some(label.into());
        self
    }
    pub fn title(mut self, title: impl Into<SharedString>) -> Self {
        self.title = Some(title.into());
        self
    }
    pub fn action(
        mut self,
        label: impl Into<SharedString>,
        callback: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.action = Some((label.into(), Box::new(callback)));
        self
    }
}
impl RenderOnce for Notice {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let (accent, default_label) = match self.tone {
            NoticeTone::Info => (t.accent, "Info"),
            NoticeTone::Success => (t.success, "Success"),
            NoticeTone::Warning => (t.warning, "Warning"),
            NoticeTone::Error => (t.danger, "Error"),
        };
        let tone_label = self
            .tone_label
            .filter(|label| !label.trim().is_empty())
            .unwrap_or_else(|| default_label.into());
        let mut content = div()
            .flex()
            .flex_col()
            .flex_1()
            .min_w_0()
            .gap(px(4.))
            .child(
                div()
                    .text_size(px(11.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(t.muted)
                    .child(tone_label),
            );
        if let Some(title) = self.title {
            content = content.child(
                div()
                    .text_size(px(14.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(title),
            );
        }
        content = content.child(
            div()
                .text_size(px(13.))
                .text_color(t.muted)
                .child(self.message),
        );
        let mut notice = div()
            .id(self.id)
            .w_full()
            .flex()
            .items_start()
            .gap(px(16.))
            .p(px(20.))
            .rounded(px(6.))
            .border_1()
            .border_color(t.border.blend(accent.opacity(0.32)))
            .bg(t.surface.blend(accent.opacity(0.08)))
            .text_color(t.text)
            .child(
                div()
                    .mt(px(3.))
                    .p(px(3.))
                    .rounded_full()
                    .bg(accent.opacity(0.16))
                    .flex_shrink_0()
                    .child(div().size(px(8.)).rounded_full().bg(accent)),
            )
            .child(content);
        if let Some((label, callback)) = self.action {
            notice = notice.child(
                div()
                    .id("notice-action")
                    .focusable()
                    .tab_stop(true)
                    .flex_shrink_0()
                    .px(px(12.))
                    .py(px(6.))
                    .rounded(px(4.))
                    .border_1()
                    .border_color(gpui::transparent_black())
                    .text_size(px(13.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .cursor_pointer()
                    .hover(|s| s.bg(accent.opacity(0.1)))
                    .focus(|s| s.border_color(accent))
                    .on_click(callback)
                    .child(label),
            );
        }
        notice
    }
}

struct NoticeDemo {
    retries: usize,
}
impl Render for NoticeDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                Notice::new("notice-info", "Your changes are saved locally.").title("Offline mode"),
            )
            .child(
                Notice::new("notice-success", "The workspace is ready.")
                    .tone(NoticeTone::Success)
                    .title("Workspace created"),
            )
            .child(
                Notice::new("notice-warning", "Check your connection, then try again.")
                    .tone(NoticeTone::Warning)
                    .title("Session paused")
                    .action(
                        "Try again",
                        cx.listener(|this, _, _, cx| {
                            this.retries += 1;
                            cx.notify();
                        }),
                    ),
            )
            .child(label(format!("Retry attempts: {}", self.retries), cx))
            .child(
                Notice::new("notice-error", "The server could not save this file.")
                    .tone(NoticeTone::Error)
                    .tone_label("Connection error")
                    .title("Save failed"),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| NoticeDemo { retries: 0 }).into()
}
