use crate::theme::{label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum ButtonTone {
    #[default]
    Neutral,
    Success,
    Danger,
    Info,
    Workflow,
}
#[derive(Clone, Copy, Default)]
pub enum ButtonSurface {
    #[default]
    Outline,
    Soft,
    Solid,
}
#[derive(Clone, Copy, Default)]
pub enum ButtonSize {
    Small,
    #[default]
    Medium,
    Large,
}

/// A native action control with Kit UI's tone, surface, and size variants.
#[derive(IntoElement)]
pub struct Button {
    id: ElementId,
    label: SharedString,
    tone: ButtonTone,
    surface: ButtonSurface,
    size: ButtonSize,
    disabled: bool,
    leading: Option<AnyElement>,
    trailing: Option<AnyElement>,
    on_click: Option<Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>>,
}
impl Button {
    pub fn new(id: impl Into<ElementId>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            tone: ButtonTone::Neutral,
            surface: ButtonSurface::Outline,
            size: ButtonSize::Medium,
            disabled: false,
            leading: None,
            trailing: None,
            on_click: None,
        }
    }
    pub fn tone(mut self, tone: ButtonTone) -> Self {
        self.tone = tone;
        self
    }
    pub fn surface(mut self, surface: ButtonSurface) -> Self {
        self.surface = surface;
        self
    }
    pub fn size(mut self, size: ButtonSize) -> Self {
        self.size = size;
        self
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn leading(mut self, content: impl IntoElement) -> Self {
        self.leading = Some(content.into_any_element());
        self
    }
    pub fn trailing(mut self, content: impl IntoElement) -> Self {
        self.trailing = Some(content.into_any_element());
        self
    }
    pub fn on_click(
        mut self,
        callback: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Box::new(callback));
        self
    }
}
impl RenderOnce for Button {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let accent = match self.tone {
            ButtonTone::Neutral => t.text,
            ButtonTone::Success => t.success,
            ButtonTone::Danger => t.danger,
            ButtonTone::Info => t.accent,
            ButtonTone::Workflow => t.workflow,
        };
        let toned_ink = t.text.blend(accent.opacity(0.72));
        let black: Hsla = rgb(0x000000).into();
        let (background, ink, border, hover_background, hover_ink, hover_border) =
            match (self.surface, self.tone) {
                (ButtonSurface::Outline, ButtonTone::Neutral) => (
                    t.inset,
                    t.secondary,
                    t.border,
                    t.surface_hover,
                    t.text,
                    t.border,
                ),
                (ButtonSurface::Outline, ButtonTone::Danger) => (
                    t.inset,
                    t.secondary,
                    t.border,
                    t.surface.blend(accent.opacity(0.09)),
                    toned_ink,
                    t.border.blend(accent.opacity(0.30)),
                ),
                (ButtonSurface::Outline, _) => {
                    let border = t.border.blend(accent.opacity(0.40));
                    (
                        t.surface,
                        toned_ink,
                        border,
                        t.surface.blend(accent.opacity(0.08)),
                        toned_ink,
                        border,
                    )
                }
                (ButtonSurface::Soft, ButtonTone::Neutral) => (
                    t.inset.blend(t.muted.opacity(0.08)),
                    t.secondary,
                    t.border.opacity(0.80),
                    t.surface_hover,
                    t.text,
                    t.border,
                ),
                (ButtonSurface::Soft, _) => {
                    let (rest, hover) = match self.tone {
                        ButtonTone::Success | ButtonTone::Workflow => (0.12, 0.20),
                        _ => (0.10, 0.18),
                    };
                    (
                        accent.opacity(rest),
                        toned_ink,
                        accent.opacity(0.30),
                        accent.opacity(hover),
                        toned_ink,
                        accent.opacity(0.30),
                    )
                }
                (ButtonSurface::Solid, ButtonTone::Neutral) => {
                    let hover = t.background.blend(t.text.opacity(0.82));
                    (t.text, t.background, t.text, hover, t.background, hover)
                }
                (ButtonSurface::Solid, ButtonTone::Success) => {
                    let rest = black.blend(accent.opacity(0.82));
                    let hover = black.blend(accent.opacity(0.72));
                    (rest, t.surface, rest, hover, t.surface, hover)
                }
                (ButtonSurface::Solid, _) => {
                    let hover = black.blend(accent.opacity(0.88));
                    (accent, t.surface, accent, hover, t.surface, hover)
                }
            };
        let (active_background, active_border) = match (self.surface, self.tone) {
            (ButtonSurface::Solid, ButtonTone::Success) => {
                let color = black.blend(accent.opacity(0.62));
                (color, color)
            }
            (ButtonSurface::Solid, ButtonTone::Info) => {
                let color = black.blend(accent.opacity(0.78));
                (color, color)
            }
            (ButtonSurface::Soft, ButtonTone::Success) => {
                (accent.opacity(0.26), accent.opacity(0.48))
            }
            _ => (hover_background, hover_border),
        };
        let (height, padding_x, padding_y, radius, font) = match self.size {
            ButtonSize::Small => (24., 12., 2., 6., 12.),
            ButtonSize::Medium => (28., 14., 5., 4., 13.),
            ButtonSize::Large => (36., 12., 5., 4., 13.),
        };
        let mut element = div()
            .id(self.id)
            .flex()
            .items_center()
            .justify_center()
            .gap(px(6.))
            .min_h(px(height))
            .px(px(padding_x))
            .py(px(padding_y))
            .rounded(px(radius))
            .border_1()
            .border_color(border)
            .bg(background)
            .text_color(ink)
            .text_size(px(font))
            .line_height(relative(1.2))
            .font_weight(FontWeight::MEDIUM)
            .whitespace_nowrap()
            .flex_shrink_0()
            .children(self.leading)
            .child(self.label)
            .children(self.trailing);
        if self.disabled {
            element = element.opacity(0.5).cursor(CursorStyle::Arrow);
        } else {
            element = element
                .cursor_pointer()
                .focusable()
                .tab_stop(true)
                .focus(|s| s.border_color(t.accent))
                .hover(move |s| {
                    s.bg(hover_background)
                        .text_color(hover_ink)
                        .border_color(hover_border)
                })
                .active(move |s| {
                    s.relative()
                        .top(px(1.))
                        .bg(active_background)
                        .border_color(active_border)
                });
            if let Some(callback) = self.on_click {
                element = element.on_click(callback);
            }
        }
        element
    }
}

struct ButtonDemo {
    clicks: usize,
    last_action: SharedString,
    disabled: bool,
}
impl Render for ButtonDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut variants = stack();
        for (index, (name, tone)) in [
            ("Neutral", ButtonTone::Neutral),
            ("Success", ButtonTone::Success),
            ("Danger", ButtonTone::Danger),
            ("Info", ButtonTone::Info),
            ("Workflow", ButtonTone::Workflow),
        ]
        .into_iter()
        .enumerate()
        {
            let mut controls = row().child(div().w(px(90.)).child(label(name, cx)));
            for (surface_index, (surface_name, surface)) in [
                ("Outline", ButtonSurface::Outline),
                ("Soft", ButtonSurface::Soft),
                ("Solid", ButtonSurface::Solid),
            ]
            .into_iter()
            .enumerate()
            {
                controls = controls.child(
                    Button::new(("button-variant", index * 3 + surface_index), surface_name)
                        .tone(tone)
                        .surface(surface)
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.clicks += 1;
                            this.last_action = format!("{name} / {surface_name}").into();
                            cx.notify();
                        })),
                );
            }
            variants = variants.child(controls);
        }
        stack()
            .child(variants)
            .child(
                row()
                    .child(Button::new("button-small", "Small").size(ButtonSize::Small))
                    .child(Button::new("button-medium", "Medium"))
                    .child(Button::new("button-large", "Large").size(ButtonSize::Large)),
            )
            .child(
                row()
                    .child(
                        Button::new(
                            "button-disabled-toggle",
                            if self.disabled {
                                "Enable action"
                            } else {
                                "Disable action"
                            },
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.disabled = !this.disabled;
                            cx.notify();
                        })),
                    )
                    .child(
                        Button::new("button-disabled-action", "Run action")
                            .tone(ButtonTone::Info)
                            .surface(ButtonSurface::Solid)
                            .disabled(self.disabled)
                            .trailing(div().child("→"))
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.clicks += 1;
                                this.last_action = "Run action".into();
                                cx.notify();
                            })),
                    ),
            )
            .child(label(
                format!("{} clicks · Last action: {}", self.clicks, self.last_action),
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| ButtonDemo {
        clicks: 0,
        last_action: "None".into(),
        disabled: true,
    })
    .into()
}
