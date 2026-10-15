use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum CardLevel {
    Inset,
    #[default]
    Default,
    Raised,
}
#[derive(Clone, Copy, Default)]
pub enum CardPadding {
    None,
    Small,
    #[default]
    Medium,
}
#[derive(Clone, Copy, Default)]
pub enum CardLayout {
    #[default]
    Stack,
    Inline,
}
#[derive(Clone, Copy, Default)]
pub enum CardTone {
    Info,
    Success,
    Warning,
    Danger,
    Merged,
    Workspace,
    #[default]
    Neutral,
    Muted,
    Canceled,
}

/// A composable surface with header, body, actions, and optional divided footer.
#[derive(IntoElement)]
pub struct Card {
    id: ElementId,
    level: CardLevel,
    padding: CardPadding,
    layout: CardLayout,
    selected: bool,
    eyebrow: Option<SharedString>,
    tone: CardTone,
    title: Option<SharedString>,
    meta: Option<SharedString>,
    body: Vec<AnyElement>,
    actions: Option<AnyElement>,
    footer: Option<AnyElement>,
    on_click: Option<Box<dyn Fn(&ClickEvent, &mut Window, &mut App)>>,
}
impl Card {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            level: CardLevel::Default,
            padding: CardPadding::Medium,
            layout: CardLayout::Stack,
            selected: false,
            eyebrow: None,
            tone: CardTone::Neutral,
            title: None,
            meta: None,
            body: Vec::new(),
            actions: None,
            footer: None,
            on_click: None,
        }
    }
    pub fn level(mut self, value: CardLevel) -> Self {
        self.level = value;
        self
    }
    pub fn padding(mut self, value: CardPadding) -> Self {
        self.padding = value;
        self
    }
    pub fn layout(mut self, value: CardLayout) -> Self {
        self.layout = value;
        self
    }
    pub fn selected(mut self, value: bool) -> Self {
        self.selected = value;
        self
    }
    pub fn eyebrow(mut self, value: impl Into<SharedString>, tone: CardTone) -> Self {
        self.eyebrow = Some(value.into());
        self.tone = tone;
        self
    }
    pub fn title(mut self, value: impl Into<SharedString>) -> Self {
        self.title = Some(value.into());
        self
    }
    pub fn meta(mut self, value: impl Into<SharedString>) -> Self {
        self.meta = Some(value.into());
        self
    }
    pub fn child(mut self, value: impl IntoElement) -> Self {
        self.body.push(value.into_any_element());
        self
    }
    pub fn actions(mut self, value: impl IntoElement) -> Self {
        self.actions = Some(value.into_any_element());
        self
    }
    pub fn footer(mut self, value: impl IntoElement) -> Self {
        self.footer = Some(value.into_any_element());
        self
    }
    pub fn on_click(
        mut self,
        callback: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for Card {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let inline = matches!(self.layout, CardLayout::Inline);
        let raised = matches!(self.level, CardLevel::Raised);
        let background = if matches!(self.level, CardLevel::Inset) {
            t.inset
        } else {
            t.surface
        };
        let radius = match self.level {
            CardLevel::Inset => 4.,
            CardLevel::Default => 6.,
            CardLevel::Raised => 8.,
        };
        let (x, y) = match self.padding {
            CardPadding::None => (0., 0.),
            CardPadding::Small => (12., 8.),
            CardPadding::Medium => (16., 12.),
        };
        let tone = match self.tone {
            CardTone::Info => t.text.blend(t.accent.opacity(0.65)),
            CardTone::Success => t.text.blend(t.success.opacity(0.65)),
            CardTone::Warning => t.text.blend(t.warning.opacity(0.65)),
            CardTone::Danger => t.text.blend(t.danger.opacity(0.65)),
            CardTone::Merged => t.text.blend(t.workflow.opacity(0.65)),
            CardTone::Workspace => t.text.blend(t.workspace.opacity(0.65)),
            CardTone::Neutral => t.secondary,
            CardTone::Muted | CardTone::Canceled => t.muted,
        };
        let selected = self.selected;
        let mut card = div()
            .id(self.id)
            .flex()
            .w_full()
            .min_w_0()
            .gap(px(if inline { 6. } else { 8. }))
            .px(px(x))
            .py(px(y))
            .rounded(px(radius))
            .border_1()
            .border_color(if selected {
                t.accent
            } else if raised {
                t.border
            } else {
                t.border_muted
            })
            .bg(if selected {
                background.blend(t.accent.opacity(0.08))
            } else {
                background
            })
            .text_size(px(13.))
            .text_color(t.text);
        if inline {
            card = card.items_center();
        } else {
            card = card.flex_col();
        }
        if raised {
            card = card.shadow(vec![BoxShadow {
                color: black().opacity(if t.background.l < 0.5 { 0.25 } else { 0.05 }),
                offset: point(px(0.), px(1.)),
                blur_radius: px(2.),
                spread_radius: px(0.),
            }]);
        }
        if let Some(callback) = self.on_click {
            card = card
                .cursor_pointer()
                .focusable()
                .tab_stop(true)
                .focus(|s| s.border_color(t.accent))
                .hover(move |s| {
                    s.border_color(t.accent)
                        .bg(background.blend(t.accent.opacity(if selected { 0.08 } else { 0.06 })))
                })
                .on_click(callback);
        }
        let mut heading = Vec::new();
        if let Some(eyebrow) = self.eyebrow {
            let eyebrow = div()
                .text_size(px(11.))
                .font_weight(FontWeight::BOLD)
                .text_color(tone)
                .child(eyebrow.to_uppercase());
            heading.push(if inline {
                eyebrow
                    .min_w_0()
                    .max_w(relative(0.3))
                    .text_ellipsis()
                    .into_any_element()
            } else {
                eyebrow.flex_shrink_0().into_any_element()
            });
        }
        if let Some(title) = self.title {
            let title = div()
                .min_w_0()
                .text_size(px(13.))
                .text_ellipsis()
                .font_weight(FontWeight::SEMIBOLD)
                .child(title);
            heading.push(if inline {
                title.max_w(relative(0.4)).into_any_element()
            } else {
                title.into_any_element()
            });
        }
        let has_meta = self.meta.is_some();
        let meta = self.meta.map(|meta| {
            let meta = div()
                .ml_auto()
                .text_size(px(11.))
                .text_color(t.muted)
                .child(meta);
            if inline {
                meta.min_w_0().max_w(relative(0.3)).text_ellipsis()
            } else {
                meta.flex_shrink_0()
            }
        });
        let actions = self.actions.map(|actions| {
            let actions = div()
                .flex()
                .items_center()
                .gap(px(4.))
                .flex_shrink_0()
                .child(actions);
            if has_meta { actions } else { actions.ml_auto() }
        });
        let has_body = !self.body.is_empty();
        let body = div().min_w_0().children(self.body);
        if inline {
            card = card.children(heading);
            if has_body {
                card = card.child(body.flex_1().min_w(relative(0.3)).text_ellipsis());
            }
            card = card.children(meta).children(actions);
        } else {
            if !heading.is_empty() || has_meta || actions.is_some() {
                card = card.child(
                    div()
                        .flex()
                        .items_center()
                        .flex_wrap()
                        .gap(px(6.))
                        .min_w_0()
                        .children(heading)
                        .children(meta)
                        .children(actions),
                );
            }
            if has_body {
                card = card.child(body);
            }
            if let Some(footer) = self.footer {
                card = card.child(
                    div()
                        .min_w_0()
                        .border_t_1()
                        .border_color(t.border_muted)
                        .pt(px(8.))
                        .child(footer),
                );
            }
        }
        card
    }
}

struct CardDemo {
    selected: bool,
}
impl Render for CardDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                Card::new("card-inset")
                    .level(CardLevel::Inset)
                    .padding(CardPadding::Small)
                    .title("Build details")
                    .child(label("Rust · native desktop · GPUI", cx)),
            )
            .child(
                Card::new("card-default")
                    .eyebrow("Workspace", CardTone::Workspace)
                    .title("Desktop preview")
                    .meta("Just now")
                    .child("Reusable components rendered by GPUI.")
                    .footer(label("Last build succeeded", cx)),
            )
            .child(
                Card::new("card-raised")
                    .level(CardLevel::Raised)
                    .title("Native theme")
                    .selected(self.selected)
                    .child("Click to choose this appearance.")
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.selected = !this.selected;
                        cx.notify();
                    })),
            )
            .child(
                Card::new("card-inline")
                    .layout(CardLayout::Inline)
                    .eyebrow("Success", CardTone::Success)
                    .title("Build complete")
                    .meta("2 min ago")
                    .child("25 component demos available"),
            )
            .child(label(
                if self.selected {
                    "Native theme selected"
                } else {
                    "No theme selected"
                },
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| CardDemo { selected: false }).into()
}
