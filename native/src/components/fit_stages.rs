use gpui::{prelude::*, *};

use crate::theme::{control, label, row, stack, theme};

/// Renders the first stage whose measured natural width fits the host.
/// Supply stages richest first; the last stage is the fallback. The host
/// fills its container, so its width never depends on the chosen stage.
pub struct FitStages {
    id: ElementId,
    stages: Vec<AnyElement>,
    on_stage_change: Option<Box<dyn Fn(&usize, &mut Window, &mut App)>>,
}

impl FitStages {
    pub fn new(id: impl Into<ElementId>, stages: impl IntoIterator<Item = AnyElement>) -> Self {
        Self {
            id: id.into(),
            stages: stages.into_iter().collect(),
            on_stage_change: None,
        }
    }

    pub fn on_stage_change(
        mut self,
        callback: impl Fn(&usize, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_stage_change = Some(Box::new(callback));
        self
    }
}

impl IntoElement for FitStages {
    type Element = Self;
    fn into_element(self) -> Self {
        self
    }
}

impl Element for FitStages {
    type RequestLayoutState = Vec<Size<Pixels>>;
    type PrepaintState = Option<usize>;

    fn id(&self) -> Option<ElementId> {
        Some(self.id.clone())
    }
    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, Self::RequestLayoutState) {
        // Layout without prepainting: unselected stages create no hitboxes,
        // focus targets or paint commands, but text and children are measured.
        let sizes: Vec<_> = self
            .stages
            .iter_mut()
            .map(|stage| {
                stage.layout_as_root(
                    size(AvailableSpace::MaxContent, AvailableSpace::MaxContent),
                    window,
                    cx,
                )
            })
            .collect();
        let mut style = Style::default();
        style.size.width = relative(1.).into();
        style.size.height = sizes
            .iter()
            .map(|s| s.height)
            .max()
            .unwrap_or(px(0.))
            .into();
        style.min_size.width = px(0.).into();
        (window.request_layout(style, [], cx), sizes)
    }

    fn prepaint(
        &mut self,
        id: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        sizes: &mut Self::RequestLayoutState,
        window: &mut Window,
        cx: &mut App,
    ) -> Self::PrepaintState {
        if sizes.is_empty() {
            return None;
        }
        let selected = sizes
            .iter()
            .position(|s| s.width <= bounds.size.width)
            .unwrap_or(sizes.len() - 1);
        let changed = window.with_element_state(id.unwrap(), |previous: Option<usize>, _| {
            (previous != Some(selected), selected)
        });
        if changed {
            if let Some(callback) = &self.on_stage_change {
                callback(&selected, window, cx);
            }
        }
        window.with_content_mask(Some(ContentMask { bounds }), |window| {
            self.stages[selected].prepaint_at(bounds.origin, window, cx);
        });
        Some(selected)
    }

    fn paint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _: &mut Self::RequestLayoutState,
        selected: &mut Self::PrepaintState,
        window: &mut Window,
        cx: &mut App,
    ) {
        if let Some(selected) = selected {
            window.with_content_mask(Some(ContentMask { bounds }), |window| {
                self.stages[*selected].paint(window, cx)
            });
        }
    }
}

struct FitStagesDemo {
    width: f32,
    stage: usize,
    action: SharedString,
}

impl Render for FitStagesDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let stages = [
            ["Approve changes", "Request changes", "Add comment"],
            ["Approve", "Request", "Comment"],
            ["✓", "↺", "+"],
        ]
        .into_iter()
        .enumerate()
        .map(|(index, labels)| {
            let mut actions = div().flex().items_center().gap(px(8.)).flex_shrink_0();
            for (action, text) in labels.into_iter().enumerate() {
                actions = actions.child(
                    control(("fit-action", index * 3 + action), text, cx)
                        .flex_shrink_0()
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.action =
                                ["Approved", "Changes requested", "Comment added"][action].into();
                            cx.notify();
                        })),
                );
            }
            actions.into_any_element()
        })
        .collect::<Vec<_>>();
        stack()
            .child(
                row()
                    .child(control("fit-narrow", "Narrower", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.width = (this.width - 40.).max(120.);
                            cx.notify();
                        },
                    )))
                    .child(control("fit-wide", "Wider", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.width = (this.width + 40.).min(580.);
                            cx.notify();
                        },
                    )))
                    .child(label(format!("{:.0}px", self.width), cx)),
            )
            .child(
                div()
                    .w(px(self.width))
                    .max_w_full()
                    .p(px(12.))
                    .border_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .overflow_hidden()
                    .child(
                        FitStages::new("fit-stages-demo", stages).on_stage_change(cx.listener(
                            |this, stage: &usize, _, cx| {
                                this.stage = *stage;
                                cx.notify();
                            },
                        )),
                    ),
            )
            .child(label(format!("Stage {} of 3", self.stage + 1), cx))
            .child(label(self.action.clone(), cx))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| FitStagesDemo {
        width: 460.,
        stage: 0,
        action: "Choose an action".into(),
    })
    .into()
}
