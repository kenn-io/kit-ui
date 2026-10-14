use std::rc::Rc;

use gpui::{prelude::*, *};

use super::sidebar_toggle::{SidebarToggle, SidebarToggleState};
use super::split_resize_handle::{SplitOrientation, SplitResizeHandle};
use crate::theme::{control, label, row, stack, theme};

/// A resizable sidebar and main pane, with an optional collapsed strip.
/// Content factories let hosts render any native element on each frame.
pub struct CollapsibleSidebar {
    sidebar: Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>,
    main: Option<Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>>,
    trailing: Option<Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>>,
    resize: Entity<SplitResizeHandle>,
    width: f32,
    collapsed: bool,
    hidden: bool,
    sidebar_only: bool,
    collapsed_strip: bool,
    overlay: Option<bool>,
    overlay_on_narrow: bool,
    main_empty: bool,
    main_scroll: bool,
}

#[derive(Clone, Copy, Debug)]
pub enum SidebarChanged {
    Collapsed(bool),
    Resized(f32),
}
impl EventEmitter<SidebarChanged> for CollapsibleSidebar {}

impl CollapsibleSidebar {
    pub fn new(width: f32, min: f32, max: f32, cx: &mut Context<Self>) -> Self {
        let width = width.clamp(min, max.max(min));
        let changed = cx.listener(|this: &mut Self, width: &f32, _, cx| {
            this.width = *width;
            cx.emit(SidebarChanged::Resized(*width));
            cx.notify();
        });
        Self {
            sidebar: Rc::new(|_, _| div().into_any_element()),
            main: None,
            trailing: None,
            resize: cx.new(|cx| {
                SplitResizeHandle::new(SplitOrientation::Horizontal, width, min, max, cx)
                    .on_resize(changed)
            }),
            width,
            collapsed: false,
            hidden: false,
            sidebar_only: false,
            collapsed_strip: true,
            overlay: None,
            overlay_on_narrow: false,
            main_empty: false,
            main_scroll: true,
        }
    }
    pub fn sidebar(
        mut self,
        content: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.sidebar = Rc::new(content);
        self
    }
    pub fn main(mut self, content: impl Fn(&mut Window, &mut App) -> AnyElement + 'static) -> Self {
        self.main = Some(Rc::new(content));
        self
    }
    pub fn trailing(
        mut self,
        content: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.trailing = Some(Rc::new(content));
        self
    }
    pub fn sidebar_only(mut self, value: bool) -> Self {
        self.sidebar_only = value;
        self
    }
    pub fn show_collapsed_strip(mut self, value: bool) -> Self {
        self.collapsed_strip = value;
        self
    }
    pub fn overlay_on_narrow(mut self, value: bool) -> Self {
        self.overlay_on_narrow = value;
        self
    }
    pub fn main_empty(mut self, value: bool) -> Self {
        self.main_empty = value;
        self
    }
    pub fn main_scroll(mut self, value: bool) -> Self {
        self.main_scroll = value;
        self
    }
    pub fn is_collapsed(&self) -> bool {
        self.collapsed
    }
    pub fn width(&self) -> f32 {
        self.width
    }
    pub fn set_collapsed(&mut self, value: bool, cx: &mut Context<Self>) {
        if self.collapsed != value {
            self.collapsed = value;
            cx.emit(SidebarChanged::Collapsed(value));
            cx.notify();
        }
    }
    pub fn set_hidden(&mut self, value: bool, cx: &mut Context<Self>) {
        self.hidden = value;
        cx.notify();
    }
    /// None uses the viewport breakpoint; Some overrides it for embedded panes.
    pub fn set_overlay(&mut self, value: Option<bool>, cx: &mut Context<Self>) {
        self.overlay = value;
        cx.notify();
    }
}
impl Render for CollapsibleSidebar {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let has_main = self.main.is_some() && !self.sidebar_only;
        let overlay = has_main
            && self
                .overlay
                .unwrap_or(self.overlay_on_narrow && window.viewport_size().width <= px(900.));
        let mut layout = div()
            .id("collapsible-sidebar")
            .relative()
            .flex()
            .size_full()
            .overflow_hidden();
        let expanded = !self.collapsed && !self.hidden;
        // Overlay panes paint after the main area, so native hit testing follows the visible layer.
        let mut sidebar = None;
        if expanded {
            let mut pane = div()
                .flex()
                .flex_col()
                .h_full()
                .flex_shrink_0()
                .bg(t.surface)
                .overflow_hidden()
                .child((self.sidebar)(window, cx));
            pane = if !has_main {
                pane.w_full()
            } else if overlay {
                pane.absolute()
                    .top_0()
                    .left_0()
                    .w(px(self.width.min(390.)))
                    .max_w_full()
                    .border_r_1()
                    .border_color(t.border)
                    .shadow_lg()
            } else {
                pane.w(px(self.width))
            };
            sidebar = Some(pane);
            if !overlay {
                layout = layout.child(sidebar.take().unwrap());
                if has_main {
                    layout = layout.child(self.resize.clone());
                }
            }
        } else if !self.hidden && self.collapsed_strip {
            layout = layout.child(
                div()
                    .w(px(32.))
                    .h_full()
                    .flex_shrink_0()
                    .bg(t.surface)
                    .border_r_1()
                    .border_color(t.border)
                    .pt(px(8.))
                    .flex()
                    .justify_center()
                    .child(
                        SidebarToggle::new("expand-sidebar")
                            .state(SidebarToggleState::Collapsed)
                            .compact(true)
                            .on_click(cx.listener(|this, _, _, cx| this.set_collapsed(false, cx))),
                    ),
            );
        }
        if has_main {
            let mut main = div()
                .id("collapsible-main")
                .flex_1()
                .min_w_0()
                .h_full()
                .bg(t.background)
                .flex()
                .flex_col();
            if self.main_scroll {
                main = main.overflow_y_scroll();
            } else {
                main = main.overflow_hidden();
            }
            if self.main_empty {
                main = main.items_center().justify_center().p(px(16.));
            }
            layout = layout.child(main.child((self.main.as_ref().unwrap())(window, cx)));
        }
        if let Some(sidebar) = sidebar {
            layout = layout.child(sidebar);
        }
        if let Some(trailing) = &self.trailing {
            layout = layout.child(trailing(window, cx));
        }
        layout
    }
}

struct SidebarDemo {
    pane: Entity<CollapsibleSidebar>,
    overlay: bool,
    hidden: bool,
}
impl Render for SidebarDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let collapsed = self.pane.read(cx).is_collapsed();
        stack().child(row()
            .child(control("collapse-pane", if collapsed { "Expand sidebar" } else { "Collapse sidebar" }, cx)
                .on_click(cx.listener(move |this, _, _, cx| this.pane.update(cx, |pane, cx| pane.set_collapsed(!collapsed, cx)))))
            .child(control("overlay-pane", if self.overlay { "Use split layout" } else { "Use overlay" }, cx)
                .on_click(cx.listener(|this, _, _, cx| { this.overlay = !this.overlay; this.pane.update(cx, |pane, cx| pane.set_overlay(Some(this.overlay), cx)); cx.notify(); })))
            .child(control("hide-pane", if self.hidden { "Show sidebar" } else { "Hide sidebar" }, cx)
                .on_click(cx.listener(|this, _, _, cx| { this.hidden = !this.hidden; this.pane.update(cx, |pane, cx| pane.set_hidden(this.hidden, cx)); cx.notify(); }))))
            .child(div().h(px(300.)).w_full().border_1().border_color(t.border).rounded(px(6.)).overflow_hidden().child(self.pane.clone()))
            .child(label("Resize the divider with a pointer or arrow keys. Collapse to keep an expand strip.", cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| SidebarDemo {
        overlay: false,
        hidden: false,
        pane: cx.new(|cx| {
            CollapsibleSidebar::new(220., 140., 360., cx)
                .sidebar(|_, cx| {
                    stack()
                        .p(px(16.))
                        .child("Projects")
                        .child(label("Kit UI", cx))
                        .child(label("Forge", cx))
                        .child(label("Agentsview", cx))
                        .into_any_element()
                })
                .main(|_, cx| {
                    stack()
                        .p(px(24.))
                        .child("Project overview")
                        .child(label("Select a project from the sidebar.", cx))
                        .into_any_element()
                })
        }),
    })
    .into()
}
