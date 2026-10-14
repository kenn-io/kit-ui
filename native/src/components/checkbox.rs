use std::rc::Rc;

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A controlled checkbox. The consumer owns checked and indeterminate state.
#[derive(IntoElement)]
pub struct Checkbox {
    id: ElementId,
    label: SharedString,
    checked: bool,
    indeterminate: bool,
    disabled: bool,
    focus: Option<FocusHandle>,
    on_change: Option<Rc<dyn Fn(&bool, &mut Window, &mut App)>>,
}

impl Checkbox {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            checked: false,
            indeterminate: false,
            disabled: false,
            focus: None,
            on_change: None,
        }
    }
    pub fn checked(mut self, checked: bool) -> Self {
        self.checked = checked;
        self
    }
    pub fn indeterminate(mut self, indeterminate: bool) -> Self {
        self.indeterminate = indeterminate;
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

impl RenderOnce for Checkbox {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let selected = self.checked || self.indeterminate;
        let mut box_element = div()
            .flex()
            .items_center()
            .justify_center()
            .size(px(16.))
            .flex_shrink_0()
            .rounded(px(4.))
            .border_1()
            .border_color(if selected { t.accent } else { t.border })
            .bg(if selected { t.accent } else { t.surface });
        if self.checked {
            box_element = box_element.child(
                svg()
                    .path(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/icons/check.svg"
                    ))
                    .size(px(12.))
                    .text_color(t.surface),
            );
        } else if self.indeterminate {
            box_element = box_element.child(div().w(px(8.)).h(px(2.)).bg(t.surface));
        }
        let mut element = div()
            .id(self.id)
            .flex()
            .items_center()
            .gap(px(12.))
            .py(px(4.))
            .text_size(px(13.))
            .text_color(t.muted)
            .child(box_element)
            .child(self.label);
        if self.disabled {
            return element.opacity(0.45);
        }
        element = element.cursor_pointer();
        let focus = self
            .focus
            .unwrap_or_else(|| cx.focus_handle().tab_stop(true));
        element = element
            .track_focus(&focus)
            .focusable()
            .tab_stop(true)
            .focus(|style| style.border_1().border_color(t.accent).rounded(px(4.)));
        let next = !self.checked;
        if let Some(callback) = self.on_change {
            element = element.on_click(move |_, window, cx| {
                focus.focus(window);
                callback(&next, window, cx);
            });
        }
        element
    }
}

struct CheckboxDemo {
    checked: bool,
    mixed: bool,
    changes: usize,
    focus: [FocusHandle; 2],
}
impl Render for CheckboxDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                Checkbox::new("checkbox-notifications", "Desktop notifications")
                    .checked(self.checked)
                    .focus_handle(self.focus[0].clone())
                    .on_change(cx.listener(|this, checked, _, cx| {
                        this.checked = *checked;
                        this.changes += 1;
                        cx.notify();
                    })),
            )
            .child(
                Checkbox::new("checkbox-mixed", "Select all tasks")
                    .checked(self.checked)
                    .indeterminate(self.mixed)
                    .focus_handle(self.focus[1].clone())
                    .on_change(cx.listener(|this, checked, _, cx| {
                        this.checked = *checked;
                        this.mixed = false;
                        this.changes += 1;
                        cx.notify();
                    })),
            )
            .child(
                Checkbox::new("checkbox-disabled", "Managed by your organization")
                    .checked(true)
                    .disabled(true),
            )
            .child(label(
                format!(
                    "Notifications: {} · Changes: {}",
                    if self.checked { "on" } else { "off" },
                    self.changes
                ),
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| CheckboxDemo {
        checked: false,
        mixed: true,
        changes: 0,
        focus: [
            cx.focus_handle().tab_stop(true),
            cx.focus_handle().tab_stop(true),
        ],
    })
    .into()
}
