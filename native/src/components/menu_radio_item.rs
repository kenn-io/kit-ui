use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A controlled radio choice for a native menu. The owner updates `selected`
/// and decides whether selecting this row closes its menu.
#[derive(IntoElement)]
pub struct MenuRadioItem {
    id: ElementId,
    value: SharedString,
    label: SharedString,
    selected: bool,
    disabled: bool,
    on_select: Option<Box<dyn Fn(&SharedString, &mut Window, &mut App) + 'static>>,
}
impl MenuRadioItem {
    pub fn new(
        id: impl Into<ElementId>,
        value: impl Into<SharedString>,
        label: impl Into<SharedString>,
    ) -> Self {
        Self {
            id: id.into(),
            value: value.into(),
            label: label.into(),
            selected: false,
            disabled: false,
            on_select: None,
        }
    }
    pub fn selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn on_select(
        mut self,
        callback: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_select = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for MenuRadioItem {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
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
            .text_color(t.text)
            .child(
                div()
                    .w(px(12.))
                    .text_color(t.accent)
                    .child(if self.selected { "✓" } else { "" }),
            )
            .child(self.label);
        if self.disabled {
            item = item.opacity(0.45);
        } else {
            item = item
                .focusable()
                .tab_stop(true)
                .cursor_pointer()
                .hover(move |s| s.bg(t.inset))
                .focus(move |s| s.bg(t.inset));
            if let Some(callback) = self.on_select {
                let value = self.value;
                item = item.on_click(move |_, window, cx| callback(&value, window, cx));
            }
        }
        item
    }
}
struct MenuRadioItemDemo {
    selected: SharedString,
}
impl Render for MenuRadioItemDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut choices = div()
            .w(px(300.))
            .p(px(4.))
            .rounded(px(6.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface);
        for (index, (value, title)) in [
            ("name", "Name"),
            ("updated", "Last updated"),
            ("size", "Size"),
        ]
        .into_iter()
        .enumerate()
        {
            choices = choices.child(
                MenuRadioItem::new(("sort-choice", index), value, title)
                    .selected(self.selected.as_ref() == value)
                    .on_select(cx.listener(|this, value: &SharedString, _, cx| {
                        this.selected = value.clone();
                        cx.notify();
                    })),
            );
        }
        stack()
            .child(label("Sort by", cx))
            .child(
                choices.child(MenuRadioItem::new("sort-disabled", "owner", "Owner").disabled(true)),
            )
            .child(label(format!("Selected: {}", self.selected), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| MenuRadioItemDemo {
        selected: "name".into(),
    })
    .into()
}
