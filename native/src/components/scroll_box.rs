use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum ScrollAxis {
    #[default]
    Vertical,
    Horizontal,
    Both,
}

/// Bounded native scrolling with a consumer-retained imperative scroll handle.
#[derive(IntoElement)]
pub struct ScrollBox {
    id: ElementId,
    handle: ScrollHandle,
    axis: ScrollAxis,
    height: Pixels,
    children: Vec<AnyElement>,
    focus: Option<FocusHandle>,
}
impl ScrollBox {
    pub fn new(id: impl Into<ElementId>, handle: &ScrollHandle) -> Self {
        Self {
            id: id.into(),
            handle: handle.clone(),
            axis: ScrollAxis::Vertical,
            height: px(240.),
            children: Vec::new(),
            focus: None,
        }
    }
    pub fn axis(mut self, axis: ScrollAxis) -> Self {
        self.axis = axis;
        self
    }
    pub fn height(mut self, height: Pixels) -> Self {
        self.height = height;
        self
    }
    pub fn focus_handle(mut self, focus: FocusHandle) -> Self {
        self.focus = Some(focus);
        self
    }
    pub fn child(mut self, child: impl IntoElement) -> Self {
        self.children.push(child.into_any_element());
        self
    }
}
impl RenderOnce for ScrollBox {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let focus = self
            .focus
            .unwrap_or_else(|| cx.focus_handle().tab_stop(true));
        let mut viewport = div()
            .id(self.id)
            .w_full()
            .h(self.height)
            .min_w_0()
            .overflow_hidden()
            .border_1()
            .border_color(t.border)
            .rounded(px(6.))
            .bg(t.inset)
            .track_scroll(&self.handle)
            .track_focus(&focus)
            .focusable()
            .tab_stop(true)
            .focus(|s| s.border_color(t.accent))
            .children(self.children);
        viewport = match self.axis {
            ScrollAxis::Vertical => viewport.overflow_y_scroll(),
            ScrollAxis::Horizontal => viewport.overflow_x_scroll(),
            ScrollAxis::Both => viewport.overflow_scroll(),
        };
        let handle = self.handle;
        viewport
            .on_mouse_down(MouseButton::Left, move |_, window, _| focus.focus(window))
            .on_key_down(move |event, window, cx| {
                let mut offset = handle.offset();
                let maximum = handle.max_offset();
                match event.keystroke.key.as_str() {
                    "up" => offset.y += px(40.),
                    "down" => offset.y -= px(40.),
                    "left" => offset.x += px(40.),
                    "right" => offset.x -= px(40.),
                    "pageup" => offset.y += handle.bounds().size.height,
                    "pagedown" => offset.y -= handle.bounds().size.height,
                    "home" => offset = point(px(0.), px(0.)),
                    "end" => offset = point(-maximum.width, -maximum.height),
                    _ => return,
                }
                offset.x = offset.x.clamp(-maximum.width, px(0.));
                offset.y = offset.y.clamp(-maximum.height, px(0.));
                handle.set_offset(offset);
                cx.stop_propagation();
                window.refresh();
            })
    }
}

struct ScrollBoxDemo {
    vertical: ScrollHandle,
    horizontal: ScrollHandle,
    focus: FocusHandle,
}
impl Render for ScrollBoxDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let rows = (1..=40).map(|number| {
            div()
                .flex_shrink_0()
                .h(px(36.))
                .px(px(12.))
                .flex()
                .items_center()
                .border_b_1()
                .border_color(t.border)
                .child(format!("Activity {number:02} · Build completed"))
        });
        stack()
            .child(
                row()
                    .child(control("scroll-top", "Top", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.vertical.set_offset(point(px(0.), px(0.)));
                            cx.notify();
                        },
                    )))
                    .child(control("scroll-bottom", "Bottom", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.vertical.scroll_to_bottom();
                            cx.notify();
                        },
                    ))),
            )
            .child(
                ScrollBox::new("scroll-vertical", &self.vertical)
                    .focus_handle(self.focus.clone())
                    .child(div().flex().flex_col().children(rows)),
            )
            .child(label("Horizontal timeline", cx))
            .child(
                ScrollBox::new("scroll-horizontal", &self.horizontal)
                    .axis(ScrollAxis::Horizontal)
                    .height(px(90.))
                    .child(
                        div()
                            .flex()
                            .w(px(1600.))
                            .h_full()
                            .children((1..=12).map(|number| {
                                div()
                                    .flex_1()
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .border_r_1()
                                    .border_color(t.border)
                                    .child(format!("Day {number}"))
                            })),
                    ),
            )
            .child(label(
                "Focus a viewport to use arrow keys, Page Up, Page Down, Home, and End.",
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| ScrollBoxDemo {
        vertical: ScrollHandle::new(),
        horizontal: ScrollHandle::new(),
        focus: cx.focus_handle().tab_stop(true),
    })
    .into()
}
