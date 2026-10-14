use crate::theme::theme;
use gpui::{prelude::*, *};
use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag};
use std::ops::Range;

/// Native CommonMark text. HTML is omitted; images show their alt text. Fences
/// render as plain code (including Mermaid), without web syntax highlighting.
#[derive(IntoElement)]
pub struct Markdown {
    source: SharedString,
    id: ElementId,
}
impl Markdown {
    pub fn new(source: impl Into<SharedString>) -> Self {
        Self {
            source: source.into(),
            id: "markdown".into(),
        }
    }
    pub fn id(mut self, id: impl Into<ElementId>) -> Self {
        self.id = id.into();
        self
    }
}

#[derive(Clone)]
enum Kind {
    Root,
    Paragraph,
    Heading(HeadingLevel),
    Quote,
    List(Option<u64>),
    Item,
    CodeBlock,
    Strong,
    Emphasis,
    Strike,
    Link(String),
    Image,
    Table,
    Row,
    Cell,
    Text(String),
    Code(String),
    Break,
    Rule,
    Task(bool),
}
#[derive(Clone)]
struct Node {
    kind: Kind,
    children: Vec<Node>,
}
impl Node {
    fn new(kind: Kind) -> Self {
        Self {
            kind,
            children: Vec::new(),
        }
    }
}
fn parse(source: &str) -> Node {
    let mut stack = vec![Node::new(Kind::Root)];
    for event in Parser::new_ext(
        source,
        Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TABLES | Options::ENABLE_TASKLISTS,
    ) {
        let kind = match event {
            Event::Start(tag) => {
                let kind = match tag {
                    Tag::Paragraph => Kind::Paragraph,
                    Tag::Heading { level, .. } => Kind::Heading(level),
                    Tag::BlockQuote(_) => Kind::Quote,
                    Tag::List(start) => Kind::List(start),
                    Tag::Item => Kind::Item,
                    Tag::CodeBlock(_) => Kind::CodeBlock,
                    Tag::Strong => Kind::Strong,
                    Tag::Emphasis => Kind::Emphasis,
                    Tag::Strikethrough => Kind::Strike,
                    Tag::Link { dest_url, .. } => Kind::Link(dest_url.into_string()),
                    Tag::Image { .. } => Kind::Image,
                    Tag::Table(_) => Kind::Table,
                    Tag::TableHead | Tag::TableRow => Kind::Row,
                    Tag::TableCell => Kind::Cell,
                    _ => Kind::Root,
                };
                stack.push(Node::new(kind));
                continue;
            }
            Event::End(_) => {
                if stack.len() > 1 {
                    let child = stack.pop().unwrap();
                    stack.last_mut().unwrap().children.push(child);
                }
                continue;
            }
            Event::Text(text) => Kind::Text(text.into_string()),
            Event::Code(text) => Kind::Code(text.into_string()),
            Event::SoftBreak => Kind::Text(" ".into()),
            Event::HardBreak => Kind::Break,
            Event::Rule => Kind::Rule,
            Event::TaskListMarker(checked) => Kind::Task(checked),
            _ => continue,
        };
        stack.last_mut().unwrap().children.push(Node::new(kind));
    }
    stack.pop().unwrap()
}

#[derive(Default)]
struct RichText {
    text: String,
    highlights: Vec<(Range<usize>, HighlightStyle)>,
    links: Vec<(Range<usize>, String)>,
}
impl RichText {
    fn append(&mut self, text: &str, style: HighlightStyle) {
        let start = self.text.len();
        self.text.push_str(text);
        if start != self.text.len() {
            self.highlights.push((start..self.text.len(), style));
        }
    }
    fn node(&mut self, node: &Node, mut style: HighlightStyle, cx: &App) {
        let start = self.text.len();
        match &node.kind {
            Kind::Text(text) => {
                self.append(text, style);
                return;
            }
            Kind::Code(text) => {
                style.background_color = Some(theme(cx).inset);
                self.append(text, style);
                return;
            }
            Kind::Break => {
                self.append("\n", style);
                return;
            }
            Kind::Task(checked) => {
                self.append(if *checked { "☑ " } else { "☐ " }, style);
                return;
            }
            Kind::Strong => style.font_weight = Some(FontWeight::BOLD),
            Kind::Emphasis => style.font_style = Some(FontStyle::Italic),
            Kind::Strike => {
                style.strikethrough = Some(StrikethroughStyle {
                    thickness: px(1.),
                    color: None,
                })
            }
            Kind::Link(_) => {
                style.color = Some(theme(cx).accent);
                style.underline = Some(UnderlineStyle {
                    thickness: px(1.),
                    color: None,
                    wavy: false,
                });
            }
            Kind::Image => style.color = Some(theme(cx).muted),
            _ => {}
        }
        for child in &node.children {
            self.node(child, style, cx);
        }
        if let Kind::Link(url) = &node.kind {
            self.links.push((start..self.text.len(), url.clone()));
        }
    }
    fn element(self, index: usize) -> AnyElement {
        let ranges = self.links.iter().map(|(range, _)| range.clone()).collect();
        let links = self.links;
        InteractiveText::new(
            ("markdown-text", index),
            StyledText::new(self.text).with_highlights(self.highlights),
        )
        .on_click(ranges, move |index, _, cx| {
            let url = &links[index].1;
            if url.starts_with("https://")
                || url.starts_with("http://")
                || url.starts_with("mailto:")
            {
                cx.open_url(url);
            }
        })
        .into_any_element()
    }
}
fn rich(node: &Node, index: &mut usize, cx: &App) -> AnyElement {
    *index += 1;
    let mut text = RichText::default();
    text.node(node, HighlightStyle::default(), cx);
    text.element(*index)
}
fn render_node(node: &Node, index: &mut usize, cx: &App) -> AnyElement {
    let t = theme(cx);
    let column = || div().flex().flex_col().w_full().min_w_0().gap(px(8.));
    match &node.kind {
        Kind::Root | Kind::Item => {
            let mut elements = Vec::new();
            let mut paragraph = Node::new(Kind::Paragraph);
            for child in &node.children {
                if matches!(
                    child.kind,
                    Kind::Text(_)
                        | Kind::Code(_)
                        | Kind::Strong
                        | Kind::Emphasis
                        | Kind::Strike
                        | Kind::Link(_)
                        | Kind::Image
                        | Kind::Break
                        | Kind::Task(_)
                ) {
                    paragraph.children.push(child.clone());
                } else {
                    if !paragraph.children.is_empty() {
                        elements.push(render_node(&paragraph, index, cx));
                        paragraph.children.clear();
                    }
                    elements.push(render_node(child, index, cx));
                }
            }
            if !paragraph.children.is_empty() {
                elements.push(render_node(&paragraph, index, cx));
            }
            column().children(elements).into_any_element()
        }
        Kind::Paragraph => div()
            .w_full()
            .child(rich(node, index, cx))
            .into_any_element(),
        Kind::Heading(level) => {
            let size = match level {
                HeadingLevel::H1 => 28.,
                HeadingLevel::H2 => 23.,
                HeadingLevel::H3 => 19.,
                _ => 16.,
            };
            div()
                .mt(px(8.))
                .font_weight(FontWeight::SEMIBOLD)
                .text_size(px(size))
                .child(rich(node, index, cx))
                .into_any_element()
        }
        Kind::Quote => column()
            .pl(px(16.))
            .border_l_2()
            .border_color(t.border)
            .text_color(t.muted)
            .children(
                node.children
                    .iter()
                    .map(|node| render_node(node, index, cx)),
            )
            .into_any_element(),
        Kind::List(start) => column()
            .children(node.children.iter().enumerate().map(|(offset, item)| {
                let marker = start
                    .map(|start| format!("{}.", start + offset as u64))
                    .unwrap_or_else(|| "•".into());
                div()
                    .flex()
                    .gap(px(8.))
                    .child(div().w(px(28.)).flex_shrink_0().child(marker))
                    .child(div().flex_1().min_w_0().child(render_node(item, index, cx)))
            }))
            .into_any_element(),
        Kind::CodeBlock => {
            let mut text = RichText::default();
            text.node(node, HighlightStyle::default(), cx);
            div()
                .w_full()
                .p(px(16.))
                .rounded(px(6.))
                .border_1()
                .border_color(t.border)
                .bg(t.inset)
                .font_family("Menlo")
                .text_size(px(12.))
                .child(text.text.trim_end().to_owned())
                .into_any_element()
        }
        Kind::Rule => div()
            .w_full()
            .h(px(1.))
            .my(px(8.))
            .bg(t.border)
            .into_any_element(),
        Kind::Table => column()
            .gap_0()
            .children(node.children.iter().map(|row| render_node(row, index, cx)))
            .into_any_element(),
        Kind::Row => div()
            .flex()
            .w_full()
            .children(
                node.children
                    .iter()
                    .map(|cell| render_node(cell, index, cx)),
            )
            .into_any_element(),
        Kind::Cell => div()
            .flex_1()
            .min_w_0()
            .p(px(8.))
            .border_1()
            .border_color(t.border)
            .child(rich(node, index, cx))
            .into_any_element(),
        _ => rich(node, index, cx),
    }
}
impl RenderOnce for Markdown {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let document = parse(&self.source);
        let mut index = 0;
        div()
            .id(self.id)
            .w_full()
            .text_size(px(14.))
            .line_height(relative(1.6))
            .text_color(theme(cx).text)
            .child(render_node(&document, &mut index, cx))
    }
}
struct MarkdownDemo;
impl Render for MarkdownDemo {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        Markdown::new(
            "# Release notes\n\nThe **native gallery** supports *formatted prose*, `inline code`, and [GPUI documentation](https://www.gpui.rs).\n\n## Changes\n\n- Added reusable components\n- Preserved the Kit UI theme\n  - Light and dark appearances\n\n1. Select a component\n2. Try its controls\n\n> Components receive data through their public API.\n\n- [x] Native text rendering\n- [ ] Syntax highlighting\n\n```rust\nfn main() {\n    println!(\"Hello, GPUI!\");\n}\n```\n\n---\n\n| Component | Status |\n| --- | --- |\n| Markdown | Native |\n| Buttons | Interactive |",
        )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| MarkdownDemo).into()
}
