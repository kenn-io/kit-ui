use crate::components::menu_item::MenuItem;
use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// Scrollable menu surface. The owning popup controls placement and dismissal.
#[derive(IntoElement)]
pub struct MenuContent {
    id: ElementId,
    children: Vec<AnyElement>,
    width: Pixels,
}
impl MenuContent {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            children: Vec::new(),
            width: px(280.),
        }
    }
    pub fn width(mut self, width: Pixels) -> Self {
        self.width = width;
        self
    }
    pub fn child(mut self, child: impl IntoElement) -> Self {
        self.children.push(child.into_any_element());
        self
    }
}
impl RenderOnce for MenuContent {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        div()
            .id(self.id)
            .flex()
            .flex_col()
            .w(self.width)
            .max_w_full()
            .max_h(px(360.))
            .overflow_y_scroll()
            .p(px(4.))
            .rounded(px(6.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .on_key_down(|event, window, cx| {
                match event.keystroke.key.as_str() {
                    "down" => window.focus_next(),
                    "up" => window.focus_prev(),
                    _ => return,
                }
                window.prevent_default();
                cx.stop_propagation();
            })
            .children(self.children)
    }
}
struct Demo {
    selected: SharedString,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut menu = MenuContent::new("content-demo");
        for (i, title) in ["Open file", "Duplicate", "Archive"]
            .into_iter()
            .enumerate()
        {
            menu = menu.child(
                MenuItem::new(("content-action", i), title).on_click(cx.listener(
                    move |this, _, _, cx| {
                        this.selected = title.into();
                        cx.notify();
                    },
                )),
            );
        }
        stack()
            .child(menu)
            .child(label(format!("Last action: {}", self.selected), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| Demo {
        selected: "None".into(),
    })
    .into()
}
