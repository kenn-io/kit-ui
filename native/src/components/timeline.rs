use crate::components::{
    card::CardTone, chip::ChipTone, comment_card::CommentCard, timeline_item::TimelineItem,
};
use crate::theme::{control, row, stack};
use gpui::{prelude::*, *};

/// An ordered activity container. Supply TimelineItem children and mark the final
/// item's `last` flag so its connector ends at the final event.
#[derive(IntoElement, Default)]
pub struct Timeline {
    children: Vec<AnyElement>,
}
impl Timeline {
    pub fn new() -> Self {
        Self::default()
    }
}
impl ParentElement for Timeline {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}
impl RenderOnce for Timeline {
    fn render(self, _window: &mut Window, _cx: &mut App) -> impl IntoElement {
        div().flex().flex_col().min_w_0().children(self.children)
    }
}

struct TimelineDemo {
    extra_events: usize,
}
impl Render for TimelineDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut timeline = Timeline::new()
            .child(
                TimelineItem::new().tone(ChipTone::Info).child(
                    CommentCard::new("timeline-comment")
                        .type_label("comment", CardTone::Info)
                        .author("Taylor")
                        .time("3 hours ago")
                        .child("The desktop component gallery is ready for review."),
                ),
            )
            .child(
                TimelineItem::new().tone(ChipTone::Success).child(
                    CommentCard::new("timeline-build")
                        .type_label("build", CardTone::Success)
                        .author("CI")
                        .time("2 hours ago")
                        .child("Native checks passed."),
                ),
            )
            .child(
                TimelineItem::new()
                    .tone(ChipTone::Merged)
                    .last(self.extra_events == 0)
                    .child(
                        CommentCard::new("timeline-review")
                            .type_label("review", CardTone::Merged)
                            .author("Alex")
                            .time("1 hour ago")
                            .child("Approved."),
                    ),
            );
        for index in 0..self.extra_events {
            timeline = timeline.child(
                TimelineItem::new()
                    .tone(ChipTone::Info)
                    .last(index + 1 == self.extra_events)
                    .child(
                        CommentCard::new(("timeline-update", index))
                            .type_label("update", CardTone::Info)
                            .author("Taylor")
                            .time("Just now")
                            .child(format!("Posted update {}.", index + 1)),
                    ),
            );
        }
        stack().child(timeline).child(
            row()
                .child(
                    control("timeline-append", "Add update", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.extra_events += 1;
                            cx.notify();
                        },
                    )),
                )
                .child(
                    control("timeline-reset", "Clear updates", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.extra_events = 0;
                            cx.notify();
                        },
                    )),
                ),
        )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| TimelineDemo { extra_events: 0 }).into()
}
