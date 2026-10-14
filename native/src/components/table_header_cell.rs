use std::rc::Rc;

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum SortDirection {
    #[default]
    None,
    Ascending,
    Descending,
}
impl SortDirection {
    pub fn next(self) -> Self {
        match self {
            Self::None => Self::Ascending,
            Self::Ascending => Self::Descending,
            Self::Descending => Self::None,
        }
    }
}

/// A controlled column header. The caller owns sorting and the table's rows.
#[derive(IntoElement)]
pub struct TableHeaderCell {
    id: ElementId,
    label: SharedString,
    width: Pixels,
    numeric: bool,
    sortable: bool,
    direction: SortDirection,
    focus: Option<FocusHandle>,
    on_sort: Option<Rc<dyn Fn(&SortDirection, &mut Window, &mut App)>>,
}
impl TableHeaderCell {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            width: px(180.),
            numeric: false,
            sortable: false,
            direction: SortDirection::None,
            focus: None,
            on_sort: None,
        }
    }
    pub fn width(mut self, width: Pixels) -> Self {
        self.width = width;
        self
    }
    pub fn numeric(mut self, numeric: bool) -> Self {
        self.numeric = numeric;
        self
    }
    pub fn sortable(mut self, sortable: bool) -> Self {
        self.sortable = sortable;
        self
    }
    pub fn direction(mut self, direction: SortDirection) -> Self {
        self.direction = direction;
        self
    }
    pub fn focus_handle(mut self, focus: FocusHandle) -> Self {
        self.focus = Some(focus);
        self
    }
    pub fn on_sort(
        mut self,
        callback: impl Fn(&SortDirection, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.sortable = true;
        self.on_sort = Some(Rc::new(callback));
        self
    }
}
impl RenderOnce for TableHeaderCell {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut element = div()
            .id(self.id)
            .w(self.width)
            .flex_shrink_0()
            .flex()
            .items_center()
            .gap(px(4.))
            .px(px(10.))
            .py(px(8.))
            .bg(t.inset)
            .border_b_1()
            .border_color(t.border)
            .text_size(px(12.))
            .font_weight(FontWeight::SEMIBOLD)
            .text_color(t.muted);
        if self.numeric {
            element = element.justify_end();
        }
        let indicator = div()
            .w(px(12.))
            .text_color(t.accent)
            .child(match self.direction {
                SortDirection::None => "",
                SortDirection::Ascending => "↑",
                SortDirection::Descending => "↓",
            });
        if self.numeric && self.sortable {
            element = element.child(indicator).child(self.label);
        } else {
            element = element.child(self.label);
            if self.sortable {
                element = element.child(indicator);
            }
        }
        if self.sortable {
            let focus = self
                .focus
                .unwrap_or_else(|| cx.focus_handle().tab_stop(true));
            element = element
                .cursor_pointer()
                .track_focus(&focus)
                .focusable()
                .tab_stop(true)
                .hover(|style| style.text_color(t.text))
                .focus(|style| style.bg(t.accent.opacity(0.15)));
            if let Some(callback) = self.on_sort {
                let next = self.direction.next();
                element = element.on_click(move |_, window, cx| {
                    focus.focus(window);
                    callback(&next, window, cx);
                });
            }
        }
        element
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Column {
    Name,
    Runs,
    Duration,
}
struct TableDemo {
    column: Column,
    direction: SortDirection,
    focus: [FocusHandle; 3],
}
impl Render for TableDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut headers = div().flex();
        for (index, (column, name, width)) in [
            (Column::Name, "Project", 220.),
            (Column::Runs, "Runs", 100.),
            (Column::Duration, "Duration", 120.),
        ]
        .into_iter()
        .enumerate()
        {
            headers = headers.child(
                TableHeaderCell::new(("table-sort", index), name)
                    .width(px(width))
                    .numeric(index > 0)
                    .focus_handle(self.focus[index].clone())
                    .direction(if self.column == column {
                        self.direction
                    } else {
                        SortDirection::None
                    })
                    .on_sort(cx.listener(move |this, direction, _, cx| {
                        this.column = column;
                        this.direction = *direction;
                        cx.notify();
                    })),
            );
        }
        let mut projects = vec![
            ("Atlas", 24, 18),
            ("Beacon", 8, 42),
            ("Cedar", 36, 7),
            ("Delta", 12, 25),
        ];
        if self.direction != SortDirection::None {
            projects.sort_by(|a, b| {
                let order = match self.column {
                    Column::Name => a.0.cmp(b.0),
                    Column::Runs => a.1.cmp(&b.1),
                    Column::Duration => a.2.cmp(&b.2),
                };
                if self.direction == SortDirection::Descending {
                    order.reverse()
                } else {
                    order
                }
            });
        }
        let mut table = div()
            .flex()
            .flex_col()
            .w(px(440.))
            .border_1()
            .border_color(t.border)
            .rounded(px(4.))
            .overflow_hidden()
            .child(headers);
        for (name, runs, seconds) in projects {
            table = table.child(
                div()
                    .flex()
                    .border_b_1()
                    .border_color(t.border)
                    .text_size(px(13.))
                    .child(div().w(px(220.)).px(px(10.)).py(px(10.)).child(name))
                    .child(
                        div()
                            .w(px(100.))
                            .px(px(10.))
                            .py(px(10.))
                            .text_align(TextAlign::Right)
                            .child(runs.to_string()),
                    )
                    .child(
                        div()
                            .w(px(120.))
                            .px(px(10.))
                            .py(px(10.))
                            .text_align(TextAlign::Right)
                            .child(format!("{seconds}s")),
                    ),
            );
        }
        stack()
            .child(table)
            .child(label(
                "Click a column to cycle ascending, descending, and original order.",
                cx,
            ))
            .child(
                div().flex().child(
                    TableHeaderCell::new("table-static", "Non-sortable column").width(px(220.)),
                ),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| TableDemo {
        column: Column::Name,
        direction: SortDirection::None,
        focus: [
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
        ],
    })
    .into()
}
