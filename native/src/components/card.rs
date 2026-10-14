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
        let background = if matches!(self.level, CardLevel::Inset) {
            t.inset
        } else {
            t.surface
        };
        let radius = match self.level {
            CardLevel::Inset => 4.,
            CardLevel::Default => 8.,
            CardLevel::Raised => 12.,
        };
        let (x, y) = match self.padding {
            CardPadding::None => (0., 0.),
            CardPadding::Small => (16., 12.),
            CardPadding::Medium => (20., 16.),
        };
        let tone = match self.tone {
            CardTone::Info => t.accent,
            CardTone::Success => t.success,
            CardTone::Warning => t.warning,
            CardTone::Danger => t.danger,
            CardTone::Merged => t.workflow,
            CardTone::Workspace => t.workspace,
            CardTone::Neutral => t.text,
            CardTone::Muted | CardTone::Canceled => t.muted,
        };
        let mut card = div()
            .id(self.id)
            .flex()
            .w_full()
            .min_w_0()
            .gap(px(12.))
            .px(px(x))
            .py(px(y))
            .rounded(px(radius))
            .border_1()
            .border_color(if self.selected { t.accent } else { t.border })
            .bg(if self.selected {
                background.blend(t.accent.opacity(0.08))
            } else {
                background
            })
            .text_color(t.text);
        if inline {
            card = card.items_center();
        } else {
            card = card.flex_col();
        }
        if matches!(self.level, CardLevel::Raised) {
            card = card.shadow_sm();
        }
        if let Some(callback) = self.on_click {
            card = card
                .cursor_pointer()
                .hover(move |s| {
                    s.border_color(t.accent)
                        .bg(background.blend(t.accent.opacity(0.08)))
                })
                .on_click(callback);
        }
        let mut header = div().flex().items_center().gap(px(8.)).min_w_0();
        if let Some(eyebrow) = self.eyebrow {
            header = header.child(
                div()
                    .text_size(px(11.))
                    .font_weight(FontWeight::BOLD)
                    .text_color(tone)
                    .child(eyebrow.to_uppercase()),
            );
        }
        if let Some(title) = self.title {
            header = header.child(
                div()
                    .min_w_0()
                    .text_ellipsis()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(title),
            );
        }
        let body = div().min_w_0().flex_1().children(self.body);
        let meta = self.meta.map(|meta| {
            div()
                .ml_auto()
                .text_size(px(12.))
                .text_color(t.muted)
                .child(meta)
        });
        if inline {
            card = card
                .child(header)
                .child(body)
                .children(meta)
                .children(self.actions);
        } else {
            header = header.children(meta).children(self.actions);
            card = card.child(header).child(body);
            if let Some(footer) = self.footer {
                card = card.child(
                    div()
                        .border_t_1()
                        .border_color(t.border)
                        .pt(px(12.))
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
