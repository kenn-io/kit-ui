use std::{rc::Rc, time::Duration};

use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

type ContentFactory = Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>;

#[derive(Clone, Copy, Default)]
pub enum TooltipAlign {
    #[default]
    Start,
    End,
}

/// A delayed, hoverable tooltip. Factories can render arbitrary native content.
pub struct Tooltip {
    trigger: ContentFactory,
    content: ContentFactory,
    pub focusable: bool,
    pub align: TooltipAlign,
    pub open_delay: Duration,
    pub close_delay: Duration,
    focus: FocusHandle,
    open: bool,
    timer: Option<Task<()>>,
    focus_subscriptions: Vec<Subscription>,
}
impl Tooltip {
    pub fn new(
        text: impl Into<SharedString>,
        trigger: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
        cx: &mut Context<Self>,
    ) -> Self {
        let text = text.into();
        Self {
            trigger: Rc::new(trigger),
            content: Rc::new(move |_, _| div().child(text.clone()).into_any_element()),
            focusable: false,
            align: TooltipAlign::Start,
            open_delay: Duration::from_millis(250),
            close_delay: Duration::from_millis(100),
            focus: cx.focus_handle(),
            open: false,
            timer: None,
            focus_subscriptions: Vec::new(),
        }
    }
    pub fn content(
        mut self,
        content: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.content = Rc::new(content);
        self
    }
    pub fn is_open(&self) -> bool {
        self.open
    }
    fn set_open(&mut self, open: bool, delay: Duration, cx: &mut Context<Self>) {
        self.timer = None;
        if delay.is_zero() {
            self.open = open;
            cx.notify();
        } else if self.open != open {
            let timer = cx.background_executor().timer(delay);
            self.timer = Some(cx.spawn(async move |this, cx| {
                timer.await;
                let _ = this.update(cx, |this, cx| {
                    this.open = open;
                    cx.notify();
                });
            }));
        }
    }
}
impl Render for Tooltip {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.focus_subscriptions.is_empty() {
            let focus = self.focus.clone();
            self.focus_subscriptions
                .push(cx.on_focus_in(&focus, window, |this, _, cx| {
                    this.set_open(true, Duration::ZERO, cx);
                }));
            self.focus_subscriptions
                .push(cx.on_focus_out(&focus, window, |this, _, _, cx| {
                    this.set_open(false, Duration::ZERO, cx);
                }));
        }
        let t = theme(cx);
        let mut trigger = div()
            .id("tooltip-trigger")
            .relative()
            .flex()
            .items_center()
            .track_focus(&self.focus.clone().tab_stop(self.focusable))
            .when(self.focusable, |s| s.focusable().tab_stop(true))
            .rounded(px(4.))
            .focus(|s| s.border_1().border_color(t.accent))
            .on_hover(cx.listener(|this, hovered: &bool, _, cx| {
                let delay = if *hovered {
                    this.open_delay
                } else {
                    this.close_delay
                };
                this.set_open(*hovered, delay, cx);
            }))
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, _, cx| {
                if event.keystroke.key == "escape" && this.open {
                    this.set_open(false, Duration::ZERO, cx);
                    cx.stop_propagation();
                }
            }))
            .child((self.trigger)(window, cx));
        if self.open {
            let width = px(280.).min((window.viewport_size().width - px(32.)).max(px(1.)));
            let panel = div()
                .id("tooltip-panel")
                .occlude()
                .max_w(width)
                .p(px(12.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.surface)
                .text_color(t.text)
                .text_size(px(13.))
                .shadow_md()
                .on_hover(cx.listener(|this, hovered: &bool, _, cx| {
                    let delay = if *hovered {
                        Duration::ZERO
                    } else {
                        this.close_delay
                    };
                    this.set_open(*hovered, delay, cx);
                }))
                .child((self.content)(window, cx))
                .into_any_element();
            let align = self.align;
            trigger = trigger.child(
                canvas(
                    move |bounds, window, cx| {
                        let viewport = window.viewport_size();
                        let mut panel = panel;
                        let panel_size = panel.layout_as_root(
                            size(AvailableSpace::Definite(width), AvailableSpace::MinContent),
                            window,
                            cx,
                        );
                        let preferred_x = match align {
                            TooltipAlign::Start => bounds.left(),
                            TooltipAlign::End => bounds.right() - panel_size.width,
                        };
                        let x = preferred_x
                            .max(px(8.))
                            .min((viewport.width - panel_size.width - px(8.)).max(px(8.)));
                        let below = bounds.bottom() + px(8.);
                        let y = if below + panel_size.height <= viewport.height - px(8.) {
                            below
                        } else {
                            (bounds.top() - panel_size.height - px(8.)).max(px(8.))
                        };
                        window.defer_draw(panel, point(x, y), 100);
                    },
                    |_, _, _, _| {},
                )
                .absolute()
                .top_0()
                .left_0()
                .size_full(),
            );
        }
        trigger
    }
}

struct TooltipDemo {
    simple: Entity<Tooltip>,
    rich: Entity<Tooltip>,
}
impl Render for TooltipDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label(
                "Hover or focus a trigger. Escape dismisses the tooltip.",
                cx,
            ))
            .child(row().child(self.simple.clone()).child(self.rich.clone()))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| TooltipDemo {
        simple: cx.new(|cx| {
            Tooltip::new(
                "Save your changes (⌘S)",
                |_, cx| control("tooltip-save", "Save", cx).into_any_element(),
                cx,
            )
        }),
        rich: cx.new(|cx| {
            let mut tooltip = Tooltip::new(
                "",
                |_, cx| label("Deployment status", cx).into_any_element(),
                cx,
            )
            .content(|_, cx| {
                let t = theme(cx);
                div()
                    .flex()
                    .flex_col()
                    .gap(px(6.))
                    .child(div().text_color(t.success).child("Ready to deploy"))
                    .child(
                        div()
                            .text_color(t.muted)
                            .child("All checks passed. Last updated 2 minutes ago."),
                    )
                    .into_any_element()
            });
            tooltip.focusable = true;
            tooltip.align = TooltipAlign::End;
            tooltip
        }),
    })
    .into()
}
