use std::rc::Rc;

use gpui::{prelude::*, *};

use crate::{
    components::{
        fit_stages::FitStages,
        select_dropdown::{SelectDropdown, SelectOption, SelectionChanged},
    },
    theme::{control, label, row, stack, theme},
};

#[derive(Clone)]
pub struct TopBarTab {
    pub id: SharedString,
    pub label: SharedString,
    pub disabled: bool,
    pub indicator: Option<Hsla>,
}
impl TopBarTab {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            disabled: false,
            indicator: None,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn indicator(mut self, color: Hsla) -> Self {
        self.indicator = Some(color);
        self
    }
}
#[derive(Clone, Debug)]
pub struct TopBarChanged {
    pub id: SharedString,
}
#[derive(Clone, Debug)]
pub struct TopBarCollapsed {
    pub collapsed: bool,
}

type Slot = Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>;

/// A measured header with reserved side slots and navigation that collapses
/// into a native dropdown when the full tab row no longer fits.
pub struct TopBar {
    pub tabs: Vec<TopBarTab>,
    pub active: SharedString,
    pub center_tabs: bool,
    pub collapsed: bool,
    left: Option<Slot>,
    search: Option<Slot>,
    right: Option<Slot>,
    search_min_width: f32,
    select: Entity<SelectDropdown>,
    _subscription: Subscription,
}
impl EventEmitter<TopBarChanged> for TopBar {}
impl EventEmitter<TopBarCollapsed> for TopBar {}
impl TopBar {
    pub fn new(tabs: Vec<TopBarTab>, cx: &mut Context<Self>) -> Self {
        let active = tabs
            .iter()
            .find(|tab| !tab.disabled)
            .map(|tab| tab.id.clone())
            .unwrap_or_default();
        let select = cx.new(|cx| SelectDropdown::new(Vec::new(), active.clone(), cx));
        let subscription = cx.subscribe(&select, |this, _, event: &SelectionChanged, cx| {
            this.active = event.value.clone();
            cx.emit(TopBarChanged {
                id: event.value.clone(),
            });
            cx.notify();
        });
        Self {
            tabs,
            active,
            center_tabs: false,
            collapsed: false,
            left: None,
            search: None,
            right: None,
            search_min_width: 0.,
            select,
            _subscription: subscription,
        }
    }
    pub fn left(mut self, slot: impl Fn(&mut Window, &mut App) -> AnyElement + 'static) -> Self {
        self.left = Some(Rc::new(slot));
        self
    }
    pub fn right(mut self, slot: impl Fn(&mut Window, &mut App) -> AnyElement + 'static) -> Self {
        self.right = Some(Rc::new(slot));
        self
    }
    pub fn search(
        mut self,
        min_width: f32,
        slot: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.search = Some(Rc::new(slot));
        self.search_min_width = if min_width.is_finite() {
            min_width.max(0.)
        } else {
            0.
        };
        self
    }
}
impl Render for TopBar {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let effective = self
            .tabs
            .iter()
            .find(|tab| tab.id == self.active && !tab.disabled)
            .or_else(|| self.tabs.iter().find(|tab| !tab.disabled))
            .map(|tab| tab.id.clone())
            .unwrap_or_default();
        let mut options: Vec<SelectOption> = self
            .tabs
            .iter()
            .map(|tab| {
                let title: SharedString = if tab.indicator.is_some() {
                    format!("{} ●", tab.label).into()
                } else {
                    tab.label.clone()
                };
                SelectOption::new(tab.id.clone(), title).disabled(tab.disabled)
            })
            .collect();
        let all_disabled = self.tabs.iter().all(|tab| tab.disabled);
        if all_disabled {
            options.insert(0, SelectOption::new("", "—").disabled(true));
        }
        self.select.update(cx, |select, _| {
            select.options = options;
            select.value = effective.clone();
            select.disabled = all_disabled;
        });
        let mut tabs = div()
            .flex()
            .items_center()
            .gap(px(2.))
            .p(px(2.))
            .rounded(px(6.))
            .bg(t.inset)
            .flex_shrink_0();
        for (index, tab) in self.tabs.iter().enumerate() {
            let id = tab.id.clone();
            let disabled = tab.disabled;
            let selected = id == effective;
            let mut button = div()
                .id(("top-bar-tab", index))
                .flex()
                .items_center()
                .gap(px(8.))
                .px(px(14.))
                .py(px(5.))
                .rounded(px(4.))
                .whitespace_nowrap()
                .text_size(px(13.))
                .text_color(if disabled {
                    t.muted.opacity(0.5)
                } else {
                    t.text
                })
                .bg(if selected { t.surface } else { t.inset })
                .child(tab.label.clone());
            if let Some(color) = tab.indicator {
                button = button.child(div().size(px(6.)).rounded_full().bg(color));
            }
            if !disabled {
                button = button
                    .focusable()
                    .tab_stop(true)
                    .cursor_pointer()
                    .focus(|style| style.border_1().border_color(t.accent))
                    .hover(|style| style.bg(t.surface))
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.active = id.clone();
                        cx.emit(TopBarChanged { id: id.clone() });
                        cx.notify();
                    }));
            }
            tabs = tabs.child(button);
        }
        let expanded = div()
            .flex()
            .when(self.center_tabs, |d| d.justify_center())
            .child(tabs)
            .into_any_element();
        let compact = div().flex().child(self.select.clone()).into_any_element();
        let mut header = div()
            .id("top-bar")
            .flex()
            .items_center()
            .gap(px(12.))
            .w_full()
            .min_w_0()
            .h(px(48.))
            .px(px(16.))
            .bg(t.surface)
            .border_b_1()
            .border_color(t.border)
            .text_color(t.text);
        if let Some(left) = &self.left {
            header = header.child(
                div()
                    .flex()
                    .items_center()
                    .flex_shrink_0()
                    .child(left(window, cx)),
            );
        }
        if !self.tabs.is_empty() {
            header = header.child(div().flex_1().min_w_0().child(
                FitStages::new("top-bar-navigation", [expanded, compact]).on_stage_change(
                    cx.listener(|this, stage: &usize, _, cx| {
                        this.collapsed = *stage == 1;
                        cx.emit(TopBarCollapsed {
                            collapsed: this.collapsed,
                        });
                        cx.notify();
                    }),
                ),
            ));
        }
        if let Some(search) = &self.search {
            header = header.child(
                div()
                    .flex_1()
                    .min_w(px(self.search_min_width))
                    .child(search(window, cx)),
            );
        }
        if let Some(right) = &self.right {
            header = header.child(
                div()
                    .ml_auto()
                    .flex()
                    .items_center()
                    .flex_shrink_0()
                    .child(right(window, cx)),
            );
        }
        header
    }
}

struct TopBarDemo {
    bar: Entity<TopBar>,
    width: f32,
    selected: SharedString,
    actions: usize,
    _subscription: Subscription,
}
impl Render for TopBarDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .child(
                        control("topbar-narrow", "Narrower", cx).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.width = (this.width - 80.).max(300.);
                                cx.notify();
                            },
                        )),
                    )
                    .child(control("topbar-wide", "Wider", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.width = (this.width + 80.).min(820.);
                            cx.notify();
                        },
                    )))
                    .child(label(format!("{:.0}px", self.width), cx)),
            )
            .child(div().w(px(self.width)).max_w_full().child(self.bar.clone()))
            .child(label(format!("Page: {}", self.selected), cx))
            .child(label(format!("Settings opened {} times", self.actions), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx: &mut Context<TopBarDemo>| {
        let weak = cx.entity().downgrade();
        let bar = cx.new(|cx| {
            TopBar::new(
                vec![
                    TopBarTab::new("overview", "Overview"),
                    TopBarTab::new("sessions", "Sessions").indicator(theme(cx).success),
                    TopBarTab::new("activity", "Activity"),
                    TopBarTab::new("reports", "Reports").disabled(true),
                ],
                cx,
            )
            .left(|_, cx| {
                div()
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(theme(cx).text)
                    .child("Workbench")
                    .into_any_element()
            })
            .right(move |_, cx| {
                let weak = weak.clone();
                control("topbar-settings", "Settings", cx)
                    .on_click(move |_, _, cx| {
                        let _ = weak.update(cx, |this, cx| {
                            this.actions += 1;
                            cx.notify();
                        });
                    })
                    .into_any_element()
            })
        });
        let subscription = cx.subscribe(&bar, |this, _, event: &TopBarChanged, cx| {
            this.selected = event.id.clone();
            cx.notify();
        });
        TopBarDemo {
            bar,
            width: 740.,
            selected: "overview".into(),
            actions: 0,
            _subscription: subscription,
        }
    })
    .into()
}
