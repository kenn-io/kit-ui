use gpui::{prelude::*, *};

use crate::components::split_resize_handle::{SplitOrientation, SplitResizeHandle};
use crate::theme::{control, label, row, stack, theme};

#[derive(Clone, Copy)]
pub enum BottomDockEvent {
    Closed,
    HeightChanged(f32),
}

/// A resizable bottom panel. Content views keep their state while the panel is closed.
pub struct BottomDock {
    pub open: bool,
    pub closable: bool,
    height: f32,
    title: SharedString,
    header: Option<AnyView>,
    content: Option<AnyView>,
    footer: Option<AnyView>,
    resize: Entity<SplitResizeHandle>,
}
impl EventEmitter<BottomDockEvent> for BottomDock {}
impl BottomDock {
    pub fn new(
        title: impl Into<SharedString>,
        height: f32,
        min: f32,
        max: f32,
        cx: &mut Context<Self>,
    ) -> Self {
        let min = min.max(0.);
        let max = max.max(min);
        let height = height.clamp(min, max);
        let callback = cx.listener(|this: &mut Self, value: &f32, _, cx| {
            this.height = -*value;
            cx.emit(BottomDockEvent::HeightChanged(this.height));
            cx.notify();
        });
        Self {
            open: true,
            closable: true,
            height,
            title: title.into(),
            header: None,
            content: None,
            footer: None,
            resize: cx.new(|cx| {
                SplitResizeHandle::new(SplitOrientation::Vertical, -height, -max, -min, cx)
                    .on_resize(callback)
            }),
        }
    }
    pub fn header(mut self, view: impl Into<AnyView>) -> Self {
        self.header = Some(view.into());
        self
    }
    pub fn content(mut self, view: impl Into<AnyView>) -> Self {
        self.content = Some(view.into());
        self
    }
    pub fn footer(mut self, view: impl Into<AnyView>) -> Self {
        self.footer = Some(view.into());
        self
    }
    pub fn height(&self) -> f32 {
        self.height
    }
    pub fn set_open(&mut self, open: bool, cx: &mut Context<Self>) {
        self.open = open;
        cx.notify();
    }
}
impl Render for BottomDock {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.open {
            return div().into_any_element();
        }
        let t = theme(cx);
        let mut header = row()
            .flex_shrink_0()
            .px(px(16.))
            .py(px(10.))
            .border_b_1()
            .border_color(t.border)
            .child(
                div()
                    .flex_1()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(self.title.clone()),
            );
        if let Some(view) = &self.header {
            header = header.child(view.clone());
        }
        if self.closable {
            header = header.child(
                control("bottom-dock-close", "Close", cx).on_click(cx.listener(
                    |this, _, _, cx| {
                        this.open = false;
                        cx.emit(BottomDockEvent::Closed);
                        cx.notify();
                    },
                )),
            );
        }
        let mut panel = div()
            .id("bottom-dock")
            .flex()
            .flex_col()
            .w_full()
            .h(px(self.height))
            .flex_shrink_0()
            .overflow_hidden()
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .child(self.resize.clone())
            .child(header)
            .child(
                div()
                    .id("bottom-dock-body")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .children(self.content.clone()),
            );
        if let Some(footer) = &self.footer {
            panel = panel.child(
                div()
                    .flex_shrink_0()
                    .px(px(16.))
                    .py(px(8.))
                    .border_t_1()
                    .border_color(t.border)
                    .child(footer.clone()),
            );
        }
        panel.into_any_element()
    }
}
struct DockContent {
    selected: usize,
    runs: usize,
}
impl Render for DockContent {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mut tabs = row();
        for (index, title) in ["Output", "Problems"].into_iter().enumerate() {
            tabs = tabs.child(
                control(("dock-tab", index), title, cx)
                    .border_color(if self.selected == index {
                        t.accent
                    } else {
                        t.border
                    })
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.selected = index;
                        cx.notify();
                    })),
            );
        }
        stack()
            .p(px(16.))
            .child(tabs)
            .child(if self.selected == 0 {
                div().child(format!(
                    "Build {} completed successfully.\n0 errors, 0 warnings.",
                    self.runs
                ))
            } else {
                div().child("No problems found.")
            })
            .child(
                control("dock-run", "Run build", cx).on_click(cx.listener(|this, _, _, cx| {
                    this.runs += 1;
                    this.selected = 0;
                    cx.notify();
                })),
            )
    }
}
struct DockDemo {
    dock: Entity<BottomDock>,
}
impl Render for DockDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label(
                "Drag the top edge, or focus it and use Up/Down to resize.",
                cx,
            ))
            .child(control("dock-open", "Open panel", cx).on_click(cx.listener(
                |this, _, _, cx| {
                    this.dock.update(cx, |dock, cx| dock.set_open(true, cx));
                },
            )))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .h(px(430.))
                    .child(
                        div()
                            .flex_1()
                            .p(px(16.))
                            .bg(theme(cx).inset)
                            .child("Editor"),
                    )
                    .child(self.dock.clone()),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let content = cx.new(|_| DockContent {
            selected: 0,
            runs: 1,
        });
        DockDemo {
            dock: cx.new(|cx| BottomDock::new("Build", 240., 160., 360., cx).content(content)),
        }
    })
    .into()
}
