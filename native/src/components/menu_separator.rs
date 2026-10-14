use crate::components::{menu_content::MenuContent, menu_item::MenuItem};
use crate::theme::theme;
use gpui::{prelude::*, *};
#[derive(IntoElement)]
pub struct MenuSeparator;
impl RenderOnce for MenuSeparator {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        div().h(px(1.)).mx(px(8.)).my(px(4.)).bg(theme(cx).border)
    }
}
struct Demo;
impl Render for Demo {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        MenuContent::new("separator-demo")
            .child(MenuItem::new("separator-copy", "Copy"))
            .child(MenuSeparator)
            .child(MenuItem::new("separator-delete", "Delete").danger(true))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| Demo).into()
}
