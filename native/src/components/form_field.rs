use crate::{
    components::text_input::{InputChanged, TextInput},
    theme::{control, label, row, stack, theme},
};
use gpui::{prelude::*, *};

#[derive(Clone, Debug)]
pub struct FieldState {
    pub id: SharedString,
    pub label: SharedString,
    pub value: SharedString,
    pub error: Option<SharedString>,
    pub disabled: bool,
}

impl FieldState {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            value: "".into(),
            error: None,
            disabled: false,
        }
    }
}

#[derive(Clone, Debug)]
pub struct FormFieldChanged {
    pub value: SharedString,
}

/// A persistent label and caller-owned validation message around native input.
pub struct FormField {
    pub field: FieldState,
    pub input: Entity<TextInput>,
    _subscription: Subscription,
}
impl EventEmitter<FormFieldChanged> for FormField {}

impl FormField {
    pub fn new(
        field: FieldState,
        placeholder: impl Into<SharedString>,
        cx: &mut Context<Self>,
    ) -> Self {
        let input = cx.new(|cx| {
            let mut input = TextInput::new(placeholder, cx);
            input.block = true;
            input.set_value(field.value.clone(), cx);
            input.height = 36.;
            input.disabled = field.disabled;
            input.invalid = field.error.is_some();
            input
        });
        let subscription = cx.subscribe(&input, |this, _, event: &InputChanged, cx| {
            this.field.value = event.text.clone();
            cx.emit(FormFieldChanged {
                value: event.text.clone(),
            });
            cx.notify();
        });
        Self {
            field,
            input,
            _subscription: subscription,
        }
    }

    pub fn set_error(&mut self, error: Option<SharedString>, cx: &mut Context<Self>) {
        self.field.error = error;
        cx.notify();
    }

    pub fn set_value(&mut self, value: impl Into<SharedString>, cx: &mut Context<Self>) {
        self.input
            .update(cx, |input, cx| input.set_value(value, cx));
    }
}

impl Render for FormField {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        self.input.update(cx, |input, _| {
            input.disabled = self.field.disabled;
            input.invalid = self.field.error.is_some();
        });
        let input = self.input.clone();
        let disabled = self.field.disabled;
        div()
            .id(self.field.id.clone())
            .flex()
            .flex_col()
            .w_full()
            .gap(px(8.))
            .child(
                div()
                    .id("form-field-label")
                    .text_size(px(13.))
                    .font_weight(FontWeight::SEMIBOLD)
                    .text_color(t.muted)
                    .child(self.field.label.clone())
                    .on_click(move |_, window, cx| {
                        if !disabled {
                            window.focus(&input.focus_handle(cx));
                        }
                    }),
            )
            .child(self.input.clone())
            .children(
                self.field
                    .error
                    .clone()
                    .map(|error| div().text_size(px(13.)).text_color(t.danger).child(error)),
            )
    }
}

struct Demo {
    email: Entity<FormField>,
    disabled: Entity<FormField>,
    edits: usize,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .max_w(px(420.))
            .child(self.email.clone())
            .child(row().child(
                control("validate-email", "Validate", cx).on_click(cx.listener(
                    |this, _, _, cx| {
                        this.email.update(cx, |field, cx| {
                            let value = field.field.value.as_ref();
                            let valid = value.split_once('@').is_some_and(|(name, domain)| {
                                !name.is_empty() && domain.contains('.') && !domain.ends_with('.')
                            });
                            field.set_error(
                                (!valid).then(|| "Enter a complete email address.".into()),
                                cx,
                            );
                        });
                    },
                )),
            ))
            .child(self.disabled.clone())
            .child(label(format!("Edits: {}", self.edits), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let email = cx.new(|cx| {
            let mut state = FieldState::new("work-email", "Work email");
            state.value = "name@".into();
            state.error = Some("Enter a complete email address.".into());
            FormField::new(state, "name@example.com", cx)
        });
        cx.subscribe(
            &email,
            |this: &mut Demo, email, _: &FormFieldChanged, cx| {
                this.edits += 1;
                email.update(cx, |field, cx| field.set_error(None, cx));
                cx.notify();
            },
        )
        .detach();
        let disabled = cx.new(|cx| {
            let mut state = FieldState::new("organization", "Organization");
            state.value = "Example Studio".into();
            state.disabled = true;
            FormField::new(state, "", cx)
        });
        Demo {
            email,
            disabled,
            edits: 0,
        }
    })
    .into()
}
