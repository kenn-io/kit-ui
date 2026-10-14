use std::rc::Rc;

use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

/// Image dimensions are the natural size, so fitting never enlarges an image.
/// Element factories receive the display scale to scale their native content.
#[derive(Clone)]
pub enum MediaViewerItem {
    Image {
        src: ImageSource,
        alt: SharedString,
        natural_size: Size<Pixels>,
    },
    Element {
        label: SharedString,
        natural_size: Size<Pixels>,
        render: Rc<dyn Fn(f32, &mut App) -> AnyElement>,
    },
}

impl MediaViewerItem {
    pub fn image(
        src: impl Into<ImageSource>,
        alt: impl Into<SharedString>,
        natural_size: Size<Pixels>,
    ) -> Self {
        Self::Image {
            src: src.into(),
            alt: alt.into(),
            natural_size,
        }
    }

    pub fn element(
        label: impl Into<SharedString>,
        natural_size: Size<Pixels>,
        render: impl Fn(f32, &mut App) -> AnyElement + 'static,
    ) -> Self {
        Self::Element {
            label: label.into(),
            natural_size,
            render: Rc::new(render),
        }
    }

    fn natural_size(&self) -> Size<Pixels> {
        match self {
            Self::Image { natural_size, .. } | Self::Element { natural_size, .. } => *natural_size,
        }
    }
}

pub struct MediaViewerClosed;
pub struct MediaViewerChanged {
    pub index: usize,
}

/// Mount beside the opening control. `open` captures focus and `close` restores it.
/// Wheel zoom is anchored to the cursor; dragging pans; double-click toggles zoom.
pub struct MediaViewer {
    items: Vec<MediaViewerItem>,
    index: usize,
    open: bool,
    scale: f32,
    pan: Point<Pixels>,
    drag: Option<(Point<Pixels>, Point<Pixels>)>,
    bounds: Bounds<Pixels>,
    focus: FocusHandle,
    controls: Vec<FocusHandle>,
    restore: Option<FocusHandle>,
}

impl EventEmitter<MediaViewerClosed> for MediaViewer {}
impl EventEmitter<MediaViewerChanged> for MediaViewer {}
impl Focusable for MediaViewer {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus.clone()
    }
}

impl MediaViewer {
    pub fn new(items: Vec<MediaViewerItem>, cx: &mut Context<Self>) -> Self {
        Self {
            items,
            index: 0,
            open: false,
            scale: 1.,
            pan: point(px(0.), px(0.)),
            drag: None,
            bounds: Bounds::default(),
            focus: cx.focus_handle(),
            controls: (0..4).map(|_| cx.focus_handle().tab_stop(true)).collect(),
            restore: None,
        }
    }
    pub fn is_open(&self) -> bool {
        self.open
    }
    pub fn index(&self) -> usize {
        self.index
    }
    pub fn scale(&self) -> f32 {
        self.scale
    }

    pub fn open(&mut self, index: isize, window: &mut Window, cx: &mut Context<Self>) {
        if self.items.is_empty() {
            return;
        }
        if !self.open {
            self.restore = window.focused(cx);
        }
        self.index = index.rem_euclid(self.items.len() as isize) as usize;
        self.open = true;
        self.reset(cx);
        self.focus.focus(window);
    }

    pub fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        if !self.open {
            return;
        }
        self.open = false;
        self.drag = None;
        if let Some(focus) = self.restore.take() {
            focus.focus(window);
        }
        cx.emit(MediaViewerClosed);
        cx.notify();
    }

    pub fn set_items(
        &mut self,
        items: Vec<MediaViewerItem>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.items = items;
        if self.items.is_empty() {
            self.close(window, cx);
        } else {
            self.index %= self.items.len();
            self.reset(cx);
        }
    }

    pub fn step(&mut self, delta: isize, cx: &mut Context<Self>) {
        if self.items.is_empty() {
            return;
        }
        self.index = (self.index as isize + delta).rem_euclid(self.items.len() as isize) as usize;
        self.reset(cx);
        cx.emit(MediaViewerChanged { index: self.index });
    }

    pub fn reset(&mut self, cx: &mut Context<Self>) {
        self.scale = 1.;
        self.pan = point(px(0.), px(0.));
        self.drag = None;
        cx.notify();
    }

    fn zoom(&mut self, scale: f32, position: Point<Pixels>, cx: &mut Context<Self>) {
        let scale = scale.clamp(0.4, 8.);
        let center = self.bounds.center();
        let anchor = position - center;
        self.pan = anchor - (anchor - self.pan) * (scale / self.scale);
        self.scale = scale;
        cx.notify();
    }
}

impl Render for MediaViewer {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if !self.open || self.items.is_empty() {
            return div().into_any_element();
        }
        let t = theme(cx);
        let viewport = window.viewport_size();
        let panel_size = size(viewport.width * 0.9, viewport.height * 0.9);
        let content_size = size(
            (panel_size.width - px(96.)).max(px(1.)),
            (panel_size.height - px(128.)).max(px(1.)),
        );
        let item = self.items[self.index].clone();
        let natural = item.natural_size();
        let width: f32 = natural.width.max(px(1.)).into();
        let height: f32 = natural.height.max(px(1.)).into();
        let fit =
            (f32::from(content_size.width) / width).min(f32::from(content_size.height) / height);
        let fit = match item {
            MediaViewerItem::Image { .. } => fit.min(1.),
            _ => fit,
        };
        let scale = fit * self.scale;
        let displayed = size(px(width * scale), px(height * scale));
        let (caption, content) = match item {
            MediaViewerItem::Image { src, alt, .. } => (
                alt,
                img(src)
                    .id(("media-viewer-image", self.index))
                    .w(displayed.width)
                    .h(displayed.height)
                    .with_fallback(move || {
                        div()
                            .size_full()
                            .flex()
                            .items_center()
                            .justify_center()
                            .text_color(t.muted)
                            .child("Unable to load image")
                            .into_any_element()
                    })
                    .into_any_element(),
            ),
            MediaViewerItem::Element { render, .. } => (SharedString::default(), render(scale, cx)),
        };
        let bounds_entity = cx.entity().downgrade();
        let move_entity = cx.entity().downgrade();
        let content = div()
            .id("media-viewer-viewport")
            .relative()
            .w_full()
            .flex_1()
            .min_h_0()
            .overflow_hidden()
            .cursor(CursorStyle::OpenHand)
            .on_mouse_down(
                MouseButton::Left,
                cx.listener(|this, event: &MouseDownEvent, _, cx| {
                    if event.click_count == 2 {
                        if this.scale > 1. {
                            this.reset(cx);
                        } else {
                            this.zoom(2.5, event.position, cx);
                        }
                    } else {
                        this.drag = Some((event.position, this.pan));
                    }
                    cx.stop_propagation();
                }),
            )
            .on_scroll_wheel(cx.listener(|this, event: &ScrollWheelEvent, _, cx| {
                let delta: f32 = event.delta.pixel_delta(px(24.)).y.into();
                this.zoom(this.scale * (-delta * 0.008).exp(), event.position, cx);
                cx.stop_propagation();
            }))
            .child(
                div()
                    .absolute()
                    .left((panel_size.width - displayed.width) / 2. + self.pan.x)
                    .top((panel_size.height - px(112.) - displayed.height) / 2. + self.pan.y)
                    .w(displayed.width)
                    .h(displayed.height)
                    .child(content),
            )
            .child(
                canvas(
                    move |bounds, _, cx| {
                        let _ = bounds_entity.update(cx, |this, _| this.bounds = bounds);
                    },
                    move |_, _, window, _| {
                        let entity = move_entity.clone();
                        window.on_mouse_event(move |event: &MouseMoveEvent, phase, _, cx| {
                            if phase != DispatchPhase::Bubble {
                                return;
                            }
                            let _ = entity.update(cx, |this, cx| {
                                if let Some((start, pan)) = this.drag {
                                    if event.dragging() {
                                        this.pan = pan + event.position - start;
                                        cx.notify();
                                    } else {
                                        this.drag = None;
                                    }
                                }
                            });
                        });
                        let entity = move_entity.clone();
                        window.on_mouse_event(move |_: &MouseUpEvent, phase, _, cx| {
                            if phase == DispatchPhase::Bubble {
                                let _ = entity.update(cx, |this, _| this.drag = None);
                            }
                        });
                    },
                )
                .absolute()
                .size_full(),
            );
        let close = control("media-viewer-close", "Close", cx)
            .track_focus(&self.controls[3])
            .on_click(cx.listener(|this, _, window, cx| this.close(window, cx)));
        let mut footer = row().justify_between();
        if self.items.len() > 1 {
            footer = footer.child(
                row()
                    .child(
                        control("media-viewer-previous", "Previous", cx)
                            .track_focus(&self.controls[0])
                            .on_click(cx.listener(|this, _, _, cx| this.step(-1, cx))),
                    )
                    .child(label(
                        format!("{} / {}", self.index + 1, self.items.len()),
                        cx,
                    ))
                    .child(
                        control("media-viewer-next", "Next", cx)
                            .track_focus(&self.controls[1])
                            .on_click(cx.listener(|this, _, _, cx| this.step(1, cx))),
                    ),
            );
        }
        footer = footer.child(
            row()
                .child(label(format!("{:.0}%", self.scale * 100.), cx))
                .child(
                    control("media-viewer-reset", "Reset view", cx)
                        .track_focus(&self.controls[2])
                        .on_click(cx.listener(|this, _, _, cx| this.reset(cx))),
                ),
        );
        let panel = div()
            .id("media-viewer-panel")
            .occlude()
            .track_focus(&self.focus)
            .flex()
            .flex_col()
            .w(panel_size.width)
            .h(panel_size.height)
            .bg(t.surface)
            .border_1()
            .border_color(t.border)
            .rounded(px(8.))
            .overflow_hidden()
            .on_click(|_, _, cx| cx.stop_propagation())
            .capture_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                match event.keystroke.key.as_str() {
                    "escape" => this.close(window, cx),
                    "left" => this.step(-1, cx),
                    "right" => this.step(1, cx),
                    "tab" => {
                        let handles = if this.items.len() > 1 {
                            &this.controls[..]
                        } else {
                            &this.controls[2..]
                        };
                        let current = handles.iter().position(|f| f.is_focused(window));
                        let next = if event.keystroke.modifiers.shift {
                            current
                                .map(|i| (i + handles.len() - 1) % handles.len())
                                .unwrap_or(handles.len() - 1)
                        } else {
                            current.map(|i| (i + 1) % handles.len()).unwrap_or(0)
                        };
                        handles[next].focus(window);
                        window.prevent_default();
                    }
                    _ => {}
                }
                cx.stop_propagation();
            }))
            .child(
                row()
                    .h(px(56.))
                    .px(px(16.))
                    .justify_between()
                    .child(caption)
                    .child(close),
            )
            .child(content)
            .child(footer.h(px(56.)).px(px(16.)));
        let overlay = div()
            .id("media-viewer-backdrop")
            .occlude()
            .w(viewport.width)
            .h(viewport.height)
            .flex()
            .items_center()
            .justify_center()
            .bg(black().opacity(0.65))
            .on_click(cx.listener(|this, _, window, cx| {
                this.close(window, cx);
                cx.stop_propagation();
            }))
            .child(panel)
            .into_any_element();
        canvas(
            move |_, window, cx| {
                let mut overlay = overlay;
                overlay.layout_as_root(
                    size(
                        AvailableSpace::Definite(viewport.width),
                        AvailableSpace::Definite(viewport.height),
                    ),
                    window,
                    cx,
                );
                window.defer_draw(overlay, point(px(0.), px(0.)), 100);
            },
            |_, _, _, _| {},
        )
        .size_0()
        .into_any_element()
    }
}

struct MediaViewerDemo {
    viewer: Entity<MediaViewer>,
}
impl Render for MediaViewerDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label(
                "Drag to pan · scroll to zoom · double-click to enlarge",
                cx,
            ))
            .child(
                control("media-viewer-open", "Open gallery", cx).on_click(cx.listener(
                    |this, _, window, cx| {
                        this.viewer
                            .update(cx, |viewer, cx| viewer.open(0, window, cx));
                    },
                )),
            )
            .child(self.viewer.clone())
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    let viewer = cx.new(|cx| {
        MediaViewer::new(
            vec![
                MediaViewerItem::image(
                    std::path::PathBuf::from(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/demo/activity-chart.png"
                    )),
                    "Weekly activity",
                    size(px(640.), px(360.)),
                ),
                MediaViewerItem::element(
                    "Release stages",
                    size(px(520.), px(200.)),
                    |scale, cx| {
                        let t = theme(cx);
                        div()
                            .flex()
                            .flex_col()
                            .justify_center()
                            .gap(px(24. * scale))
                            .size_full()
                            .text_size(px(16. * scale))
                            .text_color(t.text)
                            .child(
                                div()
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child("Release stages"),
                            )
                            .child(div().flex().items_center().gap(px(12. * scale)).children(
                                ["Build", "→", "Test", "→", "Deploy"].into_iter().map(
                                    move |text| {
                                        div()
                                            .p(px(12. * scale))
                                            .rounded(px(6. * scale))
                                            .bg(t.inset)
                                            .child(text)
                                    },
                                ),
                            ))
                            .into_any_element()
                    },
                ),
            ],
            cx,
        )
    });
    cx.new(|_| MediaViewerDemo { viewer }).into()
}
