use gpui::{prelude::*, *};

#[derive(Clone, Copy)]
pub struct Theme {
    pub background: Hsla,
    pub surface: Hsla,
    pub inset: Hsla,
    pub surface_hover: Hsla,
    pub border_muted: Hsla,
    pub secondary: Hsla,
    pub border: Hsla,
    pub text: Hsla,
    pub muted: Hsla,
    pub accent: Hsla,
    pub success: Hsla,
    pub danger: Hsla,
    pub warning: Hsla,
    pub workflow: Hsla,
    pub workspace: Hsla,
    pub waiting: Hsla,
    pub on_accent: Hsla,
}
impl Global for Theme {}
impl Theme {
    pub fn light() -> Self {
        Self {
            background: rgb(0xf5f6f8).into(),
            surface: rgb(0xffffff).into(),
            inset: rgb(0xecedf2).into(),
            surface_hover: rgb(0xf0f1f4).into(),
            border_muted: rgb(0xe4e6ec).into(),
            secondary: rgb(0x555b6e).into(),
            border: rgb(0xd8dae2).into(),
            text: rgb(0x181b24).into(),
            muted: rgb(0x878ea0).into(),
            accent: rgb(0x2563eb).into(),
            success: rgb(0x059669).into(),
            danger: rgb(0xdc2626).into(),
            warning: rgb(0xd97706).into(),
            workflow: rgb(0x7c3aed).into(),
            workspace: rgb(0x0891b2).into(),
            waiting: rgb(0xa48a55).into(),
            on_accent: rgb(0xffffff).into(),
        }
    }
    pub fn dark() -> Self {
        Self {
            background: rgb(0x0d0d12).into(),
            surface: rgb(0x16161e).into(),
            inset: rgb(0x111116).into(),
            surface_hover: rgb(0x1f1f2a).into(),
            border_muted: rgb(0x2a2a3a).into(),
            secondary: rgb(0xb4bcd0).into(),
            border: rgb(0x333345).into(),
            text: rgb(0xececf1).into(),
            muted: rgb(0x8b93a8).into(),
            accent: rgb(0x60a5fa).into(),
            success: rgb(0x4ade80).into(),
            danger: rgb(0xf87171).into(),
            warning: rgb(0xfbbf24).into(),
            workflow: rgb(0xa78bfa).into(),
            workspace: rgb(0x22d3ee).into(),
            waiting: rgb(0xc4a76a).into(),
            on_accent: rgb(0x0d0d12).into(),
        }
    }
}
pub fn theme(cx: &App) -> Theme {
    *cx.global::<Theme>()
}
pub fn stack() -> Div {
    div().flex().flex_col().gap(px(16.))
}
pub fn row() -> Div {
    div().flex().items_center().gap(px(8.)).flex_wrap()
}
pub fn label(text: impl Into<SharedString>, cx: &App) -> Div {
    div()
        .text_size(px(13.))
        .text_color(theme(cx).muted)
        .child(text.into())
}
pub fn control(id: impl Into<ElementId>, text: impl Into<SharedString>, cx: &App) -> Stateful<Div> {
    let t = theme(cx);
    div()
        .id(id)
        .flex()
        .items_center()
        .justify_center()
        .px(px(12.))
        .py(px(6.))
        .rounded(px(4.))
        .border_1()
        .border_color(t.border)
        .bg(t.surface)
        .text_color(t.text)
        .text_size(px(13.))
        .cursor_pointer()
        .focusable()
        .tab_stop(true)
        .focus(|s| s.border_color(t.accent))
        .hover(|s| s.bg(t.inset))
        .child(text.into())
}
