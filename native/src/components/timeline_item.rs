use crate::components::chip::ChipTone;
use crate::theme::{control, label, stack, theme};
use gpui::{prelude::*, *};

/// An activity rail with a semantic dot and arbitrary content.
#[derive(IntoElement)]
pub struct TimelineItem {
    tone: Option<ChipTone>,
    last: bool,
    children: Vec<AnyElement>,
}
impl TimelineItem {
    pub fn new() -> Self {
        Self {
            tone: None,
            last: false,
            children: Vec::new(),
        }
    }
    pub fn tone(mut self, tone: ChipTone) -> Self {
        self.tone = Some(tone);
        self
    }
    pub fn last(mut self, last: bool) -> Self {
        self.last = last;
        self
    }
}
impl Default for TimelineItem {
    fn default() -> Self {
        Self::new()
    }
}
impl ParentElement for TimelineItem {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}
impl RenderOnce for TimelineItem {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let color = match self.tone {
            Some(ChipTone::Success) => t.success,
            Some(ChipTone::Warning) => t.warning,
            Some(ChipTone::Danger) => t.danger,
            Some(ChipTone::Info) => t.accent,
            Some(ChipTone::Merged) => t.workflow,
            Some(ChipTone::Workspace) => t.workspace,
            Some(_) => t.muted,
            None => t.border,
        };
        let mut rail = div()
            .flex()
            .flex_col()
            .items_center()
            .w(px(24.))
            .flex_shrink_0()
            .pt(px(14.))
            .child(div().size(px(10.)).flex_shrink_0().rounded_full().bg(color));
        if !self.last {
            rail = rail.child(div().mt(px(4.)).w(px(2.)).flex_1().bg(t.border));
        }
        div().flex().gap(px(16.)).min_w(px(0.)).child(rail).child(
            div()
                .flex()
                .flex_col()
                .gap(px(4.))
                .flex_1()
                .min_w(px(0.))
                .pt(px(8.))
                .pb(px(if self.last { 8. } else { 24. }))
                .children(self.children),
        )
    }
}

struct TimelineDemo {
    events: Vec<(SharedString, SharedString, ChipTone)>,
}
impl Render for TimelineDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut timeline = div().flex().flex_col();
        for (index, (title, detail, tone)) in self.events.iter().enumerate() {
            timeline = timeline.child(
                TimelineItem::new()
                    .tone(*tone)
                    .last(index + 1 == self.events.len())
                    .child(div().font_weight(FontWeight::SEMIBOLD).child(title.clone()))
                    .child(label(detail.clone(), cx)),
            );
        }
        stack()
            .child(timeline)
            .child(
                control("timeline-add", "Add event", cx).on_click(cx.listener(|this, _, _, cx| {
                    this.events.push((
                        format!("Update {} published", this.events.len() - 2).into(),
                        "Just now · Activity recorded".into(),
                        ChipTone::Info,
                    ));
                    cx.notify();
                })),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| TimelineDemo {
        events: vec![
            (
                "Workspace created".into(),
                "09:00 · Ready for development".into(),
                ChipTone::Workspace,
            ),
            (
                "Build started".into(),
                "09:05 · Compiling the desktop app".into(),
                ChipTone::Info,
            ),
            (
                "Build passed".into(),
                "09:08 · All checks completed".into(),
                ChipTone::Success,
            ),
        ],
    })
    .into()
}
