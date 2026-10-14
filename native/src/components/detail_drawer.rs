use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use std::rc::Rc;

/// A viewport-height detail panel. Mount while open and focus `focus` on opening.
/// Provide body/footer focus handles in order to contain keyboard navigation.
#[derive(IntoElement)]
pub struct DetailDrawer {
    title: SharedString,
    body: AnyElement,
    header: Option<AnyElement>,
    footer: Option<AnyElement>,
    focus: FocusHandle,
    close_focus: Option<FocusHandle>,
    tab_order: Vec<FocusHandle>,
    width: Pixels,
    closable: bool,
    close_on_overlay_click: bool,
    on_close: Rc<dyn Fn(&mut Window, &mut App)>,
}
impl DetailDrawer {
    pub fn new(
        title: impl Into<SharedString>,
        body: impl IntoElement,
        focus: FocusHandle,
        on_close: impl Fn(&mut Window, &mut App) + 'static,
    ) -> Self {
        Self {
            title: title.into(),
            body: body.into_any_element(),
            header: None,
            footer: None,
            focus,
            close_focus: None,
            tab_order: Vec::new(),
            width: px(560.),
            closable: true,
            close_on_overlay_click: true,
            on_close: Rc::new(on_close),
        }
    }
    pub fn header(mut self, header: impl IntoElement) -> Self {
        self.header = Some(header.into_any_element());
        self
    }
    pub fn footer(mut self, footer: impl IntoElement) -> Self {
        self.footer = Some(footer.into_any_element());
        self
    }
    pub fn width(mut self, width: Pixels) -> Self {
        self.width = width;
        self
    }
    pub fn closable(mut self, closable: bool) -> Self {
        self.closable = closable;
        self
    }
    pub fn close_on_overlay_click(mut self, close: bool) -> Self {
        self.close_on_overlay_click = close;
        self
    }
    pub fn close_focus(mut self, focus: FocusHandle) -> Self {
        self.close_focus = Some(focus);
        self
    }
    pub fn tab_order(mut self, handles: Vec<FocusHandle>) -> Self {
        self.tab_order = handles;
        self
    }
}
impl RenderOnce for DetailDrawer {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let viewport = window.viewport_size();
        let mut handles = self.tab_order;
        let close_focus = self
            .close_focus
            .unwrap_or_else(|| cx.focus_handle().tab_stop(true));
        let header = if let Some(custom) = self.header {
            custom
        } else {
            let mut header = row().child(div().flex_1().child(self.title));
            if self.closable {
                handles.insert(0, close_focus.clone());
                let on_close = self.on_close.clone();
                header = header.child(
                    control("drawer-close", "×", cx)
                        .track_focus(&close_focus)
                        .on_click(move |_, window, cx| on_close(window, cx)),
                );
            }
            header.into_any_element()
        };
        let key_close = self.on_close.clone();
        let focus = self.focus.clone();
        let mut panel = div()
            .id("detail-drawer-panel")
            .occlude()
            .track_focus(&self.focus)
            .capture_key_down(
                move |event, window, cx| match event.keystroke.key.as_str() {
                    "escape" => {
                        key_close(window, cx);
                        cx.stop_propagation();
                    }
                    "tab" => {
                        if handles.is_empty() {
                            focus.focus(window);
                        } else {
                            let current =
                                handles.iter().position(|handle| handle.is_focused(window));
                            let next = if event.keystroke.modifiers.shift {
                                current
                                    .map(|i| (i + handles.len() - 1) % handles.len())
                                    .unwrap_or(handles.len() - 1)
                            } else {
                                current.map(|i| (i + 1) % handles.len()).unwrap_or(0)
                            };
                            handles[next].focus(window);
                        }
                        window.prevent_default();
                        cx.stop_propagation();
                    }
                    _ => {}
                },
            )
            .on_click(|_, _, cx| cx.stop_propagation())
            .flex()
            .flex_col()
            .flex_shrink_0()
            .w(self.width.max(px(0.)).min(viewport.width))
            .h(viewport.height)
            .bg(t.surface)
            .text_color(t.text)
            .border_l_1()
            .border_color(t.border)
            .child(
                div()
                    .flex_shrink_0()
                    .p(px(16.))
                    .border_b_1()
                    .border_color(t.border)
                    .child(header),
            )
            .child(
                div()
                    .id("detail-drawer-body")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .child(self.body),
            );
        if let Some(footer) = self.footer {
            panel = panel.child(
                div()
                    .flex_shrink_0()
                    .p(px(16.))
                    .border_t_1()
                    .border_color(t.border)
                    .child(footer),
            );
        }
        let close = self.on_close;
        let close_on_overlay_click = self.close_on_overlay_click;
        let overlay = div()
            .id("detail-drawer-overlay")
            .occlude()
            .w(viewport.width)
            .h(viewport.height)
            .flex()
            .justify_end()
            .bg(black().opacity(0.3))
            .on_click(move |_, window, cx| {
                if close_on_overlay_click {
                    close(window, cx);
                }
                cx.stop_propagation();
            })
            .child(panel)
            .into_any_element();
        canvas(
            move |_, window, cx| {
                let mut overlay = overlay;
                overlay.layout_as_root(
                    size(
                        AvailableSpace::Definite(viewport.width),
                        AvailableSpace::Definite(viewport.height),
                    ),
                    window,
                    cx,
                );
                window.defer_draw(overlay, point(px(0.), px(0.)), 100);
            },
            |_, _, _, _| {},
        )
        .size_0()
    }
}

struct DrawerDemo {
    open: bool,
    approved: bool,
    narrow: bool,
    focus: FocusHandle,
    close_focus: FocusHandle,
    cancel: FocusHandle,
    approve: FocusHandle,
    restore: Option<FocusHandle>,
}
impl DrawerDemo {
    fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        if let Some(focus) = self.restore.take() {
            focus.focus(window);
        }
        cx.notify();
    }
}
impl Render for DrawerDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut demo = stack()
            .child(
                row()
                    .child(
                        control("drawer-open", "Inspect change", cx).on_click(cx.listener(
                            |this, _, window, cx| {
                                this.restore = window.focused(cx);
                                this.open = true;
                                this.focus.focus(window);
                                cx.notify();
                            },
                        )),
                    )
                    .child(
                        control(
                            "drawer-width",
                            if self.narrow {
                                "Width: 360px"
                            } else {
                                "Width: 560px"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.narrow = !this.narrow;
                            cx.notify();
                        })),
                    ),
            )
            .child(label(
                if self.approved {
                    "Change approved"
                } else {
                    "Review pending"
                },
                cx,
            ));
        if self.open {
            let entity = cx.entity().downgrade();
            let body = stack().p(px(20.))
                .child(div().text_size(px(20.)).font_weight(FontWeight::SEMIBOLD).child("Improve keyboard navigation"))
                .child(label("#128 · Ready for review", cx))
                .child("Add arrow navigation to the project list and restore focus after closing detail views.")
                .children((1..=12).map(|i| div().p(px(12.)).bg(theme(cx).inset).rounded(px(4.)).child(format!("Changed file {i}: keyboard handling"))));
            let footer = row()
                .justify_end()
                .child(
                    control("drawer-cancel", "Cancel", cx)
                        .track_focus(&self.cancel)
                        .on_click(cx.listener(|this, _, window, cx| this.close(window, cx))),
                )
                .child(
                    control("drawer-approve", "Approve", cx)
                        .track_focus(&self.approve)
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.approved = true;
                            this.close(window, cx);
                        })),
                );
            demo = demo.child(
                DetailDrawer::new(
                    "Change #128",
                    body,
                    self.focus.clone(),
                    move |window, cx| {
                        let _ = entity.update(cx, |this, cx| this.close(window, cx));
                    },
                )
                .width(px(if self.narrow { 360. } else { 560. }))
                .close_focus(self.close_focus.clone())
                .tab_order(vec![self.cancel.clone(), self.approve.clone()])
                .footer(footer),
            );
        }
        demo
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| DrawerDemo {
        open: false,
        approved: false,
        narrow: false,
        focus: cx.focus_handle(),
        close_focus: cx.focus_handle().tab_stop(true),
        cancel: cx.focus_handle().tab_stop(true),
        approve: cx.focus_handle().tab_stop(true),
        restore: None,
    })
    .into()
}
