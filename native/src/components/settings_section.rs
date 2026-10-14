use crate::components::toggle::Toggle;
use crate::theme::{stack, theme};
use gpui::{prelude::*, *};

/// A settings surface with a divided heading and composable setting rows.
#[derive(IntoElement)]
pub struct SettingsSection {
    title: SharedString,
    description: Option<SharedString>,
    children: Vec<AnyElement>,
}

impl SettingsSection {
    pub fn new(title: impl Into<SharedString>) -> Self {
        Self {
            title: title.into(),
            description: None,
            children: Vec::new(),
        }
    }

    pub fn description(mut self, description: impl Into<SharedString>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn child(mut self, child: impl IntoElement) -> Self {
        self.children.push(child.into_any_element());
        self
    }

    pub fn children(mut self, children: impl IntoIterator<Item = impl IntoElement>) -> Self {
        self.children
            .extend(children.into_iter().map(IntoElement::into_any_element));
        self
    }
}

impl RenderOnce for SettingsSection {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let header = div()
            .flex()
            .flex_col()
            .gap(px(4.))
            .px(px(24.))
            .py(px(20.))
            .border_b_1()
            .border_color(t.border)
            .child(
                div()
                    .text_size(px(15.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(self.title),
            )
            .children(self.description.map(|description| {
                div()
                    .text_size(px(13.))
                    .text_color(t.muted)
                    .child(description)
            }));
        div()
            .w_full()
            .min_w_0()
            .flex()
            .flex_col()
            .rounded(px(8.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .child(header)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap(px(20.))
                    .p(px(24.))
                    .children(self.children),
            )
    }
}

struct SettingsSectionDemo {
    notifications: bool,
    sound: bool,
    focus: [FocusHandle; 2],
}

impl Render for SettingsSectionDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack().child(
            SettingsSection::new("Notifications")
                .description("Applies to this device.")
                .child(
                    Toggle::new("settings-notifications", "Desktop notifications")
                        .checked(self.notifications)
                        .focus_handle(self.focus[0].clone())
                        .on_change(cx.listener(|this, value, _, cx| {
                            this.notifications = *value;
                            cx.notify();
                        })),
                )
                .child(
                    Toggle::new("settings-sound", "Notification sound")
                        .checked(self.sound)
                        .focus_handle(self.focus[1].clone())
                        .on_change(cx.listener(|this, value, _, cx| {
                            this.sound = *value;
                            cx.notify();
                        })),
                ),
        )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| SettingsSectionDemo {
        notifications: true,
        sound: false,
        focus: [
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
        ],
    })
    .into()
}
