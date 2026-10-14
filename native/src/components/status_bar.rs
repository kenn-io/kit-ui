use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// Bottom app bar with equally sized side sections around centered content.
#[derive(IntoElement)]
pub struct StatusBar {
    left: AnyElement,
    center: Option<AnyElement>,
    right: Option<AnyElement>,
    overflow_visible: bool,
}
impl StatusBar {
    pub fn new(left: impl IntoElement) -> Self {
        Self {
            left: left.into_any_element(),
            center: None,
            right: None,
            overflow_visible: false,
        }
    }
    pub fn center(mut self, content: impl IntoElement) -> Self {
        self.center = Some(content.into_any_element());
        self
    }
    pub fn right(mut self, content: impl IntoElement) -> Self {
        self.right = Some(content.into_any_element());
        self
    }
    pub fn overflow_visible(mut self, visible: bool) -> Self {
        self.overflow_visible = visible;
        self
    }
}
impl RenderOnce for StatusBar {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let section = || {
            div()
                .flex()
                .items_center()
                .gap(px(4.))
                .min_w_0()
                .whitespace_nowrap()
                .when(!self.overflow_visible, |s| s.overflow_hidden())
        };
        div()
            .flex()
            .items_center()
            .w_full()
            .h(px(24.))
            .flex_shrink_0()
            .gap(px(12.))
            .px(px(16.))
            .bg(t.surface)
            .border_t_1()
            .border_color(t.border)
            .text_color(t.muted)
            .text_size(px(11.))
            .child(section().flex_1().child(self.left))
            .child(section().flex_shrink_0().children(self.center))
            .child(section().flex_1().justify_end().children(self.right))
    }
}
struct StatusBarDemo;
impl Render for StatusBarDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        stack()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .h(px(240.))
                    .w_full()
                    .border_1()
                    .border_color(t.border)
                    .bg(t.background)
                    .child(div().flex_1().p(px(20.)).child("Workspace"))
                    .child(
                        StatusBar::new(
                            div()
                                .flex()
                                .gap(px(4.))
                                .child("12 PRs")
                                .child("·")
                                .child("8 issues"),
                        )
                        .center("main")
                        .right(
                            div()
                                .flex()
                                .gap(px(4.))
                                .child(div().text_color(t.success).child("Synced"))
                                .child("·")
                                .child("v0.1.0"),
                        ),
                    ),
            )
            .child(label("Long status text stays within its section.", cx))
            .child(
                StatusBar::new("workspace/experiments/native-desktop/component-gallery/long-path")
                    .center("Ready")
                    .right("UTF-8"),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| StatusBarDemo).into()
}
