use gpui::{prelude::*, *};

use crate::theme::{control, label, row, stack, theme};

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum KeyJoiner {
    #[default]
    Compact,
    Plus,
}

/// A shortcut label using caller-provided key names or platform glyphs.
pub struct KbdBadge {
    pub keys: Vec<SharedString>,
    pub joiner: KeyJoiner,
    pub label: Option<SharedString>,
}

impl KbdBadge {
    pub fn new(keys: impl IntoIterator<Item = impl Into<SharedString>>) -> Self {
        Self {
            keys: keys.into_iter().map(Into::into).collect(),
            joiner: KeyJoiner::Compact,
            label: None,
        }
    }

    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> Stateful<Div> {
        let t = theme(cx);
        let separator = match self.joiner {
            KeyJoiner::Compact => "",
            KeyJoiner::Plus => "+",
        };
        let keys: Vec<&str> = self.keys.iter().map(|key| key.as_ref()).collect();
        let glyph = keys.join(separator);
        let description = self.label.unwrap_or_else(|| keys.join(" ").into());
        let mut badge = div()
            .id(id)
            .flex()
            .items_center()
            .px(px(5.))
            .py(px(1.))
            .rounded(px(3.))
            .border_1()
            .border_color(t.border)
            .bg(t.inset)
            .text_color(t.muted)
            .text_size(px(12.))
            .child(glyph)
            .tooltip(move |_, cx| cx.new(|_| ShortcutDescription(description.clone())).into());
        if self.joiner == KeyJoiner::Plus {
            badge = badge.font_family("monospace");
        }
        badge
    }
}

struct ShortcutDescription(SharedString);
impl Render for ShortcutDescription {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .px(px(8.))
            .py(px(4.))
            .rounded(px(4.))
            .bg(theme(cx).surface)
            .text_color(theme(cx).text)
            .text_size(px(12.))
            .child(self.0.clone())
    }
}

struct KbdBadgeDemo {
    plus: bool,
}
impl Render for KbdBadgeDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut mac = KbdBadge::new(["⌘", "K"]);
        mac.label = Some("Command K".into());
        let mut command = KbdBadge::new(["⌘", "⇧", "P"]);
        command.label = Some("Command Shift P".into());
        let mut windows = KbdBadge::new(["Ctrl", "Shift", "P"]);
        windows.joiner = KeyJoiner::Plus;
        let mut configurable = KbdBadge::new(["Ctrl", "K"]);
        configurable.joiner = if self.plus {
            KeyJoiner::Plus
        } else {
            KeyJoiner::Compact
        };
        stack()
            .child(label("macOS", cx))
            .child(
                row()
                    .child(mac.element("kbd-mac-search", cx))
                    .child(command.element("kbd-mac-command", cx)),
            )
            .child(label("Windows / Linux", cx))
            .child(
                row()
                    .child(windows.element("kbd-windows-command", cx))
                    .child(KbdBadge::new(["Esc"]).element("kbd-escape", cx)),
            )
            .child(
                row()
                    .child(configurable.element("kbd-configurable", cx))
                    .child(
                        control(
                            "kbd-joiner",
                            if self.plus {
                                "Use compact format"
                            } else {
                                "Use plus format"
                            },
                            cx,
                        )
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.plus = !this.plus;
                            cx.notify();
                        })),
                    ),
            )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| KbdBadgeDemo { plus: true }).into()
}
