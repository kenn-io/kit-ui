use gpui::{prelude::*, *};

use crate::components::{
    button::{Button, ButtonSize},
    provider_brand_mark::{ProviderBrand, ProviderBrandMark},
};
use crate::theme::{label, row, stack};

/// A provider sign-in action. The caller owns authentication and handles the click.
#[derive(IntoElement)]
pub struct ProviderButton {
    id: ElementId,
    provider: ProviderBrand,
    label: SharedString,
    icon: Option<ImageSource>,
    disabled: bool,
    on_click: Option<Box<dyn Fn(&ClickEvent, &mut Window, &mut App) + 'static>>,
}

impl ProviderButton {
    pub fn new(
        id: impl Into<ElementId>,
        provider: ProviderBrand,
        label: impl Into<SharedString>,
    ) -> Self {
        Self {
            id: id.into(),
            provider,
            label: label.into(),
            icon: None,
            disabled: false,
            on_click: None,
        }
    }

    pub fn icon(mut self, icon: impl Into<ImageSource>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
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

impl RenderOnce for ProviderButton {
    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
        let mut mark = ProviderBrandMark::new(self.provider).size(20.);
        if let Some(icon) = self.icon {
            mark = mark.icon(icon);
        }
        let mut button = Button::new(self.id, self.label)
            .size(ButtonSize::Large)
            .disabled(self.disabled)
            .leading(mark.element("provider-button-mark", cx));
        if let Some(callback) = self.on_click {
            button = button.on_click(callback);
        }
        button
    }
}

struct ProviderButtonDemo {
    selected: SharedString,
    disabled: bool,
}

impl Render for ProviderButtonDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                row()
                    .child(
                        ProviderButton::new(
                            "provider-google",
                            ProviderBrand::Google,
                            "Continue with Google",
                        )
                        .disabled(self.disabled)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.selected = "Google".into();
                            cx.notify();
                        })),
                    )
                    .child(
                        ProviderButton::new(
                            "provider-sso",
                            ProviderBrand::Sso,
                            "Continue with SSO",
                        )
                        .disabled(self.disabled)
                        .on_click(cx.listener(|this, _, _, cx| {
                            this.selected = "SSO".into();
                            cx.notify();
                        })),
                    ),
            )
            .child(
                ProviderButton::new("provider-custom", ProviderBrand::Sso, "Workspace sign-in")
                    .icon(std::path::PathBuf::from(concat!(
                        env!("CARGO_MANIFEST_DIR"),
                        "/assets/harness-icons/zed.svg"
                    )))
                    .disabled(self.disabled)
                    .on_click(cx.listener(|this, _, _, cx| {
                        this.selected = "Workspace".into();
                        cx.notify();
                    })),
            )
            .child(
                Button::new(
                    "provider-disable",
                    if self.disabled {
                        "Enable sign-in"
                    } else {
                        "Disable sign-in"
                    },
                )
                .on_click(cx.listener(|this, _, _, cx| {
                    this.disabled = !this.disabled;
                    cx.notify();
                })),
            )
            .child(label(format!("Selected provider: {}", self.selected), cx))
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|_| ProviderButtonDemo {
        selected: "None".into(),
        disabled: false,
    })
    .into()
}
