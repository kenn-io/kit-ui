use super::icon_button::{IconButton, IconButtonTone};
use super::text_input::{InputChanged, TextInput};
use crate::theme::{control, label, row, stack};
use gpui::{prelude::*, *};
use std::time::Duration;

/// Copies text to the native clipboard and briefly displays confirmation.
pub struct CopyButton {
    text: SharedString,
    copied: bool,
    pub disabled: bool,
    pub label: SharedString,
    pub copied_label: SharedString,
    reset_task: Option<Task<()>>,
}
impl CopyButton {
    pub fn new(text: impl Into<SharedString>) -> Self {
        Self {
            text: text.into(),
            copied: false,
            disabled: false,
            label: "Copy".into(),
            copied_label: "Copied".into(),
            reset_task: None,
        }
    }

    pub fn set_text(&mut self, text: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.text = text.into();
        self.copied = false;
        self.reset_task = None;
        cx.notify();
    }

    fn copy(&mut self, _: &ClickEvent, _: &mut Window, cx: &mut Context<Self>) {
        if self.disabled {
            return;
        }
        cx.write_to_clipboard(ClipboardItem::new_string(self.text.to_string()));
        self.copied = true;
        let timer = cx.background_executor().timer(Duration::from_millis(1500));
        self.reset_task = Some(cx.spawn(async move |this, cx| {
            timer.await;
            let _ = this.update(cx, |this, cx| {
                this.copied = false;
                cx.notify();
            });
        }));
        cx.notify();
    }
}
impl Render for CopyButton {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        IconButton::new(
            "copy-button",
            if self.copied {
                self.copied_label.clone()
            } else {
                self.label.clone()
            },
            if self.copied {
                concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/check.svg")
            } else {
                concat!(env!("CARGO_MANIFEST_DIR"), "/assets/icons/copy.svg")
            },
        )
        .tone(if self.copied {
            IconButtonTone::Success
        } else {
            IconButtonTone::Neutral
        })
        .pressed(self.copied)
        .disabled(self.disabled)
        .on_click(cx.listener(Self::copy))
    }
}

struct CopyDemo {
    input: Entity<TextInput>,
    button: Entity<CopyButton>,
    disabled: Entity<CopyButton>,
    preview: Option<String>,
}
impl Render for CopyDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .max_w(px(480.))
            .child(label("Text to copy", cx))
            .child(
                row()
                    .child(div().flex_1().child(self.input.clone()))
                    .child(self.button.clone()),
            )
            .child(
                control("paste-preview", "Paste from clipboard", cx).on_click(cx.listener(
                    |this, _, _, cx| {
                        this.preview = cx.read_from_clipboard().and_then(|item| item.text());
                        cx.notify();
                    },
                )),
            )
            .child(label(
                self.preview
                    .as_ref()
                    .map(|text| format!("Clipboard: {text}"))
                    .unwrap_or_else(|| "Clipboard preview is empty".into()),
                cx,
            ))
            .child(
                row()
                    .child(label("Disabled", cx))
                    .child(self.disabled.clone()),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let input = cx.new(|cx| {
            let mut input = TextInput::new("Enter text to copy…", cx);
            input.block = true;
            input.set_value("Native Kit UI clipboard", cx);
            input
        });
        let button = cx.new(|_| CopyButton::new("Native Kit UI clipboard"));
        let copy = button.clone();
        cx.subscribe(&input, move |_, _, event: &InputChanged, cx| {
            copy.update(cx, |button, cx| button.set_text(event.text.clone(), cx));
        })
        .detach();
        let disabled = cx.new(|_| {
            let mut button = CopyButton::new("Unavailable");
            button.disabled = true;
            button
        });
        CopyDemo {
            input,
            button,
            disabled,
            preview: None,
        }
    })
    .into()
}
