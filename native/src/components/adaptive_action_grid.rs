use std::{cell::Cell, rc::Rc};

use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AdaptiveActionGridMode {
    Row,
    Grid,
    Compact,
}
#[derive(Clone, Copy, Default)]
pub enum AdaptiveActionGridLayout {
    #[default]
    Adaptive,
    Fill,
}

/// Atomic controls are rebuilt for native intrinsic measurement and painting.
/// Factories should only construct elements; put side effects in event handlers.
pub struct AdaptiveActionGridItem {
    pub id: SharedString,
    content: Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>,
}
impl AdaptiveActionGridItem {
    pub fn new(
        id: impl Into<SharedString>,
        content: impl Fn(&mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        Self {
            id: id.into(),
            content: Rc::new(content),
        }
    }
}

#[derive(Clone)]
struct Configuration {
    label: SharedString,
    items: Vec<(
        SharedString,
        Rc<dyn Fn(&mut Window, &mut App) -> AnyElement>,
    )>,
    layout: AdaptiveActionGridLayout,
    collapse_below: f32,
    min_track_width: f32,
    gap: f32,
    padding: f32,
    outline: bool,
}

/// A measured natural-width row, equal-track grid, or compact disclosure.
/// The fill policy packs natural-width controls into independently stretched rows.
pub struct AdaptiveActionGrid {
    id: ElementId,
    config: Configuration,
}
impl AdaptiveActionGrid {
    pub fn new(
        id: impl Into<ElementId>,
        label: impl Into<SharedString>,
        items: impl IntoIterator<Item = AdaptiveActionGridItem>,
    ) -> Self {
        Self {
            id: id.into(),
            config: Configuration {
                label: label.into(),
                items: items
                    .into_iter()
                    .map(|item| (item.id, item.content))
                    .collect(),
                layout: AdaptiveActionGridLayout::Adaptive,
                collapse_below: 640.,
                min_track_width: 200.,
                gap: 12.,
                padding: 8.,
                outline: true,
            },
        }
    }
    pub fn layout(mut self, value: AdaptiveActionGridLayout) -> Self {
        self.config.layout = value;
        self
    }
    pub fn collapse_below(mut self, width: f32) -> Self {
        self.config.collapse_below = width.max(0.);
        self
    }
    pub fn min_track_width(mut self, width: f32) -> Self {
        self.config.min_track_width = width.max(1.);
        self
    }
    pub fn gap(mut self, value: f32) -> Self {
        self.config.gap = value.max(0.);
        self
    }
    pub fn padding(mut self, value: f32) -> Self {
        self.config.padding = value.max(0.);
        self
    }
    pub fn outline(mut self, value: bool) -> Self {
        self.config.outline = value;
        self
    }
}

impl Configuration {
    fn build(
        &self,
        width: f32,
        open: Rc<Cell<bool>>,
        window: &mut Window,
        cx: &mut App,
    ) -> AnyElement {
        let t = theme(cx);
        let available = (width - self.padding * 2. - if self.outline { 2. } else { 0. }).max(1.);
        let widths: Vec<f32> = self
            .items
            .iter()
            .map(|(_, factory)| {
                let mut element = factory(window, cx);
                element
                    .layout_as_root(
                        size(AvailableSpace::MaxContent, AvailableSpace::MaxContent),
                        window,
                        cx,
                    )
                    .width
                    .into()
            })
            .collect();
        let required =
            widths.iter().sum::<f32>() + self.gap * widths.len().saturating_sub(1) as f32;
        let mode =
            if required <= available && matches!(self.layout, AdaptiveActionGridLayout::Adaptive) {
                AdaptiveActionGridMode::Row
            } else if required > available && width < self.collapse_below {
                AdaptiveActionGridMode::Compact
            } else {
                AdaptiveActionGridMode::Grid
            };
        let mut root = div()
            .flex()
            .flex_col()
            .min_w_0()
            .w_full()
            .rounded(px(8.))
            .bg(t.surface)
            .text_color(t.text);
        if self.outline {
            root = root.border_1().border_color(t.border);
        }
        if mode == AdaptiveActionGridMode::Compact {
            let opened = open.get();
            root = root.child(
                control(
                    "adaptive-grid-trigger",
                    format!("{} {}", self.label, if opened { "▴" } else { "▾" }),
                    cx,
                )
                .w_full()
                .on_click(move |_, window, _| {
                    open.set(!open.get());
                    window.refresh();
                }),
            );
            if !opened {
                return root.into_any_element();
            }
        }
        let mut rows: Vec<Vec<usize>> = Vec::new();
        if mode == AdaptiveActionGridMode::Row {
            rows.push((0..widths.len()).collect());
        } else if matches!(self.layout, AdaptiveActionGridLayout::Fill) {
            let mut used = 0.;
            for (index, width) in widths.iter().enumerate() {
                if rows.is_empty()
                    || (!rows.last().unwrap().is_empty() && used + self.gap + width > available)
                {
                    rows.push(Vec::new());
                    used = 0.;
                }
                if used > 0. {
                    used += self.gap;
                }
                used += width;
                rows.last_mut().unwrap().push(index);
            }
        } else {
            let columns = ((available + self.gap) / (self.min_track_width + self.gap))
                .floor()
                .max(1.) as usize;
            for indices in (0..widths.len()).collect::<Vec<_>>().chunks(columns) {
                rows.push(indices.to_vec());
            }
        }
        let columns = rows.iter().map(Vec::len).max().unwrap_or(1);
        let mut body = div()
            .flex()
            .flex_col()
            .gap(px(self.gap))
            .p(px(self.padding));
        for indices in rows {
            let count = if matches!(self.layout, AdaptiveActionGridLayout::Fill) {
                indices.len()
            } else {
                columns
            };
            let mut line = div().flex().items_center().gap(px(self.gap)).w_full();
            for index in indices {
                let (id, factory) = &self.items[index];
                let child = factory(window, cx);
                let mut item = div().id(id.clone()).min_w_0().flex_shrink_0().child(child);
                if mode != AdaptiveActionGridMode::Row {
                    item = item.w(px(
                        (available - self.gap * count.saturating_sub(1) as f32) / count as f32
                    ));
                }
                line = line.child(item);
            }
            body = body.child(line);
        }
        root.child(body).into_any_element()
    }
}
impl IntoElement for AdaptiveActionGrid {
    type Element = Self;
    fn into_element(self) -> Self {
        self
    }
}
impl Element for AdaptiveActionGrid {
    type RequestLayoutState = Rc<Cell<bool>>;
    type PrepaintState = AnyElement;
    fn id(&self) -> Option<ElementId> {
        Some(self.id.clone())
    }
    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }
    fn request_layout(
        &mut self,
        id: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, Self::RequestLayoutState) {
        let open = window.with_element_state(id.unwrap(), |previous: Option<Rc<Cell<bool>>>, _| {
            let state = previous.unwrap_or_else(|| Rc::new(Cell::new(false)));
            (state.clone(), state)
        });
        let config = self.config.clone();
        let measured_open = open.clone();
        let sizes: Vec<Size<Pixels>> = config
            .items
            .iter()
            .map(|(_, factory)| {
                let mut element = factory(window, cx);
                element.layout_as_root(
                    size(AvailableSpace::MaxContent, AvailableSpace::MaxContent),
                    window,
                    cx,
                )
            })
            .collect();
        let mut trigger =
            control("adaptive-grid-trigger", format!("{} ▾", config.label), cx).into_any_element();
        let trigger_height: f32 = trigger
            .layout_as_root(
                size(AvailableSpace::MaxContent, AvailableSpace::MaxContent),
                window,
                cx,
            )
            .height
            .into();
        let mut style = Style::default();
        style.size.width = relative(1.).into();
        style.min_size.width = px(0.).into();
        let layout = window.request_measured_layout(style, move |known, available, _, _| {
            let width = known.width.unwrap_or_else(|| match available.width {
                AvailableSpace::Definite(width) => width,
                _ => px(800.),
            });
            let host: f32 = width.into();
            let border = if config.outline { 2. } else { 0. };
            let available = (host - config.padding * 2. - border).max(1.);
            let required: f32 = sizes.iter().map(|size| f32::from(size.width)).sum::<f32>()
                + config.gap * sizes.len().saturating_sub(1) as f32;
            let compact = required > available && host < config.collapse_below;
            if compact && !measured_open.get() {
                return size(width, px(trigger_height + border));
            }
            let mut heights = Vec::<f32>::new();
            if required <= available && matches!(config.layout, AdaptiveActionGridLayout::Adaptive)
            {
                heights.push(
                    sizes
                        .iter()
                        .map(|size| f32::from(size.height))
                        .fold(0., f32::max),
                );
            } else if matches!(config.layout, AdaptiveActionGridLayout::Fill) {
                let mut used = 0.;
                for item in &sizes {
                    let item_width: f32 = item.width.into();
                    if heights.is_empty()
                        || (used > 0. && used + config.gap + item_width > available)
                    {
                        heights.push(0.);
                        used = 0.;
                    }
                    if used > 0. {
                        used += config.gap;
                    }
                    used += item_width;
                    let height = heights.last_mut().unwrap();
                    *height = height.max(item.height.into());
                }
            } else {
                let columns = ((available + config.gap) / (config.min_track_width + config.gap))
                    .floor()
                    .max(1.) as usize;
                for items in sizes.chunks(columns) {
                    heights.push(
                        items
                            .iter()
                            .map(|item| f32::from(item.height))
                            .fold(0., f32::max),
                    );
                }
            }
            let height = heights.iter().sum::<f32>()
                + config.gap * heights.len().saturating_sub(1) as f32
                + config.padding * 2.
                + border
                + if compact { trigger_height } else { 0. };
            size(width, px(height))
        });
        (layout, open)
    }
    fn prepaint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        open: &mut Self::RequestLayoutState,
        window: &mut Window,
        cx: &mut App,
    ) -> AnyElement {
        let mut element = self
            .config
            .build(bounds.size.width.into(), open.clone(), window, cx);
        element.layout_as_root(
            size(
                AvailableSpace::Definite(bounds.size.width),
                AvailableSpace::MaxContent,
            ),
            window,
            cx,
        );
        element.prepaint_at(bounds.origin, window, cx);
        element
    }
    fn paint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        _: Bounds<Pixels>,
        _: &mut Self::RequestLayoutState,
        element: &mut AnyElement,
        window: &mut Window,
        cx: &mut App,
    ) {
        element.paint(window, cx);
    }
}

struct Demo {
    width: f32,
    fill: bool,
    result: SharedString,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let weak = cx.entity().downgrade();
        let items = [
            "Approve changes",
            "Request changes",
            "Add a comment",
            "View history",
        ]
        .into_iter()
        .enumerate()
        .map(|(index, text)| {
            let weak = weak.clone();
            AdaptiveActionGridItem::new(format!("action-{index}"), move |_, cx| {
                let weak = weak.clone();
                control(("adaptive-action", index), text, cx)
                    .w_full()
                    .on_click(move |_, _, cx| {
                        let _ = weak.update(cx, |this, cx| {
                            this.result = format!("{text} selected").into();
                            cx.notify();
                        });
                    })
                    .into_any_element()
            })
        })
        .collect::<Vec<_>>();
        stack()
            .child(
                row()
                    .child(
                        control("adaptive-narrow", "Narrower", cx).on_click(cx.listener(
                            |this, _, _, cx| {
                                this.width = (this.width - 80.).max(220.);
                                cx.notify();
                            },
                        )),
                    )
                    .child(control("adaptive-wide", "Wider", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.width = (this.width + 80.).min(900.);
                            cx.notify();
                        },
                    )))
                    .child(
                        control(
                            "adaptive-fill",
                            if self.fill { "Fill" } else { "Adaptive" },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.fill = !this.fill;
                            cx.notify();
                        })),
                    ),
            )
            .child(label(format!("{:.0}px", self.width), cx))
            .child(
                div().w(px(self.width)).max_w_full().child(
                    AdaptiveActionGrid::new("adaptive-demo", "Actions", items)
                        .collapse_below(400.)
                        .min_track_width(180.)
                        .layout(if self.fill {
                            AdaptiveActionGridLayout::Fill
                        } else {
                            AdaptiveActionGridLayout::Adaptive
                        }),
                ),
            )
            .child(label(self.result.clone(), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| Demo {
        width: 700.,
        fill: false,
        result: "Choose an action".into(),
    })
    .into()
}
