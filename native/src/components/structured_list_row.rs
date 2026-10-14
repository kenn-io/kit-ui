use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A record with four content slots and an optional controlled disclosure.
#[derive(IntoElement)]
pub struct StructuredListRow {
    id: ElementId,
    primary: AnyElement,
    secondary: Option<AnyElement>,
    description: Option<AnyElement>,
    status: Option<AnyElement>,
    detail: Option<AnyElement>,
    expanded: bool,
    compact: bool,
    on_toggle: Option<Box<dyn Fn(&bool, &mut Window, &mut App)>>,
}
impl StructuredListRow {
    pub fn new(id: impl Into<ElementId>, primary: impl IntoElement) -> Self {
        Self {
            id: id.into(),
            primary: primary.into_any_element(),
            secondary: None,
            description: None,
            status: None,
            detail: None,
            expanded: false,
            compact: false,
            on_toggle: None,
        }
    }
    pub fn secondary(mut self, content: impl IntoElement) -> Self {
        self.secondary = Some(content.into_any_element());
        self
    }
    pub fn description(mut self, content: impl IntoElement) -> Self {
        self.description = Some(content.into_any_element());
        self
    }
    pub fn status(mut self, content: impl IntoElement) -> Self {
        self.status = Some(content.into_any_element());
        self
    }
    pub fn detail(mut self, content: impl IntoElement) -> Self {
        self.detail = Some(content.into_any_element());
        self
    }
    pub fn expanded(mut self, expanded: bool) -> Self {
        self.expanded = expanded;
        self
    }
    /// Stack secondary and description content beneath the primary/status line.
    pub fn compact(mut self, compact: bool) -> Self {
        self.compact = compact;
        self
    }
    pub fn on_toggle(mut self, callback: impl Fn(&bool, &mut Window, &mut App) + 'static) -> Self {
        self.on_toggle = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for StructuredListRow {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let expandable = self.detail.is_some();
        let chevron = if expandable {
            if self.expanded { "⌄" } else { "›" }
        } else {
            ""
        };
        let mut summary = div()
            .id(self.id)
            .flex()
            .items_center()
            .min_h(px(40.))
            .min_w_0()
            .gap(px(16.))
            .px(px(20.))
            .py(px(10.))
            .text_size(px(13.))
            .text_color(t.muted);
        let primary = div()
            .min_w_0()
            .flex_1()
            .text_ellipsis()
            .text_color(t.text)
            .font_weight(FontWeight::SEMIBOLD)
            .child(self.primary);
        let indicator = div().w(px(15.)).flex_shrink_0().child(chevron);
        if self.compact {
            let mut line = div()
                .flex()
                .items_center()
                .gap(px(12.))
                .w_full()
                .child(indicator)
                .child(primary);
            if let Some(status) = self.status {
                line = line.child(div().flex_shrink_0().child(status));
            }
            summary = summary.flex_col().items_start().gap(px(8.)).child(line);
            if let Some(secondary) = self.secondary {
                summary = summary.child(div().pl(px(27.)).child(secondary));
            }
            if let Some(description) = self.description {
                summary = summary.child(div().pl(px(27.)).child(description));
            }
        } else {
            summary = summary
                .child(indicator)
                .child(div().flex_1().min_w_0().child(primary))
                .child(
                    div()
                        .flex_1()
                        .min_w_0()
                        .text_ellipsis()
                        .children(self.secondary),
                )
                .child(
                    div()
                        .flex_1()
                        .min_w_0()
                        .text_ellipsis()
                        .children(self.description),
                )
                .child(
                    div()
                        .w(px(100.))
                        .flex_shrink_0()
                        .flex()
                        .justify_end()
                        .children(self.status),
                );
        }
        if expandable {
            summary = summary
                .focusable()
                .tab_stop(true)
                .cursor_pointer()
                .hover(move |s| s.bg(t.inset))
                .focus(move |s| s.bg(t.inset).border_1().border_color(t.accent));
            if let Some(on_toggle) = self.on_toggle {
                let next = !self.expanded;
                summary = summary.on_click(move |_, window, cx| on_toggle(&next, window, cx));
            }
        }
        let mut row = div()
            .w_full()
            .min_w_0()
            .border_b_1()
            .border_color(t.border)
            .child(summary);
        if self.expanded {
            if let Some(detail) = self.detail {
                row = row.child(
                    div()
                        .border_t_1()
                        .border_color(t.border)
                        .bg(t.inset)
                        .pl(px(if self.compact { 20. } else { 51. }))
                        .pr(px(20.))
                        .py(px(16.))
                        .text_size(px(13.))
                        .text_color(t.muted)
                        .child(detail),
                );
            }
        }
        row
    }
}
struct RowDemo {
    expanded: bool,
}
impl Render for RowDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        stack()
            .child(
                div()
                    .rounded(px(8.))
                    .border_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .overflow_hidden()
                    .child(
                        StructuredListRow::new("registry-row", "Package registry")
                            .secondary("example-project")
                            .description("1.4.2 is current")
                            .status(div().text_color(t.success).child("Current"))
                            .detail("Last checked 2 minutes ago. The package is available for installation.")
                            .expanded(self.expanded)
                            .on_toggle(cx.listener(|this, expanded, _, cx| {
                                this.expanded = *expanded;
                                cx.notify();
                            })),
                    )
                    .child(
                        StructuredListRow::new("static-row", "Desktop app")
                            .secondary("macOS")
                            .description("Build ready")
                            .status(div().text_color(t.accent).child("Ready")),
                    ),
            )
            .child(label(if self.expanded { "Package details open" } else { "Package details closed" }, cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| RowDemo { expanded: false }).into()
}
