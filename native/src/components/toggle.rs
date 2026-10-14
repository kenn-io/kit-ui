use std::rc::Rc;

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A controlled on/off switch. Keep its focus handle alongside the checked state.
#[derive(IntoElement)]
pub struct Toggle {
    id: ElementId,
    label: SharedString,
    checked: bool,
    disabled: bool,
    focus: Option<FocusHandle>,
    on_change: Option<Rc<dyn Fn(&bool, &mut Window, &mut App)>>,
}

impl Toggle {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            checked: false,
            disabled: false,
            focus: None,
            on_change: None,
        }
    }

    pub fn checked(mut self, checked: bool) -> Self {
        self.checked = checked;
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }

    pub fn focus_handle(mut self, focus: FocusHandle) -> Self {
        self.focus = Some(focus);
        self
    }

    pub fn on_change(mut self, callback: impl Fn(&bool, &mut Window, &mut App) + 'static) -> Self {
        self.on_change = Some(Rc::new(callback));
        self
    }
}

impl RenderOnce for Toggle {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let track = div()
            .relative()
            .w(px(36.))
            .h(px(20.))
            .flex_shrink_0()
            .rounded(px(10.))
            .bg(if self.checked { t.accent } else { t.border })
            .child(
                div()
                    .absolute()
                    .top(px(2.))
                    .left(px(if self.checked { 18. } else { 2. }))
                    .size(px(16.))
                    .rounded(px(8.))
                    .bg(t.on_accent),
            );
        let mut element = div()
            .id(self.id)
            .flex()
            .items_center()
            .gap(px(12.))
            .py(px(4.))
            .text_size(px(13.))
            .text_color(t.muted)
            .child(track)
            .child(self.label);
        if self.disabled {
            return element.opacity(0.45);
        }
        let focus = self
            .focus
            .unwrap_or_else(|| cx.focus_handle().tab_stop(true));
        element = element
            .cursor_pointer()
            .track_focus(&focus)
            .focusable()
            .tab_stop(true)
            .focus(|style| style.border_1().border_color(t.accent).rounded(px(4.)));
        if let Some(callback) = self.on_change {
            let next = !self.checked;
            element = element.on_click(move |_, window, cx| {
                focus.focus(window);
                callback(&next, window, cx);
            });
        }
        element
    }
}

struct ToggleDemo {
    notifications: bool,
    wrap_lines: bool,
    changes: usize,
    focus: [FocusHandle; 2],
}

impl Render for ToggleDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                Toggle::new("toggle-notifications", "Desktop notifications")
                    .checked(self.notifications)
                    .focus_handle(self.focus[0].clone())
                    .on_change(cx.listener(|this, checked, _, cx| {
                        this.notifications = *checked;
                        this.changes += 1;
                        cx.notify();
                    })),
            )
            .child(
                Toggle::new("toggle-wrap", "Wrap diff lines")
                    .checked(self.wrap_lines)
                    .focus_handle(self.focus[1].clone())
                    .on_change(cx.listener(|this, checked, _, cx| {
                        this.wrap_lines = *checked;
                        this.changes += 1;
                        cx.notify();
                    })),
            )
            .child(
                Toggle::new("toggle-disabled-on", "Managed setting (on)")
                    .checked(true)
                    .disabled(true),
            )
            .child(Toggle::new("toggle-disabled-off", "Managed setting (off)").disabled(true))
            .child(label(
                format!(
                    "Notifications: {} · Line wrap: {} · Changes: {}",
                    if self.notifications { "on" } else { "off" },
                    if self.wrap_lines { "on" } else { "off" },
                    self.changes,
                ),
                cx,
            ))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| ToggleDemo {
        notifications: false,
        wrap_lines: true,
        changes: 0,
        focus: [
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
        ],
    })
    .into()
}
