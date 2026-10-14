use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

/// Three significant digits, with Kit UI's promotion to millions at 999,500.
pub fn format_diff_stat(value: i64) -> String {
    let absolute = value.unsigned_abs();
    if absolute < 1000 {
        return value.to_string();
    }
    let (divisor, suffix) = if absolute >= 999_500 {
        (1_000_000., "M")
    } else {
        (1000., "k")
    };
    let scaled = value as f64 / divisor;
    let integer_digits = (scaled.abs().floor() as u64).to_string().len();
    let precision = 3usize.saturating_sub(integer_digits);
    let mut compact = format!("{scaled:.precision$}");
    if compact.contains('.') {
        compact = compact
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_owned();
    }
    format!("{compact}{suffix}")
}

pub struct DiffStats {
    pub additions: Option<i64>,
    pub deletions: Option<i64>,
    pub dim_zeros: bool,
}
impl DiffStats {
    pub fn new(additions: i64, deletions: i64) -> Self {
        Self {
            additions: Some(additions),
            deletions: Some(deletions),
            dim_zeros: false,
        }
    }
    pub fn element(self, cx: &App) -> Div {
        let t = theme(cx);
        let side = |count: Option<i64>, prefix: &str, color: Hsla| {
            div()
                .text_color(color)
                .when(self.dim_zeros && count == Some(0), |s| s.opacity(0.35))
                .child(format!(
                    "{prefix}{}",
                    count.map(format_diff_stat).unwrap_or_else(|| "?".into())
                ))
        };
        div()
            .flex()
            .gap(px(12.))
            .font_family("Menlo")
            .text_size(px(13.))
            .child(side(self.additions, "+", t.success))
            .child(side(self.deletions, "−", t.danger))
    }
}

struct DiffStatsDemo {
    additions: i64,
    deletions: i64,
    dim_zeros: bool,
}
impl Render for DiffStatsDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut current = DiffStats::new(self.additions, self.deletions);
        current.dim_zeros = self.dim_zeros;
        stack()
            .child(current.element(cx))
            .child(label(
                format!("{} additions, {} deletions", self.additions, self.deletions),
                cx,
            ))
            .child(
                row()
                    .child(
                        control("diff-add", "Add 250 lines", cx).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.additions += 250;
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        control("diff-delete", "Delete 100 lines", cx).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.deletions += 100;
                                cx.notify();
                            },
                        )),
                    )
                    .child(control("diff-reset", "Reset", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.additions = 0;
                            this.deletions = 0;
                            cx.notify();
                        },
                    )))
                    .child(
                        control(
                            "diff-dim",
                            if self.dim_zeros {
                                "Show zeros"
                            } else {
                                "Dim zeros"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.dim_zeros = !this.dim_zeros;
                            cx.notify();
                        })),
                    ),
            )
            .child(
                row()
                    .child(DiffStats::new(12_345, 999_500).element(cx))
                    .child(label("Large changes", cx)),
            )
            .child(
                row()
                    .child(
                        DiffStats {
                            additions: None,
                            deletions: None,
                            dim_zeros: false,
                        }
                        .element(cx),
                    )
                    .child(label("Counts unavailable", cx)),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| DiffStatsDemo {
        additions: 24,
        deletions: 7,
        dim_zeros: false,
    })
    .into()
}
