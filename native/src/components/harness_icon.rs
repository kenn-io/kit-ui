use gpui::{prelude::*, *};

use crate::theme::{control, label, row, stack, theme};

/// A supported harness glyph and its default brand name.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HarnessIconId {
    pub id: &'static str,
    pub label: &'static str,
}

pub const HARNESS_ICONS: &[HarnessIconId] = &[
    HarnessIconId {
        id: "claude",
        label: "Claude",
    },
    HarnessIconId {
        id: "openai",
        label: "OpenAI",
    },
    HarnessIconId {
        id: "gemini",
        label: "Gemini",
    },
    HarnessIconId {
        id: "copilot",
        label: "Copilot",
    },
    HarnessIconId {
        id: "vscode",
        label: "VS Code",
    },
    HarnessIconId {
        id: "visualstudio",
        label: "Visual Studio",
    },
    HarnessIconId {
        id: "cursor",
        label: "Cursor",
    },
    HarnessIconId {
        id: "warp",
        label: "Warp",
    },
    HarnessIconId {
        id: "qwen",
        label: "Qwen",
    },
    HarnessIconId {
        id: "deepseek",
        label: "DeepSeek",
    },
    HarnessIconId {
        id: "mistral",
        label: "Mistral",
    },
    HarnessIconId {
        id: "zed",
        label: "Zed",
    },
    HarnessIconId {
        id: "posit",
        label: "Posit",
    },
    HarnessIconId {
        id: "sourcegraph",
        label: "Sourcegraph",
    },
    HarnessIconId {
        id: "opencode",
        label: "OpenCode",
    },
    HarnessIconId {
        id: "antigravity",
        label: "Antigravity",
    },
    HarnessIconId {
        id: "kilo",
        label: "Kilo",
    },
    HarnessIconId {
        id: "kimi",
        label: "Kimi",
    },
    HarnessIconId {
        id: "kiro",
        label: "Kiro",
    },
    HarnessIconId {
        id: "openhands",
        label: "OpenHands",
    },
    HarnessIconId {
        id: "zencoder",
        label: "Zencoder",
    },
    HarnessIconId {
        id: "snowflake",
        label: "Snowflake",
    },
    HarnessIconId {
        id: "goose",
        label: "Goose",
    },
    HarnessIconId {
        id: "grok",
        label: "Grok",
    },
    HarnessIconId {
        id: "hermes",
        label: "Hermes",
    },
    HarnessIconId {
        id: "xiaomi",
        label: "Xiaomi",
    },
    HarnessIconId {
        id: "openclaw",
        label: "OpenClaw",
    },
    HarnessIconId {
        id: "pi",
        label: "Pi",
    },
    HarnessIconId {
        id: "poolside",
        label: "Poolside",
    },
    HarnessIconId {
        id: "qoder",
        label: "Qoder",
    },
    HarnessIconId {
        id: "roocode",
        label: "RooCode",
    },
    HarnessIconId {
        id: "trae",
        label: "Trae",
    },
    HarnessIconId {
        id: "aider",
        label: "Aider",
    },
    HarnessIconId {
        id: "gptme",
        label: "gptme",
    },
    HarnessIconId {
        id: "omnigent",
        label: "Omnigent",
    },
    HarnessIconId {
        id: "zai",
        label: "Z.ai",
    },
    HarnessIconId {
        id: "commandcode",
        label: "Command Code",
    },
    HarnessIconId {
        id: "codebuff",
        label: "Codebuff",
    },
    HarnessIconId {
        id: "forge",
        label: "Forge",
    },
    HarnessIconId {
        id: "iflow",
        label: "iFlow",
    },
    HarnessIconId {
        id: "omp",
        label: "OhMyPi",
    },
    HarnessIconId {
        id: "prime",
        label: "Prime Agent",
    },
    HarnessIconId {
        id: "piebald",
        label: "Piebald",
    },
    HarnessIconId {
        id: "tencent",
        label: "Tencent",
    },
    HarnessIconId {
        id: "reasonix",
        label: "Reasonix",
    },
    HarnessIconId {
        id: "shelley",
        label: "Shelley",
    },
    HarnessIconId {
        id: "workbuddy",
        label: "WorkBuddy",
    },
    HarnessIconId {
        id: "windsurf",
        label: "Windsurf",
    },
    HarnessIconId {
        id: "devin",
        label: "Devin",
    },
    HarnessIconId {
        id: "cline",
        label: "Cline",
    },
    HarnessIconId {
        id: "crush",
        label: "Crush",
    },
    HarnessIconId {
        id: "evener",
        label: "Evener",
    },
    HarnessIconId {
        id: "opencodereview",
        label: "Open Code Review",
    },
    HarnessIconId {
        id: "tau",
        label: "Tau",
    },
    HarnessIconId {
        id: "meta",
        label: "Meta",
    },
    HarnessIconId {
        id: "augure",
        label: "Augure",
    },
    HarnessIconId {
        id: "codebuddy",
        label: "CodeBuddy",
    },
    HarnessIconId {
        id: "junie",
        label: "Junie",
    },
    HarnessIconId {
        id: "omo",
        label: "OMO",
    },
    HarnessIconId {
        id: "stepfun",
        label: "StepFun",
    },
];

impl HarnessIconId {
    pub fn resolve(id: &str) -> Option<Self> {
        HARNESS_ICONS.iter().copied().find(|icon| icon.id == id)
    }
}

pub struct HarnessIcon {
    pub harness: HarnessIconId,
    pub size: f32,
    pub label: Option<SharedString>,
    pub decorative: bool,
}

impl HarnessIcon {
    pub fn new(harness: HarnessIconId) -> Self {
        Self {
            harness,
            size: 16.,
            label: None,
            decorative: false,
        }
    }

    pub fn element(self, id: impl Into<ElementId>, cx: &App) -> AnyElement {
        let path = format!(
            "{}/assets/harness-icons/{}.svg",
            env!("CARGO_MANIFEST_DIR"),
            self.harness.id
        );
        let mut element = div()
            .id(id)
            .size(px(self.size.max(1.)))
            .flex_shrink_0()
            .child(svg().path(path).size_full().text_color(theme(cx).text));
        if !self.decorative {
            let name = self.label.unwrap_or_else(|| self.harness.label.into());
            element = element.tooltip(move |_, cx| cx.new(|_| IconTooltip(name.clone())).into());
        }
        element.into_any_element()
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

struct HarnessIconDemo {
    selected: HarnessIconId,
}
impl Render for HarnessIconDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut sizes = row();
        for (index, size) in [16., 24., 40., 64.].into_iter().enumerate() {
            let mut icon = HarnessIcon::new(self.selected);
            icon.size = size;
            sizes = sizes.child(icon.element(("harness-size", index), cx));
        }
        let mut choices = row();
        for (index, harness) in HARNESS_ICONS.iter().copied().enumerate() {
            choices = choices.child(
                control(("harness-choice", index), harness.label, cx)
                    .child(HarnessIcon::new(harness).element(("harness-icon", index), cx))
                    .when(self.selected == harness, |el| {
                        el.border_color(theme(cx).accent).bg(theme(cx).inset)
                    })
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.selected = harness;
                        cx.notify();
                    })),
            );
        }
        stack()
            .child(label(self.selected.label, cx))
            .child(sizes)
            .child(choices)
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| HarnessIconDemo {
        selected: HARNESS_ICONS[0],
    })
    .into()
}
