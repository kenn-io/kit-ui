use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use std::{ops::Range, rc::Rc};

#[derive(Clone, Debug)]
pub enum VirtualListEvent {
    Selected(usize),
    Activated(usize),
    RangeChanged(Range<usize>),
}

/// A native, lazy fixed-height list. Row elements are built only for the
/// viewport; consumers keep their full data set in this entity.
pub struct VirtualList<T: 'static> {
    items: Vec<T>,
    render_row: Rc<dyn Fn(&T, usize, bool, &mut Window, &mut App) -> AnyElement>,
    pub active_index: Option<usize>,
    pub rendered_range: Range<usize>,
    pub scroll_handle: UniformListScrollHandle,
    focus_handle: FocusHandle,
    height: Pixels,
    item_height: Pixels,
    empty_text: SharedString,
}
impl<T: 'static> EventEmitter<VirtualListEvent> for VirtualList<T> {}
impl<T: 'static> Focusable for VirtualList<T> {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}
impl<T: 'static> VirtualList<T> {
    pub fn new(
        items: Vec<T>,
        render_row: impl Fn(&T, usize, bool, &mut Window, &mut App) -> AnyElement + 'static,
        cx: &mut Context<Self>,
    ) -> Self {
        Self {
            items,
            render_row: Rc::new(render_row),
            active_index: None,
            rendered_range: 0..0,
            scroll_handle: UniformListScrollHandle::new(),
            focus_handle: cx.focus_handle().tab_stop(true),
            height: px(320.),
            item_height: px(36.),
            empty_text: "No items".into(),
        }
    }
    pub fn height(mut self, height: Pixels) -> Self {
        self.height = height.max(px(1.));
        self
    }
    pub fn item_height(mut self, height: Pixels) -> Self {
        self.item_height = height.max(px(1.));
        self
    }
    pub fn empty_text(mut self, text: impl Into<SharedString>) -> Self {
        self.empty_text = text.into();
        self
    }
    pub fn items(&self) -> &[T] {
        &self.items
    }
    pub fn set_items(&mut self, items: Vec<T>, cx: &mut Context<Self>) {
        self.items = items;
        self.active_index = self
            .active_index
            .and_then(|index| (!self.items.is_empty()).then(|| index.min(self.items.len() - 1)));
        if let Some(index) = self.active_index {
            self.scroll_to_index(index, cx);
        }
        cx.notify();
    }
    pub fn scroll_to_index(&mut self, index: usize, cx: &mut Context<Self>) {
        if !self.items.is_empty() {
            self.scroll_handle
                .scroll_to_item(index.min(self.items.len() - 1), ScrollStrategy::Top);
            cx.notify();
        }
    }
    pub fn select(&mut self, index: usize, cx: &mut Context<Self>) {
        if self.items.is_empty() {
            return;
        }
        let index = index.min(self.items.len() - 1);
        self.active_index = Some(index);
        self.scroll_to_index(index, cx);
        cx.emit(VirtualListEvent::Selected(index));
    }
}
impl<T: 'static> Render for VirtualList<T> {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let viewport = div()
            .id("virtual-list-viewport")
            .w_full()
            .h(self.height)
            .overflow_hidden()
            .border_1()
            .border_color(t.border)
            .rounded(px(6.))
            .bg(t.surface)
            .track_focus(&self.focus_handle)
            .tab_stop(true)
            .focus(|s| s.border_color(t.accent))
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(|this, _, window, _| {
                    this.focus_handle.focus(window);
                }),
            )
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if !this.focus_handle.is_focused(window) || this.items.is_empty() {
                    return;
                }
                let last = this.items.len() - 1;
                let next = match event.keystroke.key.as_str() {
                    "down" => this.active_index.map_or(0, |i| (i + 1).min(last)),
                    "up" => this.active_index.map_or(0, |i| i.saturating_sub(1)),
                    "home" => 0,
                    "end" => last,
                    "enter" => {
                        if let Some(index) = this.active_index {
                            cx.emit(VirtualListEvent::Activated(index));
                        }
                        cx.stop_propagation();
                        return;
                    }
                    _ => return,
                };
                this.select(next, cx);
                cx.stop_propagation();
            }));
        if self.items.is_empty() {
            return viewport.child(label(self.empty_text.clone(), cx).p(px(12.)));
        }
        viewport.child(
            uniform_list(
                "virtual-list-rows",
                self.items.len(),
                cx.processor(move |this, range: Range<usize>, window, cx| {
                    if this.rendered_range != range {
                        this.rendered_range = range.clone();
                        cx.emit(VirtualListEvent::RangeChanged(range.clone()));
                    }
                    range
                        .map(|index| {
                            let active = this.active_index == Some(index);
                            div()
                                .id(index)
                                .w_full()
                                .h(this.item_height)
                                .overflow_hidden()
                                .border_b_1()
                                .border_color(t.border)
                                .when(active, |s| s.bg(t.inset))
                                .cursor_pointer()
                                .on_click(cx.listener(
                                    move |this, event: &ClickEvent, window, cx| {
                                        this.focus_handle.focus(window);
                                        this.select(index, cx);
                                        if event.click_count() == 2 {
                                            cx.emit(VirtualListEvent::Activated(index));
                                        }
                                    },
                                ))
                                .child((this.render_row)(
                                    &this.items[index],
                                    index,
                                    active,
                                    window,
                                    cx,
                                ))
                        })
                        .collect::<Vec<_>>()
                }),
            )
            .h_full()
            .w_full()
            .track_scroll(self.scroll_handle.clone()),
        )
    }
}

struct VirtualListDemo {
    list: Entity<VirtualList<String>>,
    activated: Option<usize>,
    _subscription: Subscription,
}
impl Render for VirtualListDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .child(label("10,000 activities", cx))
                    .child(control("virtual-first", "First", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.list.update(cx, |list, cx| list.select(0, cx));
                        },
                    )))
                    .child(
                        control("virtual-middle", "Middle", cx).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.list.update(cx, |list, cx| list.select(4999, cx));
                            },
                        )),
                    )
                    .child(control("virtual-last", "Last", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.list.update(cx, |list, cx| list.select(9999, cx));
                        },
                    ))),
            )
            .child(self.list.clone())
            .child(label(
                match self.activated {
                    Some(index) => format!("Opened activity {}", index + 1),
                    None => {
                        "Select an activity, then press Enter or double-click to open it.".into()
                    }
                },
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let list = cx.new(|cx| {
            VirtualList::new(
                (1..=10000)
                    .map(|i| format!("Activity {i:05} · Build completed"))
                    .collect(),
                |text, _, _, _, cx| {
                    label(text.clone(), cx)
                        .h_full()
                        .flex()
                        .items_center()
                        .px(px(12.))
                        .into_any_element()
                },
                cx,
            )
        });
        let subscription = cx.subscribe(&list, |this: &mut VirtualListDemo, _, event, cx| {
            if let VirtualListEvent::Activated(index) = event {
                this.activated = Some(*index);
                cx.notify();
            }
        });
        VirtualListDemo {
            list,
            activated: None,
            _subscription: subscription,
        }
    })
    .into()
}

#[cfg(test)]
mod tests {
    use super::VirtualList;
    use crate::theme::Theme;
    use gpui::{IntoElement, TestAppContext, div, prelude::*};
    use std::{cell::RefCell, rc::Rc};

    #[gpui::test]
    fn large_list_builds_only_viewport_rows_and_reveals_last_item(cx: &mut TestAppContext) {
        cx.update(|cx| cx.set_global(Theme::light()));
        let rendered = Rc::new(RefCell::new(Vec::new()));
        let rows = rendered.clone();
        let (list, cx) = cx.add_window_view(|_, cx| {
            VirtualList::new(
                (0..10_000).collect::<Vec<usize>>(),
                move |item, _, _, _, _| {
                    rows.borrow_mut().push(*item);
                    div().child(item.to_string()).into_any_element()
                },
                cx,
            )
        });
        cx.update(|window, cx| window.draw(cx).clear());
        let mut initially_rendered = rendered.borrow().clone();
        initially_rendered.sort_unstable();
        initially_rendered.dedup();
        assert!(initially_rendered.contains(&0));
        assert!(
            initially_rendered.len() < 100,
            "must not construct the full data set"
        );
        rendered.borrow_mut().clear();
        list.update(cx, |list, cx| list.scroll_to_index(9999, cx));
        cx.update(|window, cx| window.draw(cx).clear());
        assert!(
            rendered.borrow().contains(&9999),
            "imperative reveal must build the target row"
        );
        let visible = list.read_with(cx, |list, _| list.rendered_range.clone());
        assert!(visible.contains(&9999));
        assert!(visible.len() < 100);
    }
}
