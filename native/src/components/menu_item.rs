use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A focusable native menu action with optional icon and trailing content.
#[derive(IntoElement)]
pub struct MenuItem {
    id: ElementId,
    label: SharedString,
    icon: Option<AnyElement>,
    right: Option<AnyElement>,
    disabled: bool,
    danger: bool,
    on_click: Option<Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>>,
}
impl MenuItem {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            icon: None,
            right: None,
            disabled: false,
            danger: false,
            on_click: None,
        }
    }
    pub fn icon(mut self, icon: impl IntoElement) -> Self {
        self.icon = Some(icon.into_any_element());
        self
    }
    pub fn right(mut self, content: impl IntoElement) -> Self {
        self.right = Some(content.into_any_element());
        self
    }
    pub fn shortcut(self, shortcut: impl Into<SharedString>) -> Self {
        self.right(div().text_size(px(12.)).child(shortcut.into()))
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn danger(mut self, danger: bool) -> Self {
        self.danger = danger;
        self
    }
    pub fn on_click(
        mut self,
        callback: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for MenuItem {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let ink = if self.danger { t.danger } else { t.text };
        let mut item = div()
            .id(self.id)
            .w_full()
            .flex()
            .items_center()
            .gap(px(8.))
            .min_h(px(28.))
            .px(px(12.))
            .py(px(6.))
            .rounded(px(4.))
            .text_size(px(13.))
            .text_color(ink)
            .children(self.icon.map(|icon| {
                div()
                    .flex()
                    .items_center()
                    .justify_center()
                    .size(px(16.))
                    .child(icon)
            }))
            .child(div().flex_1().child(self.label))
            .children(
                self.right
                    .map(|right| div().text_color(t.muted).child(right)),
            );
        if self.disabled {
            item = item.opacity(0.45).cursor(CursorStyle::Arrow);
        } else {
            item = item
                .cursor_pointer()
                .focusable()
                .tab_stop(true)
                .hover(move |s| s.bg(t.inset))
                .focus(move |s| s.bg(t.inset));
            if let Some(callback) = self.on_click {
                item = item.on_click(callback);
            }
        }
        item
    }
}

struct MenuItemDemo {
    last_action: SharedString,
}
impl Render for MenuItemDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        stack()
            .child(
                div()
                    .w(px(300.))
                    .p(px(4.))
                    .rounded(px(6.))
                    .border_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .child(
                        MenuItem::new("menu-item-open", "Open file")
                            .icon(div().child("↗"))
                            .shortcut("⌘O")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.last_action = "Open file".into();
                                cx.notify();
                            })),
                    )
                    .child(
                        MenuItem::new("menu-item-save", "Save changes")
                            .shortcut("⌘S")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.last_action = "Save changes".into();
                                cx.notify();
                            })),
                    )
                    .child(MenuItem::new("menu-item-disabled", "Share file").disabled(true))
                    .child(
                        MenuItem::new("menu-item-delete", "Delete file")
                            .danger(true)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.last_action = "Delete file".into();
                                cx.notify();
                            })),
                    ),
            )
            .child(label(format!("Last action: {}", self.last_action), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| MenuItemDemo {
        last_action: "None".into(),
    })
    .into()
}
