use gpui::{prelude::*, *};
use std::path::PathBuf;

use crate::theme::{label, row, stack, theme};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProviderBrand {
    Google,
    Sso,
}

/// Provider artwork. SSO accepts a caller-supplied native image source.
pub struct ProviderBrandMark {
    pub provider: ProviderBrand,
    pub icon: Option<ImageSource>,
    pub label: Option<SharedString>,
    pub size: f32,
}

impl ProviderBrandMark {
    pub fn new(provider: ProviderBrand) -> Self {
        Self {
            provider,
            icon: None,
            label: None,
            size: 20.,
        }
    }

    pub fn icon(mut self, icon: impl Into<ImageSource>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    pub fn label(mut self, label: impl Into<SharedString>) -> Self {
        self.label = Some(label.into());
        self
    }

    pub fn size(mut self, size: f32) -> Self {
        self.size = size.max(1.);
        self
    }

    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> AnyElement {
        let size = self.size.max(1.);
        let color = theme(cx).muted;
        let source = match self.provider {
            ProviderBrand::Google => Some(ImageSource::from(PathBuf::from(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/assets/provider-marks/google.png"
            )))),
            ProviderBrand::Sso => self.icon,
        };
        let mark = match source {
            Some(source) => img(source)
                .size_full()
                .object_fit(ObjectFit::Contain)
                .with_fallback(move || key_mark(size, color))
                .into_any_element(),
            None => key_mark(size, color),
        };
        let mut element = div().id(id).size(px(size)).flex_shrink_0().child(mark);
        if let Some(name) = self.label.filter(|name| !name.is_empty()) {
            element = element.tooltip(move |_, cx| cx.new(|_| BrandTooltip(name.clone())).into());
        }
        element.into_any_element()
    }
}

fn key_mark(size: f32, color: Hsla) -> AnyElement {
    svg()
        .path(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/assets/provider-marks/key-round.svg"
        ))
        .size(px(size))
        .text_color(color)
        .into_any_element()
}

struct BrandTooltip(SharedString);
impl Render for BrandTooltip {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        div()
            .px(px(8.))
            .py(px(4.))
            .rounded(px(4.))
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .text_color(t.text)
            .text_size(px(12.))
            .child(self.0.clone())
    }
}

struct BrandMarkDemo;
impl Render for BrandMarkDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut google = row();
        let mut sso = row();
        for (index, size) in [16., 20., 32., 48.].into_iter().enumerate() {
            google = google.child(
                ProviderBrandMark::new(ProviderBrand::Google)
                    .size(size)
                    .label("Google")
                    .element(("google-mark", index), cx),
            );
            sso = sso.child(
                ProviderBrandMark::new(ProviderBrand::Sso)
                    .size(size)
                    .label("Enterprise SSO")
                    .element(("sso-mark", index), cx),
            );
        }
        stack()
            .child(label("Google", cx))
            .child(google)
            .child(label("Enterprise SSO", cx))
            .child(sso)
            .child(label("Custom SSO artwork", cx))
            .child(
                ProviderBrandMark::new(ProviderBrand::Sso)
                    .size(32.)
                    .label("Workspace")
                    .icon(PathBuf::from(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/harness-icons/zed.svg"
                    )))
                    .element("custom-sso-mark", cx),
            )
            .child(label("Unavailable SSO artwork", cx))
            .child(
                ProviderBrandMark::new(ProviderBrand::Sso)
                    .size(32.)
                    .icon(PathBuf::from(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/provider-marks/unavailable.svg"
                    )))
                    .element("missing-sso-mark", cx),
            )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| BrandMarkDemo).into()
}
