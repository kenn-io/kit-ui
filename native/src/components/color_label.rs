use crate::theme::{row, stack};
use gpui::{prelude::*, *};

#[derive(IntoElement)]
pub struct ColorLabel {
    name: SharedString,
    color: u32,
    small: bool,
}
impl ColorLabel {
    pub fn new(name: impl Into<SharedString>, color: &str) -> Self {
        let hex = color.trim().trim_start_matches('#');
        let normalized = if hex.len() == 3 && hex.chars().all(|c| c.is_ascii_hexdigit()) {
            hex.chars().flat_map(|c| [c, c]).collect::<String>()
        } else {
            hex.to_owned()
        };
        let color = if normalized.len() == 6 {
            u32::from_str_radix(&normalized, 16).unwrap_or(0x6e7781)
        } else {
            0x6e7781
        };
        Self {
            name: name.into(),
            color,
            small: false,
        }
    }
    pub fn small(mut self, small: bool) -> Self {
        self.small = small;
        self
    }
}
fn luminance(color: u32) -> f32 {
    let channel = |shift| {
        let v = ((color >> shift) & 255u32) as f32 / 255.;
        if v <= 0.03928 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
}
impl RenderOnce for ColorLabel {
    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
        let bg = luminance(self.color);
        let dark = luminance(0x1f2328);
        let contrast_dark = (bg.max(dark) + 0.05) / (bg.min(dark) + 0.05);
        let contrast_white = 1.05 / (bg + 0.05);
        div()
            .flex()
            .items_center()
            .min_w_0()
            .px(px(if self.small { 6. } else { 8. }))
            .py(px(1.))
            .rounded(px(999.))
            .bg(rgb(self.color))
            .text_color(rgb(if contrast_dark >= contrast_white {
                0x1f2328
            } else {
                0xffffff
            }))
            .text_size(px(if self.small { 11. } else { 13. }))
            .font_weight(FontWeight::SEMIBOLD)
            .text_ellipsis()
            .child(self.name)
    }
}
struct Demo;
impl Render for Demo {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .child(ColorLabel::new("bug", "d73a4a"))
                    .child(ColorLabel::new("enhancement", "a2eeef"))
                    .child(ColorLabel::new("documentation", "0075ca")),
            )
            .child(
                row()
                    .child(ColorLabel::new("urgent", "f90").small(true))
                    .child(ColorLabel::new("Invalid color", "invalid")),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| Demo).into()
}
