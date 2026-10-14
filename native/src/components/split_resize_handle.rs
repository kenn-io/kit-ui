use std::rc::Rc;

use gpui::{prelude::*, *};

use crate::theme::{label, stack, theme};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SplitOrientation {
    /// Panes sit side by side; dragging changes their width.
    Horizontal,
    /// Panes sit above one another; dragging changes their height.
    Vertical,
}

/// Stateful separator. Its value is the first pane's size, in pixels.
pub struct SplitResizeHandle {
    orientation: SplitOrientation,
    value: f32,
    min: f32,
    max: f32,
    keyboard_step: f32,
    disabled: bool,
    focus: FocusHandle,
    drag: Option<(f32, f32)>,
    on_resize: Option<Rc<dyn Fn(&f32, &mut Window, &mut App)>>,
}

impl SplitResizeHandle {
    pub fn new(
        orientation: SplitOrientation,
        value: f32,
        min: f32,
        max: f32,
        cx: &mut Context<Self>,
    ) -> Self {
        let max = max.max(min);
        Self {
            orientation,
            value: value.clamp(min, max),
            min,
            max,
            keyboard_step: 24.,
            disabled: false,
            focus: cx.focus_handle().tab_stop(true),
            drag: None,
            on_resize: None,
        }
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn keyboard_step(mut self, step: f32) -> Self {
        self.keyboard_step = step.abs();
        self
    }

    pub fn on_resize(mut self, callback: impl Fn(&f32, &mut Window, &mut App) + 'static) -> Self {
        self.on_resize = Some(Rc::new(callback));
        self
    }

    pub fn value(&self) -> f32 {
        self.value
    }

    fn position(&self, position: Point<Pixels>) -> f32 {
        match self.orientation {
            SplitOrientation::Horizontal => position.x.into(),
            SplitOrientation::Vertical => position.y.into(),
        }
    }

    fn resize(&mut self, value: f32, window: &mut Window, cx: &mut Context<Self>) {
        let value = value.clamp(self.min, self.max);
        if value != self.value {
            self.value = value;
            if let Some(callback) = &self.on_resize {
                callback(&value, window, cx);
            }
            cx.notify();
        }
    }
}

impl Focusable for SplitResizeHandle {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl Render for SplitResizeHandle {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let horizontal = self.orientation == SplitOrientation::Horizontal;
        let mut handle =
            div()
                .id("split-resize-handle")
                .flex_shrink_0()
                .bg(if self.drag.is_some() {
                    t.accent
                } else {
                    t.border
                });
        handle = if horizontal {
            handle.w(px(6.)).h_full()
        } else {
            handle.h(px(6.)).w_full()
        };
        if self.disabled {
            return handle.opacity(0.45);
        }
        let entity = cx.entity().downgrade();
        handle
            .track_focus(&self.focus)
            .focusable()
            .tab_stop(true)
            .focus(|style| style.bg(t.accent))
            .hover(|style| style.bg(t.accent))
            .cursor(if horizontal {
                CursorStyle::ResizeLeftRight
            } else {
                CursorStyle::ResizeUpDown
            })
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(|this, event: &MouseDownEvent, window, cx| {
                    this.focus.focus(window);
                    this.drag = Some((this.position(event.position), this.value));
                    cx.stop_propagation();
                    cx.notify();
                }),
            )
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                let delta = match (this.orientation, event.keystroke.key.as_str()) {
                    (SplitOrientation::Horizontal, "left") | (SplitOrientation::Vertical, "up") => {
                        -this.keyboard_step
                    }
                    (SplitOrientation::Horizontal, "right")
                    | (SplitOrientation::Vertical, "down") => this.keyboard_step,
                    _ => return,
                };
                cx.stop_propagation();
                this.resize(this.value + delta, window, cx);
            }))
            .child(
                canvas(
                    |_, _, _| (),
                    move |_, _, window, _| {
                        let moving = entity.clone();
                        window.on_mouse_event(move |event: &MouseMoveEvent, phase, window, cx| {
                            if phase != DispatchPhase::Bubble {
                                return;
                            }
                            let _ = moving.update(cx, |this, cx| {
                                if let Some((start, value)) = this.drag {
                                    if event.dragging() {
                                        this.resize(
                                            value + this.position(event.position) - start,
                                            window,
                                            cx,
                                        );
                                    } else {
                                        this.drag = None;
                                        cx.notify();
                                    }
                                }
                            });
                        });
                        let ending = entity.clone();
                        window.on_mouse_event(move |event: &MouseUpEvent, phase, window, cx| {
                            if phase != DispatchPhase::Bubble || event.button != MouseButton::Left {
                                return;
                            }
                            let _ = ending.update(cx, |this, cx| {
                                if let Some((start, value)) = this.drag.take() {
                                    this.resize(
                                        value + this.position(event.position) - start,
                                        window,
                                        cx,
                                    );
                                    cx.notify();
                                }
                            });
                        });
                    },
                )
                .size_full(),
            )
    }
}

struct SplitDemo {
    width: f32,
    height: f32,
    horizontal: Entity<SplitResizeHandle>,
    vertical: Entity<SplitResizeHandle>,
}

impl Render for SplitDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let pane = |text: &'static str| div().p(px(16.)).bg(t.inset).child(text);
        stack()
            .child(label(
                "Drag the separators, or focus one and use the arrow keys.",
                cx,
            ))
            .child(
                div()
                    .flex()
                    .w_full()
                    .h(px(160.))
                    .overflow_hidden()
                    .border_1()
                    .border_color(t.border)
                    .child(pane("Files").w(px(self.width)).h_full().flex_shrink_0())
                    .child(self.horizontal.clone())
                    .child(pane("Editor").flex_1().h_full()),
            )
            .child(label(
                format!("First pane: {:.0}px · range: 100–360px", self.width),
                cx,
            ))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .w_full()
                    .h(px(260.))
                    .overflow_hidden()
                    .border_1()
                    .border_color(t.border)
                    .child(pane("Preview").h(px(self.height)).w_full().flex_shrink_0())
                    .child(self.vertical.clone())
                    .child(pane("Terminal").flex_1().w_full()),
            )
            .child(label(
                format!("Top pane: {:.0}px · range: 60–180px", self.height),
                cx,
            ))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let horizontal_callback = cx.listener(|this: &mut SplitDemo, value: &f32, _, cx| {
            this.width = *value;
            cx.notify();
        });
        let vertical_callback = cx.listener(|this: &mut SplitDemo, value: &f32, _, cx| {
            this.height = *value;
            cx.notify();
        });
        SplitDemo {
            width: 200.,
            height: 120.,
            horizontal: cx.new(|cx| {
                SplitResizeHandle::new(SplitOrientation::Horizontal, 200., 100., 360., cx)
                    .on_resize(horizontal_callback)
            }),
            vertical: cx.new(|cx| {
                SplitResizeHandle::new(SplitOrientation::Vertical, 120., 60., 180., cx)
                    .on_resize(vertical_callback)
            }),
        }
    })
    .into()
}
