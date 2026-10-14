use crate::theme::{label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum IconButtonSize {
    Small,
    #[default]
    Medium,
}
#[derive(Clone, Copy, Default)]
pub enum IconButtonTone {
    #[default]
    Neutral,
    Success,
    Danger,
    Info,
    Workflow,
}

#[derive(IntoElement)]
pub struct IconButton {
    id: ElementId,
    label: SharedString,
    icon: SharedString,
    size: IconButtonSize,
    tone: IconButtonTone,
    disabled: bool,
    pressed: bool,
    on_click: Option<Box<dyn Fn(&ClickEvent, &mut Window, &mut App)>>,
}
impl IconButton {
    pub fn new(
        id: impl Into<ElementId>,
        label: impl Into<SharedString>,
        icon: impl Into<SharedString>,
    ) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            icon: icon.into(),
            size: IconButtonSize::Medium,
            tone: IconButtonTone::Neutral,
            disabled: false,
            pressed: false,
            on_click: None,
        }
    }
    pub fn size(mut self, value: IconButtonSize) -> Self {
        self.size = value;
        self
    }
    pub fn tone(mut self, value: IconButtonTone) -> Self {
        self.tone = value;
        self
    }
    pub fn disabled(mut self, value: bool) -> Self {
        self.disabled = value;
        self
    }
    pub fn pressed(mut self, value: bool) -> Self {
        self.pressed = value;
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
struct IconTooltip(SharedString);
impl Render for IconTooltip {
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
impl RenderOnce for IconButton {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let accent = match self.tone {
            IconButtonTone::Neutral => t.text,
            IconButtonTone::Success => t.success,
            IconButtonTone::Danger => t.danger,
            IconButtonTone::Info => t.accent,
            IconButtonTone::Workflow => t.workflow,
        };
        let size = match self.size {
            IconButtonSize::Small => 24.,
            IconButtonSize::Medium => 28.,
        };
        let tooltip = self.label;
        let mut element = div()
            .id(self.id)
            .flex()
            .items_center()
            .justify_center()
            .size(px(size))
            .flex_shrink_0()
            .rounded(px(4.))
            .text_color(if self.pressed { accent } else { t.muted })
            .when(self.pressed, |s| s.bg(t.inset))
            .tooltip(move |_, cx| cx.new(|_| IconTooltip(tooltip.clone())).into())
            .child(
                svg()
                    .path(self.icon)
                    .size(px(14.))
                    .text_color(if self.pressed { accent } else { t.muted }),
            );
        if self.disabled {
            element = element.opacity(0.45).cursor(CursorStyle::Arrow);
        } else {
            element = element
                .focusable()
                .tab_stop(true)
                .cursor_pointer()
                .hover(move |s| s.bg(t.inset).text_color(accent))
                .active(move |s| s.bg(t.inset.blend(accent.opacity(0.15))))
                .focus(|s| s.border_1().border_color(t.accent));
            if let Some(callback) = self.on_click {
                element = element.on_click(callback);
            }
        }
        element
    }
}

struct IconButtonDemo {
    count: usize,
    pinned: bool,
}
impl Render for IconButtonDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut tones = row();
        for (index, (name, icon, tone)) in [
            ("Add", "plus", IconButtonTone::Neutral),
            ("Approve", "check", IconButtonTone::Success),
            ("Remove", "x", IconButtonTone::Danger),
            ("Search", "search", IconButtonTone::Info),
            ("Refresh", "refresh", IconButtonTone::Workflow),
        ]
        .into_iter()
        .enumerate()
        {
            tones = tones.child(
                IconButton::new(
                    ("icon-tone", index),
                    name,
                    format!("{}/assets/icons/{icon}.svg", env!("CARGO_MANIFEST_DIR")),
                )
                .tone(tone)
                .on_click(cx.listener(|this, _, _, cx| {
                    this.count += 1;
                    cx.notify();
                })),
            );
        }
        stack()
            .child(label(
                "Hover for action labels. Click to count actions.",
                cx,
            ))
            .child(tones)
            .child(
                row()
                    .child(
                        IconButton::new(
                            "icon-small",
                            "Small settings",
                            concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/settings.svg"),
                        )
                        .size(IconButtonSize::Small)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.count += 1;
                            cx.notify();
                        })),
                    )
                    .child(
                        IconButton::new(
                            "icon-toggle",
                            "Toggle sidebar",
                            concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/panel-left.svg"),
                        )
                        .pressed(self.pinned)
                        .tone(IconButtonTone::Info)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.pinned = !this.pinned;
                            cx.notify();
                        })),
                    )
                    .child(
                        IconButton::new(
                            "icon-disabled",
                            "Copy unavailable",
                            concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/copy.svg"),
                        )
                        .disabled(true)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.count += 1;
                            cx.notify();
                        })),
                    ),
            )
            .child(label(
                format!(
                    "Actions: {} · Sidebar {}",
                    self.count,
                    if self.pinned { "pinned" } else { "unpinned" }
                ),
                cx,
            ))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| IconButtonDemo {
        count: 0,
        pinned: false,
    })
    .into()
}
