use crate::components::menu_radio_item::MenuRadioItem;
use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};
use std::rc::Rc;

#[derive(Clone)]
pub struct MenuRadioOption {
    pub value: SharedString,
    pub label: SharedString,
    pub disabled: bool,
}
impl MenuRadioOption {
    pub fn new(value: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            disabled: false,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
}

/// A controlled group of mutually exclusive menu choices.
/// The owner receives selections and supplies the current value on each render.
#[derive(IntoElement)]
pub struct MenuRadioGroup {
    id: ElementId,
    value: SharedString,
    options: Vec<MenuRadioOption>,
    on_change: Option<Rc<dyn Fn(&SharedString, &mut Window, &mut App)>>,
}
impl MenuRadioGroup {
    pub fn new(id: impl Into<ElementId>, value: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            value: value.into(),
            options: Vec::new(),
            on_change: None,
        }
    }
    pub fn option(mut self, option: MenuRadioOption) -> Self {
        self.options.push(option);
        self
    }
    pub fn options(mut self, options: impl IntoIterator<Item = MenuRadioOption>) -> Self {
        self.options.extend(options);
        self
    }
    pub fn on_change(
        mut self,
        callback: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_change = Some(Rc::new(callback));
        self
    }
}
impl RenderOnce for MenuRadioGroup {
    fn render(self, _window: &mut Window, _cx: &mut App) -> impl IntoElement {
        let mut group = div().id(self.id).flex().flex_col().w_full();
        for (index, option) in self.options.into_iter().enumerate() {
            let mut item =
                MenuRadioItem::new(("radio-option", index), option.value.clone(), option.label)
                    .selected(option.value == self.value)
                    .disabled(option.disabled);
            if let Some(callback) = self.on_change.clone() {
                item = item.on_select(move |value, window, cx| callback(value, window, cx));
            }
            group = group.child(item);
        }
        group
    }
}
struct MenuRadioGroupDemo {
    value: SharedString,
}
impl Render for MenuRadioGroupDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        stack()
            .child(label("View density", cx))
            .child(
                div()
                    .w(px(300.))
                    .p(px(4.))
                    .rounded(px(6.))
                    .border_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .child(
                        MenuRadioGroup::new("density-options", self.value.clone())
                            .options([
                                MenuRadioOption::new("compact", "Compact"),
                                MenuRadioOption::new("comfortable", "Comfortable"),
                                MenuRadioOption::new("spacious", "Spacious"),
                                MenuRadioOption::new("automatic", "Automatic").disabled(true),
                            ])
                            .on_change(cx.listener(|this, value: &SharedString, _, cx| {
                                this.value = value.clone();
                                cx.notify();
                            })),
                    ),
            )
            .child(label(format!("Density: {}", self.value), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| MenuRadioGroupDemo {
        value: "comfortable".into(),
    })
    .into()
}
