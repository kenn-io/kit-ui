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
        let (background, ink, border) = match self.surface {
            ButtonSurface::Outline => (t.surface, accent, t.border),
            ButtonSurface::Soft => (
                t.surface.blend(accent.opacity(0.12)),
                accent,
                t.border.blend(accent.opacity(0.3)),
            ),
            ButtonSurface::Solid => (accent, t.on_accent, accent),
        };
        let (height, padding, font) = match self.size {
            ButtonSize::Small => (24., 12., 12.),
            ButtonSize::Medium => (28., 14., 13.),
            ButtonSize::Large => (36., 20., 13.),
        };
        let mut element = div()
            .id(self.id)
            .flex()
            .items_center()
            .justify_center()
            .gap(px(6.))
            .min_h(px(height))
            .px(px(padding))
            .py(px(4.))
            .rounded(px(4.))
            .border_1()
            .border_color(border)
            .bg(background)
            .text_color(ink)
            .text_size(px(font))
            .children(self.leading)
            .child(self.label)
            .children(self.trailing);
        if self.disabled {
            element = element.opacity(0.45).cursor(CursorStyle::Arrow);
        } else {
            element = element
                .cursor_pointer()
                .focusable()
                .tab_stop(true)
                .focus(|s| s.border_color(t.accent))
                .hover(move |s| s.bg(background.blend(accent.opacity(0.15))))
                .active(move |s| s.bg(background.blend(accent.opacity(0.25))));
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
