use std::{f32::consts::TAU, time::Duration};

use gpui::{prelude::*, *};

use crate::theme::{control, label, row, stack, theme};

/// Indeterminate progress indicator with an optional visible status label.
pub struct Spinner {
    pub size: f32,
    pub label: Option<SharedString>,
}

impl Default for Spinner {
    fn default() -> Self {
        Self {
            size: 24.,
            label: Some("Loading".into()),
        }
    }
}

impl Spinner {
    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> AnyElement {
        let t = theme(cx);
        row()
            .child(
                SpinnerRing {
                    size: self.size.max(4.),
                    angle: 0.,
                    track: t.border,
                    accent: t.accent,
                }
                .with_animation(
                    id,
                    Animation::new(Duration::from_millis(800)).repeat(),
                    |mut ring, progress| {
                        ring.angle = progress * TAU;
                        ring
                    },
                ),
            )
            .children(self.label.map(|text| label(text, cx)))
            .into_any_element()
    }
}

#[derive(IntoElement)]
struct SpinnerRing {
    size: f32,
    angle: f32,
    track: Hsla,
    accent: Hsla,
}

impl RenderOnce for SpinnerRing {
    fn render(self, _window: &mut Window, _cx: &mut App) -> impl IntoElement {
        canvas(
            |_, _, _| (),
            move |bounds, _, window, _| {
                let center = bounds.center();
                let radius = self.size / 2. - 1.;
                for (start, sweep, color) in
                    [(0., TAU, self.track), (self.angle, TAU / 4., self.accent)]
                {
                    let mut path = PathBuilder::stroke(px(2.));
                    for step in 0..=64 {
                        let angle = start + sweep * step as f32 / 64.;
                        let position = point(
                            center.x + px(radius * angle.cos()),
                            center.y + px(radius * angle.sin()),
                        );
                        if step == 0 {
                            path.move_to(position);
                        } else {
                            path.line_to(position);
                        }
                    }
                    if let Ok(path) = path.build() {
                        window.paint_path(path, color);
                    }
                }
            },
        )
        .size(px(self.size))
        .flex_shrink_0()
    }
}

struct SpinnerDemo {
    busy: bool,
}

impl Render for SpinnerDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .child(
                        Spinner {
                            size: 16.,
                            label: None,
                        }
                        .element("spinner-small", cx),
                    )
                    .child(
                        Spinner {
                            size: 24.,
                            label: None,
                        }
                        .element("spinner-medium", cx),
                    )
                    .child(
                        Spinner {
                            size: 40.,
                            label: None,
                        }
                        .element("spinner-large", cx),
                    ),
            )
            .child(
                control(
                    "spinner-toggle",
                    if self.busy {
                        "Finish loading"
                    } else {
                        "Start loading"
                    },
                    cx,
                )
                .on_click(cx.listener(|this, _, _, cx| {
                    this.busy = !this.busy;
                    cx.notify();
                })),
            )
            .child(if self.busy {
                Spinner::default().element("spinner-busy", cx)
            } else {
                label("Ready", cx).into_any_element()
            })
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| SpinnerDemo { busy: true }).into()
}
