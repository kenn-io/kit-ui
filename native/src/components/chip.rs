use crate::theme::{label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Default)]
pub enum ChipSize {
    Xs,
    Sm,
    #[default]
    Md,
}
#[derive(Clone, Copy, Default)]
pub enum ChipTone {
    Muted,
    #[default]
    Neutral,
    Success,
    Warning,
    Danger,
    Info,
    Merged,
    Canceled,
    Workspace,
}

/// Compact status label. Interactive chips accept a click handler on the returned element.
pub struct Chip {
    pub text: SharedString,
    pub size: ChipSize,
    pub tone: ChipTone,
    pub dot: bool,
    pub uppercase: bool,
    pub interactive: bool,
    pub disabled: bool,
    pub trailing: Option<SharedString>,
}
impl Chip {
    pub fn new(text: impl Into<SharedString>) -> Self {
        Self {
            text: text.into(),
            size: ChipSize::Md,
            tone: ChipTone::Neutral,
            dot: false,
            uppercase: true,
            interactive: false,
            disabled: false,
            trailing: None,
        }
    }
    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> Stateful<Div> {
        let t = theme(cx);
        let accent = match self.tone {
            ChipTone::Success => t.success,
            ChipTone::Warning => t.warning,
            ChipTone::Danger => t.danger,
            ChipTone::Info => t.accent,
            ChipTone::Merged => t.workflow,
            ChipTone::Workspace => t.workspace,
            _ => t.muted,
        };
        let (background, ink) = match self.tone {
            ChipTone::Muted => (t.inset, t.inset.blend(t.muted.opacity(0.75))),
            ChipTone::Neutral => (t.inset, t.muted),
            ChipTone::Canceled => (t.muted.opacity(0.15), t.muted),
            _ => (accent.opacity(0.15), t.text.blend(accent.opacity(0.65))),
        };
        let (height, font, padding, dot_size) = match self.size {
            ChipSize::Xs => (16., 10., 6., 5.),
            ChipSize::Sm => (18., 11., 6., 6.),
            ChipSize::Md => (22., 13., 8., 6.),
        };
        let text = if self.uppercase {
            SharedString::from(self.text.to_uppercase())
        } else {
            self.text
        };
        let mut element = div()
            .id(id)
            .flex()
            .items_center()
            .justify_center()
            .gap(px(4.))
            .min_h(px(height))
            .px(px(padding))
            .rounded(px(999.))
            .bg(background)
            .text_color(ink)
            .text_size(px(font))
            .font_weight(FontWeight::SEMIBOLD);
        if self.dot {
            element = element.child(
                div()
                    .size(px(dot_size))
                    .flex_shrink_0()
                    .rounded_full()
                    .bg(ink),
            );
        }
        element = element.child(div().truncate().child(text));
        if let Some(trailing) = self.trailing {
            element = element.child(div().flex_shrink_0().child(trailing));
        }
        if self.disabled {
            element = element.opacity(0.45);
        } else if self.interactive {
            element = element.cursor_pointer().hover(|s| s.opacity(0.8));
        }
        element
    }
}

struct ChipDemo {
    clicks: usize,
}
impl Render for ChipDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let tones = [
            ("Muted", ChipTone::Muted),
            ("Neutral", ChipTone::Neutral),
            ("Success", ChipTone::Success),
            ("Warning", ChipTone::Warning),
            ("Danger", ChipTone::Danger),
            ("Info", ChipTone::Info),
            ("Merged", ChipTone::Merged),
            ("Canceled", ChipTone::Canceled),
            ("Workspace", ChipTone::Workspace),
        ];
        let mut variants = row();
        for (index, (text, tone)) in tones.into_iter().enumerate() {
            let mut chip = Chip::new(text);
            chip.tone = tone;
            chip.dot = true;
            variants = variants.child(chip.element(("chip-tone", index), cx));
        }
        let mut sizes = row();
        for (index, size) in [ChipSize::Xs, ChipSize::Sm, ChipSize::Md]
            .into_iter()
            .enumerate()
        {
            let mut chip = Chip::new(["Extra small", "Small", "Medium"][index]);
            chip.size = size;
            chip.dot = true;
            chip.tone = ChipTone::Info;
            sizes = sizes.child(chip.element(("chip-size", index), cx));
        }
        let mut interactive = Chip::new("Choose workspace");
        interactive.uppercase = false;
        interactive.interactive = true;
        interactive.tone = ChipTone::Workspace;
        interactive.trailing = Some("▾".into());
        let mut disabled = Chip::new("Unavailable");
        disabled.disabled = true;
        disabled.interactive = true;
        stack()
            .child(label("Tones", cx))
            .child(variants)
            .child(label("Sizes", cx))
            .child(sizes)
            .child(
                row()
                    .child(
                        interactive
                            .element("chip-interactive", cx)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.clicks += 1;
                                cx.notify();
                            })),
                    )
                    .child(disabled.element("chip-disabled", cx)),
            )
            .child(label(format!("Workspace selections: {}", self.clicks), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| ChipDemo { clicks: 0 }).into()
}
