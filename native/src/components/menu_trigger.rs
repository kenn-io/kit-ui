use crate::components::menu::{Menu, MenuOption};
use crate::theme::{stack, theme};
use gpui::{prelude::*, *};
/// Controlled trigger for a composed menu; callback receives whether to focus the last item.
#[derive(IntoElement)]
pub struct MenuTrigger {
    id: ElementId,
    label: SharedString,
    open: bool,
    disabled: bool,
    callback: Option<Box<dyn Fn(&bool, &mut Window, &mut App)>>,
}
impl MenuTrigger {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            open: false,
            disabled: false,
            callback: None,
        }
    }
    pub fn open(mut self, open: bool) -> Self {
        self.open = open;
        self
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn on_open(mut self, callback: impl Fn(&bool, &mut Window, &mut App) + 'static) -> Self {
        self.callback = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for MenuTrigger {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut trigger = div()
            .id(self.id)
            .flex()
            .items_center()
            .gap(px(8.))
            .px(px(8.))
            .py(px(5.))
            .border_1()
            .rounded(px(4.))
            .border_color(if self.open { t.accent } else { t.border })
            .bg(t.inset)
            .text_color(t.text)
            .text_size(px(13.))
            .child(self.label)
            .child("⌄");
        if self.disabled {
            return trigger.opacity(0.45);
        }
        trigger = trigger
            .focusable()
            .tab_stop(true)
            .cursor_pointer()
            .focus(|s| s.border_color(t.accent))
            .hover(|s| s.border_color(t.accent));
        if let Some(callback) = self.callback {
            let callback = std::rc::Rc::new(callback);
            let key_callback = callback.clone();
            trigger = trigger
                .on_click(move |_, window, cx| callback(&false, window, cx))
                .on_key_down(move |event, window, cx| {
                    if matches!(event.keystroke.key.as_str(), "up" | "down") {
                        key_callback(&(event.keystroke.key == "up"), window, cx);
                        window.prevent_default();
                        cx.stop_propagation();
                    }
                });
        }
        trigger
    }
}
struct Demo {
    menu: Entity<Menu>,
    pressed: usize,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(self.menu.clone())
            .child(
                MenuTrigger::new("trigger-count", format!("Triggered {} times", self.pressed))
                    .on_open(cx.listener(|this, _, _, cx| {
                        this.pressed += 1;
                        cx.notify();
                    })),
            )
            .child(MenuTrigger::new("trigger-disabled", "Unavailable").disabled(true))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| Demo {
        menu: cx.new(|cx| {
            Menu::new(
                "Actions",
                vec![
                    MenuOption::new("open", "Open"),
                    MenuOption::new("archive", "Archive"),
                ],
                cx,
            )
        }),
        pressed: 0,
    })
    .into()
}
