use crate::components::{card::CardLevel, structured_list_row::StructuredListRow};
use crate::theme::{control, row, stack, theme};
use gpui::{prelude::*, *};

/// Comparable records with column labels aligned to StructuredListRow.
#[derive(IntoElement)]
pub struct StructuredList {
    id: ElementId,
    primary_label: SharedString,
    secondary_label: SharedString,
    description_label: SharedString,
    status_label: SharedString,
    level: CardLevel,
    compact: bool,
    rows: Vec<StructuredListRow>,
    empty: SharedString,
}
impl StructuredList {
    pub fn new(id: impl Into<ElementId>, primary_label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            primary_label: primary_label.into(),
            secondary_label: "".into(),
            description_label: "".into(),
            status_label: "".into(),
            level: CardLevel::Default,
            compact: false,
            rows: Vec::new(),
            empty: "No records".into(),
        }
    }
    pub fn secondary_label(mut self, label: impl Into<SharedString>) -> Self {
        self.secondary_label = label.into();
        self
    }
    pub fn description_label(mut self, label: impl Into<SharedString>) -> Self {
        self.description_label = label.into();
        self
    }
    pub fn status_label(mut self, label: impl Into<SharedString>) -> Self {
        self.status_label = label.into();
        self
    }
    pub fn level(mut self, level: CardLevel) -> Self {
        self.level = level;
        self
    }
    /// Hide column headings and stack row content for narrow layouts.
    pub fn compact(mut self, compact: bool) -> Self {
        self.compact = compact;
        self
    }
    pub fn child(mut self, row: StructuredListRow) -> Self {
        self.rows.push(row);
        self
    }
    pub fn empty_label(mut self, label: impl Into<SharedString>) -> Self {
        self.empty = label.into();
        self
    }
}
impl RenderOnce for StructuredList {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut list = div()
            .id(self.id)
            .w_full()
            .min_w_0()
            .rounded(px(8.))
            .border_1()
            .border_color(t.border)
            .bg(match self.level {
                CardLevel::Inset => t.inset,
                _ => t.surface,
            })
            .overflow_hidden();
        if matches!(self.level, CardLevel::Raised) {
            list = list.shadow_sm();
        }
        if !self.compact {
            list = list.child(
                div()
                    .flex()
                    .items_center()
                    .min_h(px(32.))
                    .gap(px(16.))
                    .px(px(20.))
                    .border_b_1()
                    .border_color(t.border)
                    .text_size(px(12.))
                    .text_color(t.muted)
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(div().w(px(15.)).flex_shrink_0())
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .text_ellipsis()
                            .child(self.primary_label),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .text_ellipsis()
                            .child(self.secondary_label),
                    )
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .text_ellipsis()
                            .child(self.description_label),
                    )
                    .child(
                        div()
                            .w(px(100.))
                            .flex_shrink_0()
                            .text_right()
                            .child(self.status_label),
                    ),
            );
        }
        if self.rows.is_empty() {
            list = list.child(
                div()
                    .p(px(20.))
                    .text_size(px(13.))
                    .text_color(t.muted)
                    .child(self.empty),
            );
        } else {
            list = list.children(self.rows.into_iter().map(|row| row.compact(self.compact)));
        }
        list
    }
}
struct ListDemo {
    expanded: bool,
    compact: bool,
    empty: bool,
}
impl Render for ListDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut records = StructuredList::new("publishing-targets", "Target")
            .secondary_label("Identity")
            .description_label("Observation")
            .status_label("Status")
            .compact(self.compact);
        if !self.empty {
            records = records
                .child(
                    StructuredListRow::new("package-record", "Package registry")
                        .secondary("example-project")
                        .description("1.4.2 is current")
                        .status(div().text_color(t.success).child("Current"))
                        .detail("Last checked 2 minutes ago. Published versions are available for installation.")
                        .expanded(self.expanded)
                        .on_toggle(cx.listener(|this, expanded, _, cx| {
                            this.expanded = *expanded;
                            cx.notify();
                        })),
                )
                .child(
                    StructuredListRow::new("desktop-record", "Desktop app")
                        .secondary("macOS")
                        .description("Build ready")
                        .status(div().text_color(t.accent).child("Ready")),
                )
                .child(
                    StructuredListRow::new("docs-record", "Documentation")
                        .secondary("Reference pages")
                        .description("Waiting for publication")
                        .status(div().text_color(t.warning).child("Pending")),
                );
        }
        stack()
            .child(
                row()
                    .child(
                        control(
                            "compact-list",
                            if self.compact {
                                "Show columns"
                            } else {
                                "Compact layout"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.compact = !this.compact;
                            cx.notify();
                        })),
                    )
                    .child(
                        control(
                            "empty-list",
                            if self.empty {
                                "Show records"
                            } else {
                                "Clear records"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.empty = !this.empty;
                            cx.notify();
                        })),
                    ),
            )
            .child(records)
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| ListDemo {
        expanded: false,
        compact: false,
        empty: false,
    })
    .into()
}
