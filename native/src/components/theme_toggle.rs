use std::rc::Rc;

use crate::components::segmented_control::{SegmentedControl, SegmentedControlOption};
use crate::theme::{Theme, control, label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum ThemeMode {
    Light,
    Dark,
    #[default]
    System,
}
impl ThemeMode {
    pub fn next(self) -> Self {
        match self {
            Self::Light => Self::Dark,
            Self::Dark => Self::System,
            Self::System => Self::Light,
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Self::Light => "Light",
            Self::Dark => "Dark",
            Self::System => "System",
        }
    }
    pub fn is_dark(self, window: &Window) -> bool {
        match self {
            Self::Light => false,
            Self::Dark => true,
            Self::System => matches!(
                window.appearance(),
                WindowAppearance::Dark | WindowAppearance::VibrantDark
            ),
        }
    }
    /// Apply the selected mode. A caller using System should also observe appearance changes.
    pub fn apply(self, window: &Window, cx: &mut App) {
        cx.set_global(if self.is_dark(window) {
            Theme::dark()
        } else {
            Theme::light()
        });
        cx.refresh_windows();
    }
}

#[derive(Clone, Copy, Default)]
pub enum ThemeToggleVariant {
    #[default]
    Cycle,
    Segmented,
}

/// Controlled theme selector; the caller owns the selected mode and applies changes.
#[derive(IntoElement)]
pub struct ThemeToggle {
    id: ElementId,
    mode: ThemeMode,
    variant: ThemeToggleVariant,
    block: bool,
    small: bool,
    labels: [SharedString; 3],
    focus: Vec<FocusHandle>,
    on_change: Option<Rc<dyn Fn(&ThemeMode, &mut Window, &mut App)>>,
}
impl ThemeToggle {
    pub fn new(id: impl Into<ElementId>, mode: ThemeMode) -> Self {
        Self {
            id: id.into(),
            mode,
            variant: ThemeToggleVariant::Cycle,
            block: false,
            small: false,
            labels: ["Light".into(), "Dark".into(), "System".into()],
            focus: Vec::new(),
            on_change: None,
        }
    }
    pub fn variant(mut self, variant: ThemeToggleVariant) -> Self {
        self.variant = variant;
        self
    }
    pub fn block(mut self, block: bool) -> Self {
        self.block = block;
        self
    }
    pub fn small(mut self, small: bool) -> Self {
        self.small = small;
        self
    }
    pub fn labels(
        mut self,
        light: impl Into<SharedString>,
        dark: impl Into<SharedString>,
        system: impl Into<SharedString>,
    ) -> Self {
        self.labels = [light.into(), dark.into(), system.into()];
        self
    }
    pub fn focus_handles(mut self, focus: Vec<FocusHandle>) -> Self {
        self.focus = focus;
        self
    }
    pub fn on_change(
        mut self,
        callback: impl Fn(&ThemeMode, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_change = Some(Rc::new(callback));
        self
    }
}
impl RenderOnce for ThemeToggle {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let current = match self.mode {
            ThemeMode::Light => 0,
            ThemeMode::Dark => 1,
            ThemeMode::System => 2,
        };
        match self.variant {
            ThemeToggleVariant::Segmented => {
                let callback = self.on_change;
                SegmentedControl::new(
                    self.id,
                    vec![
                        SegmentedControlOption::new("light", self.labels[0].clone()),
                        SegmentedControlOption::new("dark", self.labels[1].clone()),
                        SegmentedControlOption::new("system", self.labels[2].clone()),
                    ],
                    ["light", "dark", "system"][current],
                )
                .block(self.block)
                .focus_handles(self.focus)
                .on_change(move |value, window, cx| {
                    let mode = match value.as_ref() {
                        "light" => ThemeMode::Light,
                        "dark" => ThemeMode::Dark,
                        _ => ThemeMode::System,
                    };
                    if let Some(callback) = &callback {
                        callback(&mode, window, cx);
                    }
                })
                .into_any_element()
            }
            ThemeToggleVariant::Cycle => {
                let next = self.mode.next();
                let focus = self
                    .focus
                    .first()
                    .cloned()
                    .unwrap_or_else(|| cx.focus_handle())
                    .tab_stop(true);
                let callback = self.on_change;
                control(self.id, ["☼", "☾", "▣"][current], cx)
                    .track_focus(&focus)
                    .size(px(if self.small { 24. } else { 28. }))
                    .px(px(0.))
                    .py(px(0.))
                    .tooltip(move |_, cx| {
                        let text: SharedString =
                            format!("Change theme (current: {})", self.labels[current]).into();
                        cx.new(|_| ThemeHint(text)).into()
                    })
                    .on_click(move |_, window, cx| {
                        focus.focus(window);
                        if let Some(callback) = &callback {
                            callback(&next, window, cx);
                        }
                    })
                    .into_any_element()
            }
        }
    }
}
struct ThemeHint(SharedString);
impl Render for ThemeHint {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        div()
            .p(px(8.))
            .rounded(px(4.))
            .bg(t.surface)
            .border_1()
            .border_color(t.border)
            .text_color(t.text)
            .text_size(px(12.))
            .child(self.0.clone())
    }
}
struct ThemeToggleDemo {
    mode: ThemeMode,
    focus: Vec<FocusHandle>,
    cycle_focus: FocusHandle,
    appearance: Option<Subscription>,
}
impl Render for ThemeToggleDemo {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.appearance.is_none() {
            self.appearance = Some(cx.observe_window_appearance(window, |this, window, cx| {
                if this.mode == ThemeMode::System {
                    this.mode.apply(window, cx);
                    cx.notify();
                }
            }));
        }
        stack()
            .child(
                row().child(label("Appearance", cx)).child(
                    ThemeToggle::new("theme-cycle", self.mode)
                        .focus_handles(vec![self.cycle_focus.clone()])
                        .on_change(cx.listener(|this, mode, window, cx| {
                            this.mode = *mode;
                            mode.apply(window, cx);
                            cx.notify();
                        })),
                ),
            )
            .child(
                ThemeToggle::new("theme-segments", self.mode)
                    .variant(ThemeToggleVariant::Segmented)
                    .focus_handles(self.focus.clone())
                    .on_change(cx.listener(|this, mode, window, cx| {
                        this.mode = *mode;
                        mode.apply(window, cx);
                        cx.notify();
                    })),
            )
            .child(label(format!("Selected: {}", self.mode.label()), cx))
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    let dark = theme(cx).background.l < 0.5;
    cx.new(|cx| ThemeToggleDemo {
        mode: if dark {
            ThemeMode::Dark
        } else {
            ThemeMode::Light
        },
        focus: (0..3).map(|_| cx.focus_handle()).collect(),
        cycle_focus: cx.focus_handle(),
        appearance: None,
    })
    .into()
}
