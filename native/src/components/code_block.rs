use super::copy_button::CopyButton;
use crate::theme::{Theme, control, label, row, stack, theme};
use gpui::{prelude::*, *};

/// A native, scrollable code panel with optional numbers and clipboard actions.
pub struct CodeBlock {
    code: SharedString,
    language: Option<SharedString>,
    title: Option<SharedString>,
    line_numbers: bool,
    wrap: bool,
    wrap_toggle: bool,
    copyable: bool,
    max_height: Pixels,
    copy_button: Option<Entity<CopyButton>>,
}

impl CodeBlock {
    pub fn new(code: impl Into<SharedString>) -> Self {
        Self {
            code: code.into(),
            language: None,
            title: None,
            line_numbers: false,
            wrap: false,
            wrap_toggle: true,
            copyable: true,
            max_height: px(320.),
            copy_button: None,
        }
    }
    pub fn language(mut self, language: impl Into<SharedString>) -> Self {
        self.language = Some(language.into());
        self
    }
    pub fn title(mut self, title: impl Into<SharedString>) -> Self {
        self.title = Some(title.into());
        self
    }
    pub fn line_numbers(mut self, show: bool) -> Self {
        self.line_numbers = show;
        self
    }
    pub fn wrap(mut self, wrap: bool) -> Self {
        self.wrap = wrap;
        self
    }
    pub fn wrap_toggle(mut self, show: bool) -> Self {
        self.wrap_toggle = show;
        self
    }
    pub fn copyable(mut self, copyable: bool) -> Self {
        self.copyable = copyable;
        self
    }
    pub fn max_height(mut self, height: Pixels) -> Self {
        self.max_height = height;
        self
    }
    pub fn set_code(&mut self, code: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.code = code.into();
        if let Some(button) = &self.copy_button {
            button.update(cx, |button, cx| button.set_text(self.code.clone(), cx));
        }
        cx.notify();
    }
}

fn syntax_runs(line: &str, language: Option<&str>, t: Theme) -> Vec<TextRun> {
    let highlight = matches!(
        language,
        Some("rust" | "rs" | "javascript" | "js" | "typescript" | "ts" | "jsx" | "tsx")
    );
    let mut runs = Vec::new();
    let mut offset = 0;
    while offset < line.len() {
        let start = offset;
        let rest = &line[offset..];
        let first = rest.chars().next().unwrap();
        let mut color = t.text;
        if highlight && rest.starts_with("//") {
            offset = line.len();
            color = t.muted;
        } else if highlight && matches!(first, '\'' | '"' | '`') {
            offset += first.len_utf8();
            let mut escaped = false;
            for ch in line[offset..].chars() {
                offset += ch.len_utf8();
                if !escaped && ch == first {
                    break;
                }
                escaped = !escaped && ch == '\\';
            }
            color = t.success;
        } else if highlight && (first.is_alphabetic() || first == '_') {
            offset += first.len_utf8();
            for ch in line[offset..].chars() {
                if !ch.is_alphanumeric() && ch != '_' {
                    break;
                }
                offset += ch.len_utf8();
            }
            if matches!(
                &line[start..offset],
                "fn" | "pub"
                    | "use"
                    | "let"
                    | "mut"
                    | "impl"
                    | "struct"
                    | "enum"
                    | "trait"
                    | "self"
                    | "Self"
                    | "match"
                    | "if"
                    | "else"
                    | "return"
                    | "async"
                    | "await"
                    | "const"
                    | "function"
                    | "export"
                    | "import"
                    | "from"
                    | "class"
                    | "new"
                    | "true"
                    | "false"
                    | "null"
                    | "for"
                    | "while"
                    | "in"
                    | "type"
                    | "interface"
            ) {
                color = t.workflow;
            }
        } else {
            offset += first.len_utf8();
            if highlight && first.is_ascii_digit() {
                color = t.warning;
            }
        }
        runs.push(TextRun {
            len: offset - start,
            font: font("Menlo"),
            color,
            background_color: None,
            underline: None,
            strikethrough: None,
        });
    }
    runs
}

impl Render for CodeBlock {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        if self.copyable && self.copy_button.is_none() {
            self.copy_button = Some(cx.new(|_| {
                let mut button = CopyButton::new(self.code.clone());
                button.label = "Copy code".into();
                button
            }));
        }
        let header_label = self.title.as_ref().or(self.language.as_ref()).cloned();
        let mut panel = div()
            .w_full()
            .min_w_0()
            .rounded(px(6.))
            .border_1()
            .border_color(t.border)
            .bg(t.inset)
            .overflow_hidden();
        if header_label.is_some() || self.copyable || self.wrap_toggle {
            let mut actions = row();
            if self.wrap_toggle {
                actions = actions.child(
                    control("code-wrap", if self.wrap { "Unwrap" } else { "Wrap" }, cx)
                        .when(self.wrap, |el| el.border_color(t.accent))
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.wrap = !this.wrap;
                            cx.notify();
                        })),
                );
            }
            if self.copyable {
                actions = actions.child(self.copy_button.as_ref().unwrap().clone());
            }
            panel = panel.child(
                row()
                    .justify_between()
                    .px(px(12.))
                    .py(px(6.))
                    .border_b_1()
                    .border_color(t.border)
                    .child(label(header_label.unwrap_or_default(), cx))
                    .child(actions),
            );
        }
        let mut lines: Vec<&str> = self.code.split('\n').collect();
        if lines.len() > 1 && lines.last() == Some(&"") {
            lines.pop();
        }
        let width = lines
            .iter()
            .map(|line| line.chars().count())
            .max()
            .unwrap_or(0) as f32
            * 8.
            + if self.line_numbers { 64. } else { 0. };
        let content = div()
            .flex()
            .flex_col()
            .gap_0()
            .p(px(16.))
            .when(!self.wrap, |el| el.min_w(px(width + 32.)))
            .children(lines.into_iter().enumerate().map(|(index, line)| {
                div()
                    .flex()
                    .min_h(px(21.))
                    .text_size(px(13.))
                    .line_height(px(21.))
                    .font_family("Menlo")
                    .when(self.line_numbers, |el| {
                        el.child(
                            div()
                                .w(px(40.))
                                .flex_shrink_0()
                                .text_right()
                                .pr(px(16.))
                                .text_color(t.muted)
                                .child((index + 1).to_string()),
                        )
                    })
                    .child(
                        div()
                            .min_w_0()
                            .when(self.wrap, |el| el.flex_1())
                            .when(!self.wrap, |el| el.whitespace_nowrap())
                            .child(StyledText::new(line.to_string()).with_runs(syntax_runs(
                                line,
                                self.language.as_ref().map(|v| v.as_ref()),
                                t,
                            ))),
                    )
            }));
        panel.child(
            div()
                .id("code-scroll")
                .max_h(self.max_height)
                .overflow_scroll()
                .child(content),
        )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    struct Demo {
        rust: Entity<CodeBlock>,
        javascript: Entity<CodeBlock>,
        plain: Entity<CodeBlock>,
    }
    impl Render for Demo {
        fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
            stack()
                .child(self.rust.clone())
                .child(self.javascript.clone())
                .child(self.plain.clone())
        }
    }
    cx.new(|cx| Demo {
        rust: cx.new(|_| CodeBlock::new("// A native GPUI view\nuse gpui::{prelude::*, *};\n\npub struct Greeting;\n\nimpl Render for Greeting {\n    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {\n        div().child(\"Hello from Kit UI\")\n    }\n}\n").language("rust").title("greeting.rs").line_numbers(true).max_height(px(210.))),
        javascript: cx.new(|_| CodeBlock::new("const components = ['Button', 'CodeBlock', 'Calendar'];\nexport function greet(name) {\n  // Unicode stays intact: café, 日本語\n  return `Hello, ${name}! These components render in a native desktop window.`;\n}").language("js").title("greeting.js").wrap(true).line_numbers(true)),
        plain: cx.new(|_| CodeBlock::new("$ cargo run --manifest-path native/Cargo.toml\nKit UI GPUI gallery").title("Terminal").wrap_toggle(false)),
    }).into()
}
