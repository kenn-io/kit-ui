use crate::components::button::{Button, ButtonSurface};
use crate::components::text_input::TextInput;
use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

/// Centered account-page surface. The application owns form and submit behavior.
#[derive(IntoElement)]
pub struct PageFrame {
    title: SharedString,
    description: Option<SharedString>,
    brand_name: SharedString,
    logo: Option<AnyElement>,
    body: Vec<AnyElement>,
    footer: Option<AnyElement>,
    min_height: Pixels,
}
impl PageFrame {
    pub fn new(title: impl Into<SharedString>) -> Self {
        Self {
            title: title.into(),
            description: None,
            brand_name: "Kenn".into(),
            logo: None,
            body: Vec::new(),
            footer: None,
            min_height: px(520.),
        }
    }
    pub fn description(mut self, description: impl Into<SharedString>) -> Self {
        self.description = Some(description.into());
        self
    }
    pub fn brand_name(mut self, name: impl Into<SharedString>) -> Self {
        self.brand_name = name.into();
        self
    }
    pub fn logo(mut self, logo: impl IntoElement) -> Self {
        self.logo = Some(logo.into_any_element());
        self
    }
    pub fn child(mut self, child: impl IntoElement) -> Self {
        self.body.push(child.into_any_element());
        self
    }
    pub fn footer(mut self, footer: impl IntoElement) -> Self {
        self.footer = Some(footer.into_any_element());
        self
    }
    pub fn min_height(mut self, height: Pixels) -> Self {
        self.min_height = height;
        self
    }
}
impl RenderOnce for PageFrame {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let mut brand = div()
            .flex()
            .items_center()
            .gap(px(12.))
            .text_size(px(18.))
            .font_weight(FontWeight::BOLD);
        if let Some(logo) = self.logo {
            brand = brand.child(div().size(px(28.)).flex_none().child(logo));
        } else if let Some(mark) = self.brand_name.trim().chars().next() {
            brand = brand.child(
                div()
                    .size(px(28.))
                    .flex_none()
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded(px(4.))
                    .bg(t.text)
                    .text_color(t.surface)
                    .text_size(px(14.))
                    .child(mark.to_string()),
            );
        }
        brand = brand.child(self.brand_name);
        let heading = div()
            .flex()
            .flex_col()
            .gap(px(12.))
            .child(
                div()
                    .text_size(px(24.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(self.title),
            )
            .children(self.description.map(|description| {
                div()
                    .text_size(px(14.))
                    .text_color(t.muted)
                    .child(description)
            }));
        let mut card = div()
            .w_full()
            .max_w(px(420.))
            .min_w_0()
            .rounded(px(12.))
            .overflow_hidden()
            .border_1()
            .border_color(t.border)
            .bg(t.surface)
            .shadow_lg()
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap(px(28.))
                    .px(px(28.))
                    .pt(px(28.))
                    .child(brand)
                    .child(heading),
            );
        if !self.body.is_empty() {
            card = card.child(
                div()
                    .px(px(28.))
                    .pt(px(24.))
                    .pb(px(28.))
                    .children(self.body),
            );
        } else {
            card = card.pb(px(28.));
        }
        if let Some(footer) = self.footer {
            card = card.child(
                div()
                    .px(px(28.))
                    .py(px(20.))
                    .border_t_1()
                    .border_color(t.border)
                    .bg(t.inset)
                    .text_size(px(12.))
                    .text_color(t.muted)
                    .child(footer),
            );
        }
        div()
            .w_full()
            .min_h(self.min_height)
            .flex()
            .items_center()
            .justify_center()
            .p(px(28.))
            .bg(t.background)
            .text_color(t.text)
            .child(card)
    }
}
struct PageFrameDemo {
    email: Entity<TextInput>,
    submitted: bool,
}
impl Render for PageFrameDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        PageFrame::new("Continue to Acme")
            .brand_name("Acme")
            .description("Use your account to continue.")
            .child(
                stack()
                    .child(label("Work email", cx))
                    .child(self.email.clone())
                    .child(
                        Button::new("page-frame-submit", "Continue")
                            .surface(ButtonSurface::Solid)
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.submitted = true;
                                cx.notify();
                            })),
                    )
                    .when(self.submitted, |body| {
                        body.child(label("Details received", cx))
                    }),
            )
            .footer("Contact your administrator if you need access.")
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| PageFrameDemo {
        email: cx.new(|cx| TextInput::new("name@example.com", cx)),
        submitted: false,
    })
    .into()
}
