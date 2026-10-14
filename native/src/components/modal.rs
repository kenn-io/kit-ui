use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use std::rc::Rc;

#[derive(Clone, Copy, Default)]
pub enum ModalTone {
    #[default]
    Neutral,
    Info,
    Success,
    Warning,
    Danger,
}

/// A window-wide modal. Mount while open and focus its handle on opening.
/// Supply the focusable body/footer handles in tab order for a contained Tab cycle.
#[derive(IntoElement)]
pub struct Modal {
    title: SharedString,
    body: AnyElement,
    footer: Option<AnyElement>,
    focus: FocusHandle,
    tab_order: Vec<FocusHandle>,
    tone: ModalTone,
    width: Pixels,
    closable: bool,
    close_on_backdrop: bool,
    on_close: Rc<dyn Fn(&mut Window, &mut App)>,
}
impl Modal {
    pub fn new(
        title: impl Into<SharedString>,
        body: impl IntoElement,
        focus: FocusHandle,
        on_close: impl Fn(&mut Window, &mut App) + 'static,
    ) -> Self {
        Self {
            title: title.into(),
            body: body.into_any_element(),
            footer: None,
            focus,
            tab_order: Vec::new(),
            tone: ModalTone::Neutral,
            width: px(480.),
            closable: true,
            close_on_backdrop: true,
            on_close: Rc::new(on_close),
        }
    }
    pub fn footer(mut self, footer: impl IntoElement) -> Self {
        self.footer = Some(footer.into_any_element());
        self
    }
    pub fn tab_order(mut self, handles: Vec<FocusHandle>) -> Self {
        self.tab_order = handles;
        self
    }
    pub fn tone(mut self, tone: ModalTone) -> Self {
        self.tone = tone;
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
    pub fn close_on_backdrop(mut self, close: bool) -> Self {
        self.close_on_backdrop = close;
        self
    }
}
impl RenderOnce for Modal {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let viewport = window.viewport_size();
        let accent = match self.tone {
            ModalTone::Neutral => t.text,
            ModalTone::Info => t.accent,
            ModalTone::Success => t.success,
            ModalTone::Warning => t.warning,
            ModalTone::Danger => t.danger,
        };
        let key_close = self.on_close.clone();
        let close_button = self.on_close.clone();
        let backdrop_close = self.on_close;
        let focus = self.focus.clone();
        let handles = self.tab_order;
        let mut header = row()
            .justify_between()
            .px(px(16.))
            .py(px(10.))
            .bg(t.inset.blend(accent.opacity(0.09)))
            .border_b_1()
            .border_color(t.border)
            .child(
                div()
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(accent)
                    .child(self.title),
            );
        if self.closable {
            header = header.child(
                control("modal-close", "×", cx).on_click(move |_, w, cx| close_button(w, cx)),
            );
        }
        let mut panel = div()
            .id("modal-panel")
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
            .w(self.width.min(viewport.width - px(32.)))
            .max_h(viewport.height - px(64.))
            .rounded(px(8.))
            .overflow_hidden()
            .bg(t.surface)
            .border_1()
            .border_color(t.border)
            .text_color(t.text)
            .child(header)
            .child(
                div()
                    .id("modal-body")
                    .min_h_0()
                    .overflow_y_scroll()
                    .p(px(16.))
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
        let overlay = div()
            .id("modal-backdrop")
            .occlude()
            .w(viewport.width)
            .h(viewport.height)
            .flex()
            .items_center()
            .justify_center()
            .bg(black().opacity(0.4))
            .on_click(move |_, window, cx| {
                if self.close_on_backdrop {
                    backdrop_close(window, cx);
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

struct ModalDemo {
    open: bool,
    archived: bool,
    focus: FocusHandle,
    cancel: FocusHandle,
    confirm: FocusHandle,
    restore: Option<FocusHandle>,
}
impl ModalDemo {
    fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        if let Some(focus) = self.restore.take() {
            focus.focus(window);
        }
        cx.notify();
    }
}
impl Render for ModalDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut content =
            stack()
                .child(label(
                    if self.archived {
                        "Project archived"
                    } else {
                        "Project active"
                    },
                    cx,
                ))
                .child(
                    row()
                        .child(
                            control("modal-open", "Archive project…", cx).on_click(cx.listener(
                                |this, _, window, cx| {
                                    this.restore = window.focused(cx);
                                    this.open = true;
                                    this.cancel.focus(window);
                                    cx.notify();
                                },
                            )),
                        )
                        .child(control("modal-restore", "Restore project", cx).on_click(
                            cx.listener(|this, _, _, cx| {
                                this.archived = false;
                                cx.notify();
                            }),
                        )),
                );
        if self.open {
            let entity = cx.entity().downgrade();
            let footer = row()
                .justify_end()
                .child(
                    control("modal-cancel", "Cancel", cx)
                        .track_focus(&self.cancel)
                        .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                            if event.keystroke.key == "enter" || event.keystroke.key == "space" {
                                this.close(window, cx);
                            }
                        }))
                        .on_click(cx.listener(|this, _, window, cx| this.close(window, cx))),
                )
                .child(
                    control("modal-confirm", "Archive project", cx)
                        .track_focus(&self.confirm)
                        .text_color(theme(cx).danger)
                        .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                            if event.keystroke.key == "enter" || event.keystroke.key == "space" {
                                this.archived = true;
                                this.close(window, cx);
                            }
                        }))
                        .on_click(cx.listener(|this, _, window, cx| {
                            this.archived = true;
                            this.close(window, cx);
                        })),
                );
            content = content.child(
                Modal::new(
                    "Archive project?",
                    "The project will move out of your active list. You can restore it later.",
                    self.focus.clone(),
                    move |window, cx| {
                        let _ = entity.update(cx, |this, cx| this.close(window, cx));
                    },
                )
                .tone(ModalTone::Danger)
                .footer(footer)
                .tab_order(vec![self.cancel.clone(), self.confirm.clone()]),
            );
        }
        content
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| ModalDemo {
        open: false,
        archived: false,
        focus: cx.focus_handle().tab_stop(true),
        cancel: cx.focus_handle().tab_stop(true),
        confirm: cx.focus_handle().tab_stop(true),
        restore: None,
    })
    .into()
}
