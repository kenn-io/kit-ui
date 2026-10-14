use crate::components::table_header_cell::{SortDirection, TableHeaderCell};
use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

/// Scrollable table shell. Callers supply headers and rows and own sorting and selection.
#[derive(IntoElement)]
pub struct Table {
    id: ElementId,
    header: AnyElement,
    rows: Vec<AnyElement>,
    sticky_header: bool,
    zebra: bool,
    height: Pixels,
    scroll: Option<ScrollHandle>,
}
impl Table {
    pub fn new(id: impl Into<ElementId>, header: impl IntoElement) -> Self {
        Self {
            id: id.into(),
            header: header.into_any_element(),
            rows: Vec::new(),
            sticky_header: true,
            zebra: true,
            height: px(280.),
            scroll: None,
        }
    }
    pub fn child(mut self, row: impl IntoElement) -> Self {
        self.rows.push(row.into_any_element());
        self
    }
    pub fn sticky_header(mut self, value: bool) -> Self {
        self.sticky_header = value;
        self
    }
    pub fn zebra(mut self, value: bool) -> Self {
        self.zebra = value;
        self
    }
    pub fn height(mut self, value: Pixels) -> Self {
        self.height = value;
        self
    }
    pub fn scroll_handle(mut self, value: &ScrollHandle) -> Self {
        self.scroll = Some(value.clone());
        self
    }
}
impl RenderOnce for Table {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let rows = self.rows.into_iter().enumerate().map(|(index, content)| {
            div()
                .w_full()
                .flex_shrink_0()
                .border_b_1()
                .border_color(t.border)
                .bg(if self.zebra && index % 2 == 1 {
                    t.inset
                } else {
                    t.surface
                })
                .text_color(t.muted)
                .text_size(px(13.))
                .hover(|s| s.bg(t.accent.opacity(0.08)))
                .child(content)
        });
        let mut viewport = div()
            .id(self.id)
            .flex()
            .flex_col()
            .w_full()
            .h(self.height)
            .min_h_0()
            .border_1()
            .border_color(t.border)
            .rounded(px(4.))
            .overflow_hidden();
        let mut body = div()
            .id("table-body")
            .flex()
            .flex_col()
            .flex_1()
            .min_h_0()
            .overflow_y_scroll();
        if let Some(handle) = self.scroll {
            body = body.track_scroll(&handle);
        }
        if self.sticky_header {
            viewport = viewport.child(div().flex_shrink_0().child(self.header));
        } else {
            body = body.child(div().flex_shrink_0().child(self.header));
        }
        viewport.child(body.children(rows))
    }
}

struct TableDemo {
    sort_column: usize,
    direction: SortDirection,
    selected: Option<usize>,
    empty: bool,
    loading: bool,
    sticky: bool,
    zebra: bool,
    header_focus: [FocusHandle; 3],
    scroll: ScrollHandle,
}
impl Render for TableDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut header = div().flex();
        for (index, title) in ["Project", "Runs", "Duration"].into_iter().enumerate() {
            header = header.child(
                TableHeaderCell::new(("table-column", index), title)
                    .width(px(if index == 0 { 240. } else { 120. }))
                    .numeric(index > 0)
                    .focus_handle(self.header_focus[index].clone())
                    .direction(if self.sort_column == index {
                        self.direction
                    } else {
                        SortDirection::None
                    })
                    .on_sort(cx.listener(move |this, direction, _, cx| {
                        this.sort_column = index;
                        this.direction = *direction;
                        cx.notify();
                    })),
            );
        }
        let mut table = Table::new("projects-table", header)
            .height(px(280.))
            .sticky_header(self.sticky)
            .zebra(self.zebra)
            .scroll_handle(&self.scroll);
        let mut projects: Vec<_> = (0..24usize)
            .map(|id| {
                let name = ["Atlas", "Beacon", "Cedar", "Delta", "Elm", "Fern"][id % 6];
                (
                    id,
                    format!("{name} {}", id / 6 + 1),
                    (id * 7 + 8) % 45,
                    (id * 11 + 7) % 60,
                )
            })
            .collect();
        if self.direction != SortDirection::None {
            projects.sort_by(|a, b| {
                let order = match self.sort_column {
                    0 => a.1.cmp(&b.1),
                    1 => a.2.cmp(&b.2),
                    _ => a.3.cmp(&b.3),
                };
                if self.direction == SortDirection::Descending {
                    order.reverse()
                } else {
                    order
                }
            });
        }
        if self.loading || self.empty {
            table = table.child(div().p(px(24.)).child(if self.loading {
                "Loading projects…"
            } else {
                "No projects"
            }));
        } else {
            for (id, name, runs, seconds) in projects {
                table = table.child(
                    div()
                        .id(("project-row", id))
                        .flex()
                        .w_full()
                        .focusable()
                        .tab_stop(true)
                        .cursor_pointer()
                        .focus(|s| s.bg(t.accent.opacity(0.15)))
                        .when(self.selected == Some(id), |s| {
                            s.bg(t.accent.opacity(0.15)).text_color(t.text)
                        })
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.selected = Some(id);
                            cx.notify();
                        }))
                        .child(
                            div()
                                .w(px(240.))
                                .flex_shrink_0()
                                .px(px(10.))
                                .py(px(8.))
                                .child(name),
                        )
                        .child(
                            div()
                                .w(px(120.))
                                .flex_shrink_0()
                                .px(px(10.))
                                .py(px(8.))
                                .text_align(TextAlign::Right)
                                .child(runs.to_string()),
                        )
                        .child(
                            div()
                                .w(px(120.))
                                .flex_shrink_0()
                                .px(px(10.))
                                .py(px(8.))
                                .text_align(TextAlign::Right)
                                .child(format!("{seconds}s")),
                        ),
                );
            }
        }
        stack()
            .child(
                row()
                    .child(
                        control(
                            "table-sticky",
                            if self.sticky {
                                "Unpin header"
                            } else {
                                "Pin header"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.sticky = !this.sticky;
                            cx.notify();
                        })),
                    )
                    .child(
                        control(
                            "table-zebra",
                            if self.zebra {
                                "Remove stripes"
                            } else {
                                "Stripe rows"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.zebra = !this.zebra;
                            cx.notify();
                        })),
                    )
                    .child(
                        control(
                            "table-empty",
                            if self.empty {
                                "Show projects"
                            } else {
                                "Empty table"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.empty = !this.empty;
                            this.loading = false;
                            cx.notify();
                        })),
                    )
                    .child(
                        control(
                            "table-loading",
                            if self.loading {
                                "Finish loading"
                            } else {
                                "Loading state"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.loading = !this.loading;
                            cx.notify();
                        })),
                    ),
            )
            .child(table)
            .child(label(
                self.selected
                    .map(|id| format!("Selected project {}", id + 1))
                    .unwrap_or_else(|| "Select a project".into()),
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| TableDemo {
        sort_column: 0,
        direction: SortDirection::None,
        selected: None,
        empty: false,
        loading: false,
        sticky: true,
        zebra: true,
        header_focus: std::array::from_fn(|_| cx.focus_handle().tab_stop(true)),
        scroll: ScrollHandle::new(),
    })
    .into()
}
