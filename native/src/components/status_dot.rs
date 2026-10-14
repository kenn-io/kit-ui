use std::{f32::consts::TAU, time::Duration};

use gpui::{prelude::*, *};

use crate::theme::{control, label, row, stack, theme};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Working,
    Waiting,
    Idle,
    Stale,
    Unclean,
    Quiet,
}

impl Status {
    pub fn name(self) -> &'static str {
        match self {
            Self::Working => "working",
            Self::Waiting => "waiting",
            Self::Idle => "idle",
            Self::Stale => "stale",
            Self::Unclean => "unclean",
            Self::Quiet => "",
        }
    }
}

/// Compact activity indicator. Waiting uses a speech bubble; quiet reserves space.
pub struct StatusDot {
    pub status: Status,
    pub label: Option<SharedString>,
    pub size: f32,
    pub animated: bool,
}

impl StatusDot {
    pub fn new(status: Status) -> Self {
        Self {
            status,
            label: None,
            size: 6.,
            animated: false,
        }
    }

    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> AnyElement {
        let t = theme(cx);
        let color = match self.status {
            Status::Working => t.success,
            Status::Waiting => t.waiting,
            Status::Stale => t.warning,
            Status::Idle => t.success.opacity(0.55),
            Status::Unclean => t.danger,
            Status::Quiet => transparent_black(),
        };
        let size = if self.status == Status::Waiting {
            10.
        } else {
            self.size.max(1.)
        };
        let visual = if self.status == Status::Waiting {
            Bubble { color }.into_any_element()
        } else {
            let dot_size = if self.status == Status::Idle {
                size * 0.7
            } else {
                size
            };
            div()
                .size(px(dot_size))
                .rounded_full()
                .bg(color)
                .into_any_element()
        };
        let text = self.label.unwrap_or_else(|| self.status.name().into());
        let mut element = div()
            .id(id)
            .flex()
            .items_center()
            .justify_center()
            .size(px(size))
            .flex_shrink_0()
            .child(visual);
        if !text.is_empty() {
            element = element.tooltip(move |_, cx| cx.new(|_| StatusTooltip(text.clone())).into());
        }
        if self.animated && matches!(self.status, Status::Working | Status::Waiting) {
            element
                .with_animation(
                    "status-pulse",
                    Animation::new(Duration::from_millis(2400)).repeat(),
                    |element, progress| element.opacity(0.65 + 0.35 * (progress * TAU).sin()),
                )
                .into_any_element()
        } else {
            element.into_any_element()
        }
    }
}

#[derive(IntoElement)]
struct Bubble {
    color: Hsla,
}
impl RenderOnce for Bubble {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        canvas(
            |_, _, _| (),
            move |bounds, _, window, _| {
                let mut path = PathBuilder::fill();
                let center = bounds.center();
                for step in 0..=32 {
                    let angle = TAU * step as f32 / 32.;
                    let position = point(
                        center.x + px(5. * angle.cos()),
                        center.y + px(3.5 * angle.sin()),
                    );
                    if step == 0 {
                        path.move_to(position);
                    } else {
                        path.line_to(position);
                    }
                }
                path.close();
                path.move_to(point(center.x - px(3.), center.y + px(2.)));
                path.line_to(point(center.x - px(5.), center.y + px(5.)));
                path.line_to(point(center.x, center.y + px(3.)));
                path.close();
                if let Ok(path) = path.build() {
                    window.paint_path(path, self.color);
                }
            },
        )
        .size(px(10.))
        .flex_shrink_0()
    }
}

struct StatusTooltip(SharedString);
impl Render for StatusTooltip {
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

struct StatusDotDemo {
    animated: bool,
}
impl Render for StatusDotDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut states = stack();
        for (index, status) in [
            Status::Working,
            Status::Waiting,
            Status::Idle,
            Status::Stale,
            Status::Unclean,
            Status::Quiet,
        ]
        .into_iter()
        .enumerate()
        {
            let mut dot = StatusDot::new(status);
            dot.animated = self.animated;
            states = states.child(row().child(dot.element(("status-dot", index), cx)).child(
                label(
                    if status == Status::Quiet {
                        "quiet (empty)"
                    } else {
                        status.name()
                    },
                    cx,
                ),
            ));
        }
        let mut sizes = row();
        for (index, size) in [6., 10., 16.].into_iter().enumerate() {
            let mut dot = StatusDot::new(Status::Working);
            dot.size = size;
            sizes = sizes.child(dot.element(("status-size", index), cx));
        }
        stack().child(states).child(sizes).child(
            control(
                "status-animation",
                if self.animated {
                    "Pause animation"
                } else {
                    "Animate"
                },
                cx,
            )
            .on_click(cx.listener(|this, _, _, cx| {
                this.animated = !this.animated;
                cx.notify();
            })),
        )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| StatusDotDemo { animated: false }).into()
}
