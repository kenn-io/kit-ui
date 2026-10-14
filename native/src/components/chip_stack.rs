use crate::{components::chip::Chip, theme::stack};
use gpui::{prelude::*, *};
use std::rc::Rc;

pub struct ChipStack {
    pub items: Vec<SharedString>,
    pub max_visible: usize,
    pub expanded: bool,
    pub wrap: bool,
    pub gap: f32,
    render_item: Rc<dyn Fn(usize, &SharedString, &mut App) -> AnyElement>,
}
impl ChipStack {
    pub fn new(items: Vec<SharedString>) -> Self {
        Self {
            items,
            max_visible: 5,
            expanded: false,
            wrap: true,
            gap: 8.,
            render_item: Rc::new(|index, text, cx| {
                Chip::new(text.clone())
                    .element(("stack-chip", index), cx)
                    .into_any_element()
            }),
        }
    }
    pub fn render_item(
        mut self,
        render: impl Fn(usize, &SharedString, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.render_item = Rc::new(render);
        self
    }
}
impl Render for ChipStack {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let visible = if self.expanded {
            self.items.len()
        } else {
            self.max_visible.min(self.items.len())
        };
        let mut content = div().flex().items_center().gap(px(self.gap)).min_w_0();
        if self.wrap {
            content = content.flex_wrap();
        } else {
            content = content.overflow_hidden();
        }
        for (index, text) in self.items.iter().take(visible).enumerate() {
            content = content.child((self.render_item)(index, text, cx));
        }
        if self.items.len() > self.max_visible {
            let mut chip = Chip::new(if self.expanded {
                "less".to_string()
            } else {
                format!("+{}", self.items.len() - visible)
            });
            chip.interactive = true;
            chip.uppercase = false;
            content = content.child(chip.element("stack-expand", cx).on_click(cx.listener(
                |this, _, _, cx| {
                    this.expanded = !this.expanded;
                    cx.notify();
                },
            )));
        }
        content
    }
}
struct Demo {
    chips: Entity<ChipStack>,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        stack().child(self.chips.clone())
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| Demo {
        chips: cx.new(|_| {
            let mut chips = ChipStack::new(
                [
                    "Rust", "GPUI", "Desktop", "Design", "Keyboard", "Light", "Dark", "Native",
                ]
                .into_iter()
                .map(Into::into)
                .collect(),
            );
            chips.max_visible = 3;
            chips
        }),
    })
    .into()
}
