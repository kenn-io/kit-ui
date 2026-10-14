use crate::components::card::{CardLayout, CardTone};
use crate::theme::{control, label, stack, theme};
use gpui::{prelude::*, *};

/// Comment or system-event surface. Bodies and header actions accept native elements;
/// Markdown parsing remains the caller's responsibility, as in the Svelte component.
#[derive(IntoElement)]
pub struct CommentCard {
    id: ElementId,
    type_label: Option<SharedString>,
    tone: CardTone,
    author: Option<SharedString>,
    time: Option<SharedString>,
    body_gap: bool,
    layout: CardLayout,
    body: Vec<AnyElement>,
    actions: Option<AnyElement>,
}
impl CommentCard {
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            type_label: None,
            tone: CardTone::Neutral,
            author: None,
            time: None,
            body_gap: true,
            layout: CardLayout::Stack,
            body: Vec::new(),
            actions: None,
        }
    }
    pub fn type_label(mut self, value: impl Into<SharedString>, tone: CardTone) -> Self {
        self.type_label = Some(value.into());
        self.tone = tone;
        self
    }
    pub fn author(mut self, value: impl Into<SharedString>) -> Self {
        self.author = Some(value.into());
        self
    }
    pub fn time(mut self, value: impl Into<SharedString>) -> Self {
        self.time = Some(value.into());
        self
    }
    pub fn body_gap(mut self, enabled: bool) -> Self {
        self.body_gap = enabled;
        self
    }
    pub fn layout(mut self, value: CardLayout) -> Self {
        self.layout = value;
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
}
impl RenderOnce for CommentCard {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let inline = matches!(self.layout, CardLayout::Inline);
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
        let mut header = div().flex().items_center().min_w_0().gap(px(8.));
        if let Some(kind) = self.type_label {
            header = header.child(
                div()
                    .text_size(px(11.))
                    .font_weight(FontWeight::BOLD)
                    .text_color(tone)
                    .child(kind.to_uppercase()),
            );
        }
        if let Some(author) = self.author {
            header = header.child(
                div()
                    .min_w_0()
                    .text_ellipsis()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(author),
            );
        }
        let metadata = self.time.map(|time| {
            div()
                .ml_auto()
                .flex_shrink_0()
                .text_size(px(12.))
                .text_color(t.muted)
                .child(time)
        });
        let mut surface = div()
            .id(self.id)
            .flex()
            .w_full()
            .min_w_0()
            .px(px(16.))
            .py(px(12.))
            .rounded(px(8.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text);
        let has_body = !self.body.is_empty();
        let body = div()
            .min_w_0()
            .text_size(px(13.))
            .line_height(relative(1.6))
            .children(self.body);
        if inline {
            surface = surface.items_center().gap(px(12.)).child(header);
            if has_body {
                surface = surface.child(body.flex_1().text_ellipsis());
            }
            surface.children(metadata).children(self.actions)
        } else {
            surface = surface
                .flex_col()
                .child(header.children(metadata).children(self.actions));
            if has_body {
                surface = surface
                    .gap(px(if self.body_gap { 12. } else { 0. }))
                    .child(body);
            }
            surface
        }
    }
}

struct CommentCardDemo {
    collapsed: bool,
}
impl Render for CommentCardDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut comment = CommentCard::new("comment-card-comment")
            .type_label("Comment", CardTone::Info)
            .author("Alex Morgan")
            .time("2h ago")
            .actions(
                control(
                    "comment-card-collapse",
                    if self.collapsed { "Expand" } else { "Collapse" },
                    cx,
                )
                .on_click(cx.listener(|this, _, _, cx| {
                    this.collapsed = !this.collapsed;
                    cx.notify();
                })),
            );
        if !self.collapsed {
            comment = comment
                .child("The sidebar now keeps its width when switching between workspaces.")
                .child(label("Thanks for checking the native version.", cx));
        }
        stack()
            .child(comment)
            .child(
                CommentCard::new("comment-card-review")
                    .type_label("Review", CardTone::Success)
                    .author("Sam Lee")
                    .time("1h ago")
                    .body_gap(false)
                    .child(
                        div()
                            .pt(px(12.))
                            .child("Looks good. The controls respond without a web view."),
                    ),
            )
            .child(
                CommentCard::new("comment-card-event")
                    .layout(CardLayout::Inline)
                    .type_label("Merged", CardTone::Merged)
                    .author("Alex Morgan")
                    .time("30m ago"),
            )
            .child(
                CommentCard::new("comment-card-inline")
                    .layout(CardLayout::Inline)
                    .type_label("Build", CardTone::Success)
                    .author("CI")
                    .time("Just now")
                    .child("Native preview compiled successfully"),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| CommentCardDemo { collapsed: false }).into()
}
