use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone)]
pub struct SidebarView {
    pub id: SharedString,
    pub label: SharedString,
    pub href: SharedString,
}
#[derive(Clone)]
pub struct SidebarViewRun {
    pub heading: Option<SharedString>,
    pub views: Vec<SidebarView>,
}
#[derive(Clone)]
pub struct SidebarSection {
    pub id: SharedString,
    pub label: SharedString,
    pub href: SharedString,
    pub icon: SharedString,
    pub view_runs: Vec<SidebarViewRun>,
}
#[derive(Clone)]
pub struct SidebarGroup {
    pub label: Option<SharedString>,
    pub sections: Vec<SidebarSection>,
}
#[derive(Clone, Default, Debug)]
pub struct SidebarLocation {
    pub section: Option<SharedString>,
    pub view: Option<SharedString>,
}
#[derive(Clone, Debug)]
pub struct SidebarNavigate {
    pub location: SidebarLocation,
    pub href: SharedString,
}
#[derive(Clone, Copy, Default, PartialEq)]
pub enum SidebarMode {
    #[default]
    Auto,
    Expanded,
    Rail,
    Drawer,
}
/// Slot factories receive whether the panel is an icon rail.
type SidebarSlot = Box<dyn Fn(bool, &mut Window, &mut App) -> AnyElement>;

/// Desktop navigation with grouped sections, nested views, rail flyouts and a drawer.
/// Navigation emits SidebarNavigate; the host decides whether to change a route or open a URL.
pub struct AppSidebar {
    pub groups: Vec<SidebarGroup>,
    pub location: SidebarLocation,
    pub mode: SidebarMode,
    pub pinned: bool,
    brand: Option<SidebarSlot>,
    footer: Option<SidebarSlot>,
    narrow_bar: Option<SidebarSlot>,
    drawer_open: bool,
    flyout: Option<SharedString>,
    focus: FocusHandle,
    drawer_focus: FocusHandle,
}
impl EventEmitter<SidebarNavigate> for AppSidebar {}
impl AppSidebar {
    pub fn new(groups: Vec<SidebarGroup>, cx: &mut Context<Self>) -> Self {
        Self {
            groups,
            location: SidebarLocation::default(),
            mode: SidebarMode::Auto,
            pinned: false,
            brand: None,
            footer: None,
            narrow_bar: None,
            drawer_open: false,
            flyout: None,
            focus: cx.focus_handle(),
            drawer_focus: cx.focus_handle(),
        }
    }
    pub fn brand(
        mut self,
        slot: impl Fn(bool, &mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.brand = Some(Box::new(slot));
        self
    }
    pub fn footer(
        mut self,
        slot: impl Fn(bool, &mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.footer = Some(Box::new(slot));
        self
    }
    pub fn narrow_bar(
        mut self,
        slot: impl Fn(bool, &mut Window, &mut App) -> AnyElement + 'static,
    ) -> Self {
        self.narrow_bar = Some(Box::new(slot));
        self
    }
    pub fn set_location(&mut self, location: SidebarLocation, cx: &mut Context<Self>) {
        self.location = location;
        self.flyout = None;
        self.drawer_open = false;
        cx.notify();
    }
    fn navigate(
        &mut self,
        section: SharedString,
        view: Option<SharedString>,
        href: SharedString,
        cx: &mut Context<Self>,
    ) {
        self.location = SidebarLocation {
            section: Some(section),
            view,
        };
        self.flyout = None;
        self.drawer_open = false;
        cx.emit(SidebarNavigate {
            location: self.location.clone(),
            href,
        });
        cx.notify();
    }
    fn views(&self, section: &SidebarSection, cx: &mut Context<Self>) -> Div {
        let t = theme(cx);
        let mut result = div().flex().flex_col().gap(px(2.));
        for (run_index, run) in section.view_runs.iter().enumerate() {
            if let Some(heading) = &run.heading {
                result = result.child(label(heading.clone(), cx).px(px(12.)).pt(px(10.)));
            }
            for (view_index, view) in run.views.iter().enumerate() {
                let section_id = section.id.clone();
                let view_id = view.id.clone();
                let href = view.href.clone();
                let selected = self.location.section.as_ref() == Some(&section.id)
                    && self.location.view.as_ref() == Some(&view.id);
                result = result.child(
                    div()
                        .id(SharedString::from(format!(
                            "sidebar-view-{}-{run_index}-{view_index}",
                            section.id
                        )))
                        .focusable()
                        .tab_stop(true)
                        .cursor_pointer()
                        .px(px(12.))
                        .py(px(7.))
                        .rounded(px(4.))
                        .bg(if selected { t.inset } else { t.surface })
                        .text_color(if selected { t.accent } else { t.muted })
                        .border_l_2()
                        .border_color(if selected { t.accent } else { t.surface })
                        .hover(|s| s.bg(t.inset))
                        .focus(|s| s.border_color(t.accent))
                        .child(view.label.clone())
                        .on_click(cx.listener(move |this, _, _, cx| {
                            this.navigate(
                                section_id.clone(),
                                Some(view_id.clone()),
                                href.clone(),
                                cx,
                            )
                        })),
                );
            }
        }
        result
    }
    fn panel(&self, rail: bool, window: &mut Window, cx: &mut Context<Self>) -> Stateful<Div> {
        let t = theme(cx);
        let mut panel = div()
            .id("app-sidebar-panel")
            .flex()
            .flex_col()
            .w(px(if rail { 60. } else { 240. }))
            .h(px(420.))
            .bg(t.surface)
            .border_1()
            .border_color(t.border)
            .rounded(px(6.))
            .text_color(t.text)
            .text_size(px(13.));
        if let Some(brand) = &self.brand {
            panel = panel.child(div().p(px(12.)).child(brand(rail, window, cx)));
        }
        let mut sections = div()
            .id("sidebar-navigation")
            .flex_1()
            .min_h_0()
            .overflow_y_scroll()
            .p(px(6.));
        for group in &self.groups {
            if !rail && let Some(heading) = &group.label {
                sections = sections.child(label(heading.clone(), cx).px(px(8.)).py(px(8.)));
            }
            for section in &group.sections {
                let section_id = section.id.clone();
                let href = section.href.clone();
                let selected = self.location.section.as_ref() == Some(&section.id);
                let has_views = section.view_runs.iter().any(|run| !run.views.is_empty());
                let mut section_row = div()
                    .id(SharedString::from(format!(
                        "sidebar-section-{}",
                        section.id
                    )))
                    .relative()
                    .focusable()
                    .tab_stop(true)
                    .cursor_pointer()
                    .flex()
                    .items_center()
                    .gap(px(8.))
                    .px(px(10.))
                    .py(px(9.))
                    .rounded(px(4.))
                    .bg(if selected { t.inset } else { t.surface })
                    .text_color(if selected { t.accent } else { t.text })
                    .hover(|s| s.bg(t.inset))
                    .focus(|s| s.bg(t.inset).text_color(t.accent))
                    .child(section.icon.clone());
                if !rail {
                    section_row = section_row.child(section.label.clone());
                }
                section_row = section_row.on_click(cx.listener(move |this, _, _, cx| {
                    if rail && has_views {
                        this.flyout = if this.flyout.as_ref() == Some(&section_id) {
                            None
                        } else {
                            Some(section_id.clone())
                        };
                        cx.notify();
                    } else {
                        this.navigate(section_id.clone(), None, href.clone(), cx);
                    }
                }));
                sections = sections.child(section_row);
                if !rail && selected {
                    sections = sections.child(self.views(section, cx).ml(px(16.)));
                }
            }
        }
        panel = panel.child(sections);
        let mut footer = div()
            .flex()
            .flex_col()
            .gap(px(8.))
            .border_t_1()
            .border_color(t.border)
            .p(px(8.));
        if let Some(slot) = &self.footer {
            footer = footer.child(slot(rail, window, cx));
        }
        footer = footer.child(
            control("sidebar-pin", if rail { "»" } else { "« Collapse" }, cx).on_click(
                cx.listener(|this, _, _, cx| {
                    this.pinned = !this.pinned;
                    this.mode = if this.pinned {
                        SidebarMode::Expanded
                    } else {
                        SidebarMode::Rail
                    };
                    this.flyout = None;
                    cx.notify();
                }),
            ),
        );
        panel.child(footer)
    }
}
impl Render for AppSidebar {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let mode = if self.mode == SidebarMode::Auto {
            if window.viewport_size().width <= px(900.) {
                SidebarMode::Drawer
            } else if window.viewport_size().width < px(1440.) && !self.pinned {
                SidebarMode::Rail
            } else {
                SidebarMode::Expanded
            }
        } else {
            self.mode
        };
        let mut root = div()
            .id("app-sidebar")
            .relative()
            .track_focus(&self.focus)
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                if event.keystroke.key == "escape" && (this.drawer_open || this.flyout.is_some()) {
                    this.drawer_open = false;
                    this.flyout = None;
                    this.focus.focus(window);
                    cx.stop_propagation();
                    cx.notify();
                }
            }));
        if mode == SidebarMode::Drawer {
            let mut bar = row().child(
                control(
                    "sidebar-open",
                    if self.drawer_open {
                        "Close navigation"
                    } else {
                        "☰ Navigation"
                    },
                    cx,
                )
                .on_click(cx.listener(|this, _, _, cx| {
                    this.drawer_open = !this.drawer_open;
                    cx.notify();
                })),
            );
            if let Some(slot) = &self.narrow_bar {
                bar = bar.child(slot(false, window, cx));
            }
            root = root.child(bar);
            if self.drawer_open {
                let drawer_focus = self.drawer_focus.clone();
                let panel = div()
                    .id("sidebar-drawer")
                    .occlude()
                    .track_focus(&drawer_focus)
                    .capture_key_down(move |event, window, cx| {
                        if event.keystroke.key == "tab" {
                            if event.keystroke.modifiers.shift {
                                window.focus_prev();
                            } else {
                                window.focus_next();
                            }
                            if !drawer_focus.contains_focused(window, cx) {
                                drawer_focus.focus(window);
                            }
                            window.prevent_default();
                            cx.stop_propagation();
                        }
                    })
                    .on_click(|_, _, cx| cx.stop_propagation())
                    .child(
                        control("sidebar-drawer-close", "Close navigation", cx).on_click(
                            cx.listener(|this, _, window, cx| {
                                this.drawer_open = false;
                                this.focus.focus(window);
                                cx.notify();
                            }),
                        ),
                    )
                    .child(self.panel(false, window, cx));
                let viewport = window.viewport_size();
                let overlay = div()
                    .id("sidebar-backdrop")
                    .occlude()
                    .w(viewport.width)
                    .h(viewport.height)
                    .bg(t.text.opacity(0.25))
                    .p(px(16.))
                    .on_click(cx.listener(|this, _, window, cx| {
                        this.drawer_open = false;
                        this.focus.focus(window);
                        cx.stop_propagation();
                        cx.notify();
                    }))
                    .child(panel)
                    .into_any_element();
                root = root.child(
                    canvas(
                        move |_, window, cx| {
                            let mut overlay = overlay;
                            overlay.layout_as_root(
                                size(
                                    AvailableSpace::Definite(viewport.width),
                                    AvailableSpace::Definite(viewport.height),
                                ),
                                window,
                                cx,
                            );
                            window.defer_draw(overlay, point(px(0.), px(0.)), 100);
                        },
                        |_, _, _, _| {},
                    )
                    .size_0(),
                );
            }
        } else {
            root = root.child(self.panel(mode == SidebarMode::Rail, window, cx));
            if mode == SidebarMode::Rail
                && let Some(section) = self
                    .groups
                    .iter()
                    .flat_map(|group| &group.sections)
                    .find(|section| self.flyout.as_ref() == Some(&section.id))
            {
                let popup = div()
                    .id("sidebar-flyout")
                    .occlude()
                    .w(px(230.))
                    .max_h(px(360.))
                    .overflow_y_scroll()
                    .bg(t.surface)
                    .text_color(t.text)
                    .text_size(px(13.))
                    .p(px(8.))
                    .rounded(px(6.))
                    .border_1()
                    .border_color(t.border)
                    .shadow_md()
                    .child(label(section.label.clone(), cx))
                    .child(self.views(section, cx))
                    .on_mouse_down_out(cx.listener(|this, _, _, cx| {
                        this.flyout = None;
                        cx.notify();
                    }))
                    .into_any_element();
                root = root.child(
                    canvas(
                        move |bounds, window, cx| {
                            let mut popup = popup;
                            let dimensions = popup.layout_as_root(
                                size(
                                    AvailableSpace::Definite(px(230.)),
                                    AvailableSpace::MinContent,
                                ),
                                window,
                                cx,
                            );
                            let viewport = window.viewport_size();
                            window.defer_draw(
                                popup,
                                point(
                                    (bounds.right() + px(6.))
                                        .min(viewport.width - dimensions.width - px(8.)),
                                    bounds.top().min(
                                        (viewport.height - dimensions.height - px(8.)).max(px(8.)),
                                    ),
                                ),
                                50,
                            );
                        },
                        |_, _, _, _| {},
                    )
                    .absolute()
                    .size_full(),
                );
            }
        }
        root
    }
}
struct SidebarDemo {
    sidebar: Entity<AppSidebar>,
    href: SharedString,
    _subscription: Subscription,
}
impl Render for SidebarDemo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut choices = row();
        for (id, mode) in [
            ("Expanded", SidebarMode::Expanded),
            ("Rail", SidebarMode::Rail),
            ("Drawer", SidebarMode::Drawer),
        ] {
            choices = choices.child(control(id, id, cx).on_click(cx.listener(
                move |this, _, _, cx| {
                    this.sidebar.update(cx, |sidebar, cx| {
                        sidebar.mode = mode;
                        sidebar.flyout = None;
                        sidebar.drawer_open = false;
                        cx.notify();
                    });
                },
            )));
        }
        stack().child(choices).child(
            row()
                .items_start()
                .child(self.sidebar.clone())
                .child(label(format!("Current page: {}", self.href), cx)),
        )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let sidebar = cx.new(|cx| {
            let mut sidebar = AppSidebar::new(
                vec![SidebarGroup {
                    label: Some("Workspace".into()),
                    sections: vec![
                        SidebarSection {
                            id: "projects".into(),
                            label: "Projects".into(),
                            href: "/projects".into(),
                            icon: "▣".into(),
                            view_runs: vec![SidebarViewRun {
                                heading: Some("Views".into()),
                                views: vec![
                                    SidebarView {
                                        id: "active".into(),
                                        label: "Active projects".into(),
                                        href: "/projects/active".into(),
                                    },
                                    SidebarView {
                                        id: "archived".into(),
                                        label: "Archived".into(),
                                        href: "/projects/archived".into(),
                                    },
                                ],
                            }],
                        },
                        SidebarSection {
                            id: "settings".into(),
                            label: "Settings".into(),
                            href: "/settings".into(),
                            icon: "⚙".into(),
                            view_runs: vec![],
                        },
                    ],
                }],
                cx,
            )
            .brand(|rail, _, cx| {
                label(if rail { "K" } else { "Kit workspace" }, cx)
                    .font_weight(FontWeight::BOLD)
                    .into_any_element()
            })
            .footer(|rail, _, cx| {
                label(if rail { "KW" } else { "Personal workspace" }, cx).into_any_element()
            });
            sidebar.mode = SidebarMode::Expanded;
            sidebar.pinned = true;
            sidebar.location.section = Some("projects".into());
            sidebar
        });
        let subscription = cx.subscribe(
            &sidebar,
            |this: &mut SidebarDemo, _, event: &SidebarNavigate, cx| {
                this.href = event.href.clone();
                cx.notify();
            },
        );
        SidebarDemo {
            sidebar,
            href: "/projects".into(),
            _subscription: subscription,
        }
    })
    .into()
}
