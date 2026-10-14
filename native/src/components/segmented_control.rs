use std::rc::Rc;

use crate::theme::{label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy)]
pub enum SegmentedControlTone {
    Info,
    Success,
    Warning,
    Danger,
}

#[derive(Clone)]
pub struct SegmentedControlOption {
    pub value: SharedString,
    pub label: SharedString,
    pub disabled: bool,
    pub tone: Option<SegmentedControlTone>,
}

impl SegmentedControlOption {
    pub fn new(value: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            value: value.into(),
            label: label.into(),
            disabled: false,
            tone: None,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn tone(mut self, tone: SegmentedControlTone) -> Self {
        self.tone = Some(tone);
        self
    }
}

#[derive(Clone, Copy, Default)]
pub enum SegmentedControlVariant {
    #[default]
    Boxed,
    Borderless,
}

/// A controlled group. Store the focus handles with the caller's state to retain focus.
#[derive(IntoElement)]
pub struct SegmentedControl {
    id: ElementId,
    options: Vec<SegmentedControlOption>,
    value: SharedString,
    disabled: bool,
    block: bool,
    variant: SegmentedControlVariant,
    focus: Vec<FocusHandle>,
    on_change: Option<Rc<dyn Fn(&SharedString, &mut Window, &mut App)>>,
}

impl SegmentedControl {
    pub fn new(
        id: impl Into<ElementId>,
        options: Vec<SegmentedControlOption>,
        value: impl Into<SharedString>,
    ) -> Self {
        Self {
            id: id.into(),
            options,
            value: value.into(),
            disabled: false,
            block: false,
            variant: SegmentedControlVariant::Boxed,
            focus: Vec::new(),
            on_change: None,
        }
    }
    pub fn disabled(mut self, disabled: bool) -> Self {
        self.disabled = disabled;
        self
    }
    pub fn block(mut self, block: bool) -> Self {
        self.block = block;
        self
    }
    pub fn variant(mut self, variant: SegmentedControlVariant) -> Self {
        self.variant = variant;
        self
    }
    pub fn focus_handles(mut self, handles: Vec<FocusHandle>) -> Self {
        self.focus = handles;
        self
    }
    pub fn on_change(
        mut self,
        callback: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_change = Some(Rc::new(callback));
        self
    }
}

impl RenderOnce for SegmentedControl {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let t = theme(cx);
        let boxed = matches!(self.variant, SegmentedControlVariant::Boxed);
        let focus: Vec<_> = self
            .options
            .iter()
            .enumerate()
            .map(|(index, option)| {
                self.focus
                    .get(index)
                    .cloned()
                    .unwrap_or_else(|| cx.focus_handle())
                    .tab_stop(!self.disabled && !option.disabled && option.value == self.value)
            })
            .collect();
        let enabled: Vec<_> = self
            .options
            .iter()
            .enumerate()
            .filter(|(_, o)| !o.disabled)
            .map(|(index, o)| (o.value.clone(), focus[index].clone()))
            .collect();
        let mut group = div()
            .id(self.id.clone())
            .flex()
            .items_center()
            .rounded(px(4.))
            .when(boxed, |s| s.p(px(2.)).gap(px(1.)).bg(t.inset))
            .when(self.block, |s| s.w_full());
        for (index, option) in self.options.iter().enumerate() {
            let selected = option.value == self.value;
            let disabled = self.disabled || option.disabled;
            let accent = match option.tone {
                Some(SegmentedControlTone::Success) => t.success,
                Some(SegmentedControlTone::Warning) => t.warning,
                Some(SegmentedControlTone::Danger) => t.danger,
                _ => t.accent,
            };
            let mut segment = div()
                .id((self.id.clone(), index.to_string()))
                .flex()
                .items_center()
                .justify_center()
                .px(px(12.))
                .py(px(6.))
                .text_size(px(13.))
                .when(self.block, |s| s.flex_1())
                .text_color(if selected {
                    if option.tone.is_some() || !boxed {
                        accent
                    } else {
                        t.text
                    }
                } else {
                    t.muted
                })
                .when(boxed, |s| {
                    s.rounded(px(3.)).when(selected, |s| s.bg(t.surface))
                })
                .when(!boxed, |s| {
                    s.border_1()
                        .border_color(if selected { accent } else { t.border })
                        .when(selected, |s| s.bg(t.inset))
                })
                .child(option.label.clone());
            if disabled {
                segment = segment.opacity(0.45);
            } else {
                let handle = focus[index].clone();
                segment = segment
                    .track_focus(&handle)
                    .cursor_pointer()
                    .focus(|s| s.border_1().border_color(accent))
                    .hover(|s| s.bg(t.inset));
                let next_value = option.value.clone();
                let current_value = self.value.clone();
                let callback = self.on_change.clone();
                segment = segment.on_click(move |_, window, cx| {
                    handle.focus(window);
                    if next_value != current_value {
                        if let Some(callback) = &callback {
                            callback(&next_value, window, cx);
                        }
                    }
                });
                let enabled = enabled.clone();
                let current_value = self.value.clone();
                let callback = self.on_change.clone();
                segment = segment.on_key_down(move |event, window, cx| {
                    let delta = match event.keystroke.key.as_str() {
                        "left" => -1,
                        "right" => 1,
                        _ => return,
                    };
                    if enabled.is_empty() {
                        return;
                    }
                    let current = enabled
                        .iter()
                        .position(|(v, _)| *v == current_value)
                        .map(|i| i as isize)
                        .unwrap_or(-1);
                    let next = (current + delta).rem_euclid(enabled.len() as isize) as usize;
                    let (value, handle) = &enabled[next];
                    handle.focus(window);
                    if *value != current_value {
                        if let Some(callback) = &callback {
                            callback(value, window, cx);
                        }
                    }
                    cx.stop_propagation();
                });
            }
            group = group.child(segment);
        }
        group
    }
}

struct SegmentedDemo {
    view: SharedString,
    status: SharedString,
    focus: Vec<FocusHandle>,
    status_focus: Vec<FocusHandle>,
    changes: usize,
}

impl Render for SegmentedDemo {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(label("View", cx))
            .child(
                SegmentedControl::new(
                    "segment-view",
                    vec![
                        SegmentedControlOption::new("list", "List"),
                        SegmentedControlOption::new("grid", "Grid"),
                        SegmentedControlOption::new("timeline", "Timeline").disabled(true),
                    ],
                    self.view.clone(),
                )
                .focus_handles(self.focus.clone())
                .on_change(cx.listener(|this, value: &SharedString, _, cx| {
                    this.view = value.clone();
                    this.changes += 1;
                    cx.notify();
                })),
            )
            .child(label("Status", cx))
            .child(
                SegmentedControl::new(
                    "segment-status",
                    vec![
                        SegmentedControlOption::new("all", "All"),
                        SegmentedControlOption::new("passed", "Passed")
                            .tone(SegmentedControlTone::Success),
                        SegmentedControlOption::new("failed", "Failed")
                            .tone(SegmentedControlTone::Danger),
                    ],
                    self.status.clone(),
                )
                .variant(SegmentedControlVariant::Borderless)
                .block(true)
                .focus_handles(self.status_focus.clone())
                .on_change(cx.listener(|this, value: &SharedString, _, cx| {
                    this.status = value.clone();
                    this.changes += 1;
                    cx.notify();
                })),
            )
            .child(label(
                format!(
                    "View: {} · Status: {} · Changes: {}",
                    self.view, self.status, self.changes
                ),
                cx,
            ))
            .child(
                SegmentedControl::new(
                    "segment-disabled",
                    vec![
                        SegmentedControlOption::new("local", "Local"),
                        SegmentedControlOption::new("remote", "Remote"),
                    ],
                    "local",
                )
                .disabled(true),
            )
    }
}

pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| SegmentedDemo {
        view: "list".into(),
        status: "all".into(),
        changes: 0,
        focus: (0..3).map(|_| cx.focus_handle()).collect(),
        status_focus: (0..3).map(|_| cx.focus_handle()).collect(),
    })
    .into()
}
