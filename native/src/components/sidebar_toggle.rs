use std::rc::Rc;

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum SidebarToggleState {
    #[default]
    Expanded,
    Collapsed,
}

#[derive(IntoElement)]
pub struct SidebarToggle {
    id: ElementId,
    state: SidebarToggleState,
    label: SharedString,
    compact: bool,
    on_click: Option<Rc<dyn Fn(&ClickEvent, &mut Window, &mut App)>>,
}
impl SidebarToggle {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            state: SidebarToggleState::Expanded,
            label: "sidebar".into(),
            compact: false,
            on_click: None,
        }
    }
    pub fn state(mut self, value: SidebarToggleState) -> Self {
        self.state = value;
        self
    }
    pub fn label(mut self, value: impl Into<SharedString>) -> Self {
        self.label = value.into();
        self
    }
    pub fn compact(mut self, value: bool) -> Self {
        self.compact = value;
        self
    }
    pub fn on_click(
        mut self,
        callback: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(callback));
        self
    }
}
struct ToggleTooltip(SharedString);
impl Render for ToggleTooltip {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        div()
            .px(px(8.))
            .py(px(4.))
            .rounded(px(4.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .text_size(px(12.))
            .child(self.0.clone())
    }
}
impl RenderOnce for SidebarToggle {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let collapsed = self.state == SidebarToggleState::Collapsed;
        let tooltip: SharedString = format!(
            "{} {}",
            if collapsed { "Expand" } else { "Collapse" },
            self.label
        )
        .into();
        let mut element = div()
            .id(self.id)
            .focusable()
            .tab_stop(true)
            .flex()
            .items_center()
            .justify_center()
            .size(px(if self.compact { 22. } else { 26. }))
            .flex_shrink_0()
            .rounded(px(4.))
            .text_color(t.muted)
            .cursor_pointer()
            .hover(move |s| s.bg(t.inset).text_color(t.text))
            .focus(move |s| s.border_1().border_color(t.accent))
            .tooltip(move |_, cx| cx.new(|_| ToggleTooltip(tooltip.clone())).into())
            .child(
                svg()
                    .path(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/icons/panel-left.svg"
                    ))
                    .size(px(14.))
                    .text_color(t.muted),
            )
            .child(
                div()
                    .text_size(px(10.))
                    .child(if collapsed { "›" } else { "‹" }),
            );
        if let Some(callback) = self.on_click {
            element = element.on_click(move |event, window, cx| callback(event, window, cx));
        }
        element
    }
}

struct SidebarToggleDemo {
    expanded: bool,
}
impl Render for SidebarToggleDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let state = if self.expanded {
            SidebarToggleState::Expanded
        } else {
            SidebarToggleState::Collapsed
        };
        stack()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .border_1()
                    .border_color(t.border)
                    .rounded(px(6.))
                    .overflow_hidden()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap(px(8.))
                            .p(px(8.))
                            .bg(t.surface)
                            .border_b_1()
                            .border_color(t.border)
                            .child(SidebarToggle::new("sidebar-toggle").state(state).on_click(
                                cx.listener(|this, _, _, cx| {
                                    this.expanded = !this.expanded;
                                    cx.notify();
                                }),
                            ))
                            .child("Workspace"),
                    )
                    .child(
                        div()
                            .flex()
                            .h(px(220.))
                            .when(self.expanded, |s| {
                                s.child(
                                    div()
                                        .w(px(160.))
                                        .flex_shrink_0()
                                        .p(px(16.))
                                        .bg(t.inset)
                                        .border_r_1()
                                        .border_color(t.border)
                                        .flex()
                                        .flex_col()
                                        .gap(px(12.))
                                        .child("Projects")
                                        .child("Activity")
                                        .child("Settings"),
                                )
                            })
                            .child(div().flex_1().p(px(24.)).child("Project overview")),
                    ),
            )
            .child(label(
                if self.expanded {
                    "Sidebar expanded"
                } else {
                    "Sidebar collapsed"
                },
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| SidebarToggleDemo { expanded: true }).into()
}
