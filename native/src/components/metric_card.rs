use crate::components::card::{Card, CardLevel, CardTone};
use crate::theme::{label, row, stack, theme};
use gpui::{prelude::*, *};

/// A dashboard summary with one prominent value, supporting content and metadata.
#[derive(IntoElement)]
pub struct MetricCard {
    id: ElementId,
    label: SharedString,
    value: SharedString,
    meta: Option<SharedString>,
    tone: CardTone,
    level: CardLevel,
    content: Vec<AnyElement>,
    footer: Option<AnyElement>,
}

impl MetricCard {
    pub fn new(
        id: impl Into<ElementId>,
        label: impl Into<SharedString>,
        value: impl Into<SharedString>,
    ) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            value: value.into(),
            meta: None,
            tone: CardTone::Muted,
            level: CardLevel::Raised,
            content: Vec::new(),
            footer: None,
        }
    }

    pub fn meta(mut self, value: impl Into<SharedString>) -> Self {
        self.meta = Some(value.into());
        self
    }

    pub fn tone(mut self, value: CardTone) -> Self {
        self.tone = value;
        self
    }

    pub fn level(mut self, value: CardLevel) -> Self {
        self.level = value;
        self
    }

    pub fn child(mut self, value: impl IntoElement) -> Self {
        self.content.push(value.into_any_element());
        self
    }

    pub fn footer(mut self, value: impl IntoElement) -> Self {
        self.footer = Some(value.into_any_element());
        self
    }
}

impl RenderOnce for MetricCard {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut body = div().flex().flex_col().min_w_0().gap(px(16.)).child(
            div()
                .text_size(px(28.))
                .font_weight(FontWeight::SEMIBOLD)
                .text_color(t.text)
                .child(self.value),
        );
        if !self.content.is_empty() {
            body = body.child(
                div()
                    .flex()
                    .flex_col()
                    .gap(px(8.))
                    .text_size(px(13.))
                    .text_color(t.muted)
                    .children(self.content),
            );
        }
        let mut card = Card::new(self.id)
            .level(self.level)
            .eyebrow(self.label, self.tone)
            .child(body);
        if let Some(meta) = self.meta {
            card = card.meta(meta);
        }
        if let Some(footer) = self.footer {
            card = card.footer(div().text_size(px(12.)).text_color(t.muted).child(footer));
        }
        div().min_w_0().min_h(px(160.)).child(card)
    }
}

struct MetricCardDemo;
impl Render for MetricCardDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .items_start()
                    .child(
                        div().flex_1().min_w(px(220.)).child(
                            MetricCard::new(
                                "metric-build-health",
                                "Build health",
                                "98% successful",
                            )
                            .meta("24 hours")
                            .tone(CardTone::Success)
                            .child("One check failed in the last 24 hours.")
                            .footer("Observed 2 minutes ago"),
                        ),
                    )
                    .child(
                        div().flex_1().min_w(px(220.)).child(
                            MetricCard::new("metric-reviews", "Reviews pending", "12")
                                .meta("This week")
                                .tone(CardTone::Warning)
                                .child("4 reviews are waiting for a response.")
                                .footer("Updated just now"),
                        ),
                    ),
            )
            .child(
                MetricCard::new("metric-activity", "Active workspaces", "24")
                    .level(CardLevel::Inset)
                    .tone(CardTone::Workspace)
                    .meta("Last hour")
                    .child("Across 8 projects")
                    .footer("Source: workspace activity"),
            )
            .child(label(
                "Summary values with supporting detail and source freshness.",
                cx,
            ))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| MetricCardDemo).into()
}
