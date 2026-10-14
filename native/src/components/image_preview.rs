use crate::components::media_viewer::{MediaViewer, MediaViewerItem};
use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// A contain-fit thumbnail backed by the same image source as its expanded viewer.
/// Sources may be native asset paths or URLs supported by GPUI's image loader.
pub struct ImagePreview {
    src: ImageSource,
    alt: SharedString,
    natural_size: Size<Pixels>,
    max_height: Pixels,
    expandable: bool,
    error_label: SharedString,
    focus: FocusHandle,
    viewer: Entity<MediaViewer>,
}

impl ImagePreview {
    pub fn new(
        src: impl Into<ImageSource>,
        alt: impl Into<SharedString>,
        natural_size: Size<Pixels>,
        cx: &mut Context<Self>,
    ) -> Self {
        let src = src.into();
        let alt = alt.into();
        let viewer = cx.new(|cx| {
            MediaViewer::new(
                vec![MediaViewerItem::image(
                    src.clone(),
                    alt.clone(),
                    natural_size,
                )],
                cx,
            )
        });
        Self {
            src,
            alt,
            natural_size,
            max_height: px(360.),
            expandable: true,
            error_label: "Unable to load image".into(),
            focus: cx.focus_handle().tab_stop(true),
            viewer,
        }
    }

    pub fn max_height(mut self, height: Pixels) -> Self {
        self.max_height = height.max(px(1.));
        self
    }

    pub fn expandable(mut self, expandable: bool) -> Self {
        self.expandable = expandable;
        self
    }

    pub fn error_label(mut self, text: impl Into<SharedString>) -> Self {
        self.error_label = text.into();
        self
    }

    /// Updating the source resets the expanded view and retries the new image.
    pub fn set_source(
        &mut self,
        src: impl Into<ImageSource>,
        alt: impl Into<SharedString>,
        natural_size: Size<Pixels>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        self.src = src.into();
        self.alt = alt.into();
        self.natural_size = natural_size;
        let items = vec![MediaViewerItem::image(
            self.src.clone(),
            self.alt.clone(),
            natural_size,
        )];
        self.viewer
            .update(cx, |viewer, cx| viewer.set_items(items, window, cx));
        cx.notify();
    }

    pub fn viewer(&self) -> Entity<MediaViewer> {
        self.viewer.clone()
    }
}

impl Render for ImagePreview {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let error = self.error_label.clone();
        let height = self.natural_size.height.min(self.max_height).max(px(1.));
        let width = self.natural_size.width
            * (f32::from(height) / f32::from(self.natural_size.height.max(px(1.))));
        let image = img(self.src.clone())
            .id("image-preview-image")
            .w(width)
            .max_w_full()
            .h(height)
            .object_fit(ObjectFit::Contain)
            .with_fallback(move || {
                div()
                    .flex()
                    .size_full()
                    .items_center()
                    .justify_center()
                    .text_color(t.muted)
                    .child(error.clone())
                    .into_any_element()
            })
            .with_loading(move || {
                div()
                    .flex()
                    .size_full()
                    .items_center()
                    .justify_center()
                    .text_color(t.muted)
                    .child("Loading image…")
                    .into_any_element()
            });
        let mut trigger = div()
            .id("image-preview-trigger")
            .relative()
            .border_1()
            .border_color(t.border)
            .child(image);
        if self.expandable {
            trigger = trigger
                .track_focus(&self.focus)
                .cursor_pointer()
                .focus(|style| style.border_color(t.accent))
                .on_click(cx.listener(|this, _, window, cx| {
                    this.viewer
                        .update(cx, |viewer, cx| viewer.open(0, window, cx));
                }))
                .child(
                    div()
                        .absolute()
                        .top(px(8.))
                        .right(px(8.))
                        .px(px(8.))
                        .py(px(4.))
                        .rounded(px(4.))
                        .bg(t.surface)
                        .text_size(px(12.))
                        .text_color(t.muted)
                        .child("Expand"),
                );
        }
        stack()
            .child(
                div()
                    .relative()
                    .w_full()
                    .min_h(px(240.))
                    .flex()
                    .items_center()
                    .justify_center()
                    .p(px(24.))
                    .bg(t.surface)
                    .child(
                        canvas(
                            |_, _, _| (),
                            move |bounds, _, window, _| {
                                let cols = (f32::from(bounds.size.width) / 10.).ceil() as usize;
                                let rows = (f32::from(bounds.size.height) / 10.).ceil() as usize;
                                for y in 0..rows {
                                    for x in 0..cols {
                                        if (x + y) % 2 == 0 {
                                            let origin = bounds.origin
                                                + point(px(x as f32 * 10.), px(y as f32 * 10.));
                                            let tile = Bounds::new(
                                                origin,
                                                size(
                                                    px(10.).min(bounds.right() - origin.x),
                                                    px(10.).min(bounds.bottom() - origin.y),
                                                ),
                                            );
                                            window.paint_quad(fill(tile, t.inset));
                                        }
                                    }
                                }
                            },
                        )
                        .absolute()
                        .size_full(),
                    )
                    .child(trigger),
            )
            .child(label(self.alt.clone(), cx))
            .child(self.viewer.clone())
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        ImagePreview::new(
            std::path::PathBuf::from(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/assets/demo/activity-chart.png"
            )),
            "Weekly activity",
            size(px(640.), px(360.)),
            cx,
        )
        .max_height(px(280.))
    })
    .into()
}
