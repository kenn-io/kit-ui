use crate::components::{button::Button, settings_section::SettingsSection, toggle::Toggle};
use crate::theme::{stack, theme};
use gpui::{prelude::*, *};
use std::rc::Rc;

#[derive(Clone)]
pub struct SettingsCategory {
    pub id: SharedString,
    pub label: SharedString,
    pub group: Option<SharedString>,
    pub summary: Option<SharedString>,
}
impl SettingsCategory {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            group: None,
            summary: None,
        }
    }
    pub fn group(mut self, group: impl Into<SharedString>) -> Self {
        self.group = Some(group.into());
        self
    }
    pub fn summary(mut self, summary: impl Into<SharedString>) -> Self {
        self.summary = Some(summary.into());
        self
    }
}

/// Category navigation with a scrollable panel and pinned actions.
/// The host supplies the active category's content and handles selection.
#[derive(IntoElement)]
pub struct SettingsLayout {
    id: ElementId,
    categories: Vec<SettingsCategory>,
    active: SharedString,
    title: SharedString,
    header: Option<AnyElement>,
    footer: Option<AnyElement>,
    panel: Vec<AnyElement>,
    on_select: Option<Rc<dyn Fn(&SharedString, &mut Window, &mut App)>>,
}
impl SettingsLayout {
    pub fn new(id: impl Into<ElementId>, categories: Vec<SettingsCategory>) -> Self {
        let active = categories.first().map(|c| c.id.clone()).unwrap_or_default();
        Self {
            id: id.into(),
            categories,
            active,
            title: "Settings".into(),
            header: None,
            footer: None,
            panel: Vec::new(),
            on_select: None,
        }
    }
    pub fn active(mut self, active: impl Into<SharedString>) -> Self {
        self.active = active.into();
        self
    }
    pub fn title(mut self, title: impl Into<SharedString>) -> Self {
        self.title = title.into();
        self
    }
    pub fn sidebar_header(mut self, header: impl IntoElement) -> Self {
        self.header = Some(header.into_any_element());
        self
    }
    pub fn footer(mut self, footer: impl IntoElement) -> Self {
        self.footer = Some(footer.into_any_element());
        self
    }
    pub fn child(mut self, child: impl IntoElement) -> Self {
        self.panel.push(child.into_any_element());
        self
    }
    pub fn resolved_active(&self) -> SharedString {
        self.categories
            .iter()
            .find(|c| c.id == self.active)
            .or(self.categories.first())
            .map(|c| c.id.clone())
            .unwrap_or_default()
    }
    pub fn on_select(
        mut self,
        callback: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_select = Some(Rc::new(callback));
        self
    }
}
impl RenderOnce for SettingsLayout {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let compact = window.viewport_size().width <= px(760.);
        let active = self.resolved_active();
        let mut navigation = div().flex().gap(px(4.)).when(!compact, |s| s.flex_col());
        let mut previous_group: Option<SharedString> = None;
        for category in self.categories {
            if !compact && category.group != previous_group {
                if let Some(group) = category.group.clone() {
                    navigation = navigation.child(
                        div()
                            .px(px(12.))
                            .pt(px(12.))
                            .text_size(px(10.))
                            .text_color(t.muted)
                            .child(group),
                    );
                }
            }
            previous_group = category.group.clone();
            let selected = category.id == active;
            let callback = self.on_select.clone();
            let id = category.id;
            navigation = navigation.child(
                div()
                    .id(id.clone())
                    .flex()
                    .flex_col()
                    .gap(px(4.))
                    .px(px(12.))
                    .py(px(8.))
                    .rounded(px(6.))
                    .text_size(px(13.))
                    .text_color(if selected { t.accent } else { t.text })
                    .when(selected, |s| s.bg(t.inset))
                    .cursor_pointer()
                    .focusable()
                    .tab_stop(true)
                    .focus(|s| s.border_1().border_color(t.accent))
                    .hover(|s| s.bg(t.inset))
                    .child(category.label)
                    .when(!compact, |s| {
                        s.children(category.summary.map(|summary| {
                            div().text_size(px(11.)).text_color(t.muted).child(summary)
                        }))
                    })
                    .on_click(move |_, window, cx| {
                        if let Some(callback) = &callback {
                            callback(&id, window, cx);
                        }
                    }),
            );
        }
        let sidebar = div()
            .id("settings-sidebar")
            .flex()
            .gap(px(16.))
            .p(px(16.))
            .bg(t.surface)
            .border_color(t.border)
            .when(compact, |s| {
                s.w_full().items_center().border_b_1().overflow_x_scroll()
            })
            .when(!compact, |s| {
                s.flex_col()
                    .w(px(200.))
                    .flex_shrink_0()
                    .border_r_1()
                    .overflow_y_scroll()
            })
            .when(!self.title.is_empty(), |s| {
                s.child(
                    div()
                        .text_size(px(16.))
                        .font_weight(FontWeight::SEMIBOLD)
                        .child(self.title),
                )
            })
            .children(self.header)
            .child(navigation);
        div()
            .id(self.id)
            .flex()
            .w_full()
            .h_full()
            .min_h_0()
            .min_w_0()
            .bg(t.background)
            .text_color(t.text)
            .when(compact, |s| s.flex_col())
            .child(sidebar)
            .child(
                div()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .min_w_0()
                    .min_h_0()
                    .child(
                        div()
                            .id("settings-panel-scroll")
                            .flex_1()
                            .min_h_0()
                            .overflow_y_scroll()
                            .child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .gap(px(24.))
                                    .max_w(px(760.))
                                    .mx_auto()
                                    .p(px(24.))
                                    .children(self.panel),
                            ),
                    )
                    .children(self.footer.map(|footer| {
                        div()
                            .flex()
                            .justify_end()
                            .gap(px(12.))
                            .p(px(16.))
                            .border_t_1()
                            .border_color(t.border)
                            .bg(t.surface)
                            .child(footer)
                    })),
            )
    }
}

struct SettingsLayoutDemo {
    active: SharedString,
    notifications: bool,
    sound: bool,
    saved: bool,
    focus: [FocusHandle; 2],
}
impl Render for SettingsLayoutDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let panel = match self.active.as_ref() {
            "notifications" => SettingsSection::new("Notifications")
                .description("Applies to this device.")
                .child(
                    Toggle::new("layout-notifications", "Desktop notifications")
                        .checked(self.notifications)
                        .focus_handle(self.focus[0].clone())
                        .on_change(cx.listener(|this, value, _, cx| {
                            this.notifications = *value;
                            this.saved = false;
                            cx.notify();
                        })),
                )
                .child(
                    Toggle::new("layout-sound", "Notification sound")
                        .checked(self.sound)
                        .focus_handle(self.focus[1].clone())
                        .on_change(cx.listener(|this, value, _, cx| {
                            this.sound = *value;
                            this.saved = false;
                            cx.notify();
                        })),
                ),
            "shortcuts" => SettingsSection::new("Keyboard shortcuts")
                .child(div().child("Search: ⌘F · Theme: ⌘D · Reset: ⌘R")),
            _ => SettingsSection::new("Account")
                .child(div().child("Local workspace"))
                .child(
                    div()
                        .text_color(t.muted)
                        .child("Settings are saved for this session."),
                ),
        };
        stack().h(px(420.)).child(
            SettingsLayout::new(
                "settings-layout-demo",
                vec![
                    SettingsCategory::new("account", "Account")
                        .group("Workspace")
                        .summary("Profile and workspace"),
                    SettingsCategory::new("notifications", "Notifications")
                        .group("Preferences")
                        .summary("Desktop alerts and sound"),
                    SettingsCategory::new("shortcuts", "Keyboard shortcuts").group("Preferences"),
                ],
            )
            .active(self.active.clone())
            .on_select(cx.listener(|this, id: &SharedString, _, cx| {
                this.active = id.clone();
                cx.notify();
            }))
            .child(panel)
            .footer(
                div()
                    .flex()
                    .items_center()
                    .gap(px(12.))
                    .child(if self.saved { "Saved" } else { "" })
                    .child(
                        Button::new("settings-save", "Save changes").on_click(cx.listener(
                            |this, _, _, cx| {
                                this.saved = true;
                                cx.notify();
                            },
                        )),
                    ),
            ),
        )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| SettingsLayoutDemo {
        active: "notifications".into(),
        notifications: true,
        sound: false,
        saved: false,
        focus: [
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
        ],
    })
    .into()
}
