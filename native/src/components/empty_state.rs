use crate::components::button::{Button, ButtonSurface, ButtonTone};
use crate::theme::{stack, theme};
use gpui::{prelude::*, *};

/// Centered empty content with an optional icon, description, and actions.
#[derive(IntoElement)]
pub struct EmptyState {
    title: SharedString,
    description: Option<SharedString>,
    icon: Option<AnyElement>,
    actions: Vec<AnyElement>,
}

impl EmptyState {
    pub fn new(title: impl Into<SharedString>) -> Self {
        Self {
            title: title.into(),
            description: None,
            icon: None,
            actions: Vec::new(),
        }
    }
    pub fn description(mut self, description: impl Into<SharedString>) -> Self {
        self.description = Some(description.into());
        self
    }
    pub fn icon(mut self, icon: impl IntoElement) -> Self {
        self.icon = Some(icon.into_any_element());
        self
    }
    pub fn child(mut self, action: impl IntoElement) -> Self {
        self.actions.push(action.into_any_element());
        self
    }
}

impl RenderOnce for EmptyState {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut element = div()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .w_full()
            .gap(px(8.))
            .px(px(24.))
            .py(px(32.))
            .text_center();
        if let Some(icon) = self.icon {
            element = element.child(div().flex().mb(px(8.)).text_color(t.muted).child(icon));
        }
        element = element.child(
            div()
                .text_color(t.text)
                .text_size(px(14.))
                .font_weight(FontWeight::SEMIBOLD)
                .child(self.title),
        );
        if let Some(description) = self.description {
            element = element.child(
                div()
                    .max_w(px(380.))
                    .text_color(t.muted)
                    .text_size(px(13.))
                    .child(description),
            );
        }
        if !self.actions.is_empty() {
            element = element.child(
                div()
                    .flex()
                    .flex_wrap()
                    .justify_center()
                    .gap(px(16.))
                    .mt(px(16.))
                    .children(self.actions),
            );
        }
        element
    }
}

struct EmptyStateDemo {
    populated: bool,
}
impl Render for EmptyStateDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let content = if self.populated {
            stack()
                .child(div().font_weight(FontWeight::SEMIBOLD).child("Workspaces"))
                .child(
                    div()
                        .p(px(16.))
                        .border_1()
                        .border_color(t.border)
                        .rounded(px(8.))
                        .child("Desktop preview"),
                )
                .child(
                    Button::new("empty-state-clear", "Remove workspace").on_click(cx.listener(
                        |this, _, _, cx| {
                            this.populated = false;
                            cx.notify();
                        },
                    )),
                )
                .into_any_element()
        } else {
            EmptyState::new("No workspaces yet")
                .description("Create a workspace to organize your projects.")
                .icon(
                    svg()
                        .path(concat!(
                            env!("CARGO_MANIFEST_DIR"),
                            "/assets/icons/panel-left.svg"
                        ))
                        .size(px(32.))
                        .text_color(t.muted),
                )
                .child(
                    Button::new("empty-state-create", "Create workspace")
                        .tone(ButtonTone::Info)
                        .surface(ButtonSurface::Solid)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.populated = true;
                            cx.notify();
                        })),
                )
                .into_any_element()
        };
        stack().child(content).child(
            div()
                .border_t_1()
                .border_color(t.border)
                .child(EmptyState::new("No results").description("Try another search.")),
        )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| EmptyStateDemo { populated: false }).into()
}
