use gpui::{
    Context, Focusable, IntoElement, Modifiers, TestAppContext, Window, div, point, prelude::*, px,
};
use kit_ui_gpui::{
    components::{
        button::Button,
        text_input::{self, TextInput},
    },
    theme::Theme,
};
use std::{cell::Cell, rc::Rc};

struct ButtonHost {
    clicks: Rc<Cell<usize>>,
    disabled: bool,
}
impl Render for ButtonHost {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let clicks = self.clicks.clone();
        div().size_full().child(
            Button::new("test-button", "Run")
                .disabled(self.disabled)
                .on_click(move |_, _, _| clicks.set(clicks.get() + 1)),
        )
    }
}

#[gpui::test]
fn button_delivers_click_and_suppresses_disabled_click(cx: &mut TestAppContext) {
    cx.update(|cx| cx.set_global(Theme::light()));
    let clicks = Rc::new(Cell::new(0));
    let (view, cx) = cx.add_window_view(|_, _| ButtonHost {
        clicks: clicks.clone(),
        disabled: false,
    });
    cx.simulate_click(point(px(20.), px(12.)), Modifiers::default());
    assert_eq!(clicks.get(), 1, "enabled click must reach the caller");
    view.update(cx, |view, cx| {
        view.disabled = true;
        cx.notify();
    });
    cx.run_until_parked();
    cx.simulate_click(point(px(20.), px(12.)), Modifiers::default());
    assert_eq!(clicks.get(), 1, "disabled click must not reach the caller");
}

#[gpui::test]
fn input_edits_unicode_selection_and_respects_readonly(cx: &mut TestAppContext) {
    cx.update(|cx| {
        cx.set_global(Theme::light());
        text_input::init(cx);
    });
    let (input, cx) = cx.add_window_view(|window, cx| {
        let input = TextInput::new("Project", cx);
        input.focus_handle(cx).focus(window);
        input
    });
    cx.simulate_input("Rust 🦀");
    assert_eq!(input.read_with(cx, |i, _| i.value().to_string()), "Rust 🦀");
    cx.simulate_keystrokes("backspace");
    assert_eq!(input.read_with(cx, |i, _| i.value().to_string()), "Rust ");
    cx.simulate_keystrokes("cmd-a");
    cx.simulate_input("Native");
    assert_eq!(input.read_with(cx, |i, _| i.value().to_string()), "Native");
    input.update(cx, |i, cx| {
        i.readonly = true;
        cx.notify();
    });
    cx.simulate_input(" change");
    assert_eq!(input.read_with(cx, |i, _| i.value().to_string()), "Native");
}

#[gpui::test]
fn select_keyboard_skips_disabled_option_and_emits_choice(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::select_dropdown::{
        SelectDropdown, SelectOption, SelectionChanged,
    };
    cx.update(|cx| cx.set_global(Theme::light()));
    let chosen = Rc::new(std::cell::RefCell::new(String::new()));
    let observed = chosen.clone();
    let (_, cx) = cx.add_window_view(|window, cx| {
        let select = SelectDropdown::new(
            vec![
                SelectOption::new("a", "Alpha"),
                SelectOption::new("b", "Beta").disabled(true),
                SelectOption::new("c", "Gamma"),
            ],
            "a",
            cx,
        );
        cx.subscribe(&cx.entity(), move |s, _, e: &SelectionChanged, cx| {
            *observed.borrow_mut() = e.value.to_string();
            s.set_value(e.value.clone(), cx);
        })
        .detach();
        select.focus_handle(cx).focus(window);
        select
    });
    for key in ["enter", "down", "enter"] {
        let stroke = gpui::Keystroke::parse(key).unwrap();
        cx.simulate_event(gpui::KeyDownEvent {
            keystroke: stroke.clone(),
            is_held: false,
        });
        cx.simulate_event(gpui::KeyUpEvent { keystroke: stroke });
    }
    assert_eq!(&*chosen.borrow(), "c");
}

#[gpui::test]
fn resize_keyboard_changes_pane_size_and_clamps_at_limits(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::split_resize_handle::{SplitOrientation, SplitResizeHandle};
    cx.update(|cx| cx.set_global(Theme::light()));
    let (handle, cx) = cx.add_window_view(|window, cx| {
        let handle = SplitResizeHandle::new(SplitOrientation::Horizontal, 100., 80., 130., cx);
        handle.focus_handle(cx).focus(window);
        handle
    });
    cx.simulate_keystrokes("right");
    assert_eq!(handle.read_with(cx, |h, _| h.value()), 124.);
    cx.simulate_keystrokes("right right");
    assert_eq!(handle.read_with(cx, |h, _| h.value()), 130.);
    cx.simulate_keystrokes("left left left");
    assert_eq!(handle.read_with(cx, |h, _| h.value()), 80.);
}

struct ToggleHost {
    changes: Rc<Cell<usize>>,
    checked: bool,
    focus: gpui::FocusHandle,
}
impl Render for ToggleHost {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        kit_ui_gpui::components::toggle::Toggle::new("native-toggle", "Enabled")
            .checked(self.checked)
            .focus_handle(self.focus.clone())
            .on_change(cx.listener(|s, checked, _, cx| {
                s.checked = *checked;
                s.changes.set(s.changes.get() + 1);
                cx.notify();
            }))
    }
}
#[gpui::test]
fn toggle_changes_once_per_complete_space_press(cx: &mut TestAppContext) {
    cx.update(|cx| cx.set_global(Theme::light()));
    let changes = Rc::new(Cell::new(0));
    let (host, cx) = cx.add_window_view(|window, cx| {
        let focus = cx.focus_handle();
        focus.focus(window);
        ToggleHost {
            changes: changes.clone(),
            checked: false,
            focus,
        }
    });
    let stroke = gpui::Keystroke::parse("space").unwrap();
    cx.simulate_event(gpui::KeyDownEvent {
        keystroke: stroke.clone(),
        is_held: false,
    });
    cx.simulate_event(gpui::KeyUpEvent { keystroke: stroke });
    assert_eq!(changes.get(), 1);
    assert!(host.read_with(cx, |h, _| h.checked));
}

#[gpui::test]
fn copy_button_writes_its_current_text_to_native_clipboard(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::copy_button::CopyButton;
    cx.update(|cx| cx.set_global(Theme::light()));
    let (button, cx) = cx.add_window_view(|_, _| CopyButton::new("Initial"));
    button.update(cx, |b, cx| b.set_text("Rust 🦀", cx));
    cx.run_until_parked();
    cx.simulate_click(point(px(12.), px(12.)), Modifiers::default());
    let text = cx.update(|_, cx| cx.read_from_clipboard().and_then(|item| item.text()));
    assert_eq!(text.as_deref(), Some("Rust 🦀"));
}

struct ModalHost {
    open: bool,
    focus: gpui::FocusHandle,
}
impl Render for ModalHost {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        use kit_ui_gpui::{components::modal::Modal, theme::control};
        let weak = cx.entity().downgrade();
        div()
            .size_full()
            .child(
                control("open-modal", "Open", cx).on_click(cx.listener(|s, _, window, cx| {
                    s.open = true;
                    s.focus.focus(window);
                    cx.notify();
                })),
            )
            .when(self.open, |d| {
                d.child(Modal::new(
                    "Confirm",
                    div()
                        .debug_selector(|| "modal-content".into())
                        .child("Content"),
                    self.focus.clone(),
                    move |_, cx| {
                        weak.update(cx, |s, cx| {
                            s.open = false;
                            cx.notify();
                        })
                        .unwrap();
                    },
                ))
            })
    }
}
#[gpui::test]
fn modal_opens_over_the_window_and_escape_dismisses_it(cx: &mut TestAppContext) {
    cx.update(|cx| cx.set_global(Theme::light()));
    let (host, cx) = cx.add_window_view(|_, cx| ModalHost {
        open: false,
        focus: cx.focus_handle(),
    });
    cx.simulate_click(point(px(20.), px(12.)), Modifiers::default());
    cx.update(|window, cx| window.draw(cx).clear());
    assert!(cx.debug_bounds("modal-content").is_some());
    assert!(host.read_with(cx, |h, _| h.open));
    cx.simulate_keystrokes("escape");
    cx.update(|window, cx| window.draw(cx).clear());
    assert!(!host.read_with(cx, |h, _| h.open));
    // GPUI 0.2.2 retains debug selectors between frames; test the current hit path.
    cx.simulate_click(point(px(20.), px(12.)), Modifiers::default());
    assert!(host.read_with(cx, |h, _| h.open));
}

#[gpui::test]
fn menu_skips_disabled_actions_and_closes_after_complete_key_press(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::menu::{Menu, MenuOption, MenuSelected};
    cx.update(|cx| cx.set_global(Theme::light()));
    let chosen = Rc::new(std::cell::RefCell::new(Vec::new()));
    let observed = chosen.clone();
    let (menu, cx) = cx.add_window_view(|window, cx| {
        let menu = Menu::new(
            "Actions",
            vec![
                MenuOption::new("open", "Open"),
                MenuOption::new("disabled", "Unavailable").disabled(true),
                MenuOption::new("save", "Save"),
            ],
            cx,
        );
        cx.subscribe(&cx.entity(), move |_, _, event: &MenuSelected, _| {
            observed.borrow_mut().push(event.id.to_string());
        })
        .detach();
        menu.focus_handle(cx).focus(window);
        menu
    });
    for key in ["enter", "down", "enter"] {
        let stroke = gpui::Keystroke::parse(key).unwrap();
        cx.simulate_event(gpui::KeyDownEvent {
            keystroke: stroke.clone(),
            is_held: false,
        });
        cx.simulate_event(gpui::KeyUpEvent { keystroke: stroke });
    }
    assert_eq!(&*chosen.borrow(), &["save"]);
    assert!(!menu.read_with(cx, |menu, _| menu.is_open()));
    cx.simulate_keystrokes("up escape");
    assert!(!menu.read_with(cx, |menu, _| menu.is_open()));
    assert_eq!(chosen.borrow().len(), 1);
}

#[gpui::test]
fn command_palette_filters_native_input_and_emits_selected_command(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::command_palette::{CommandPalette, CommandRun, PaletteCommand};
    cx.update(|cx| {
        cx.set_global(Theme::light());
        text_input::init(cx);
    });
    let chosen = Rc::new(std::cell::RefCell::new(String::new()));
    let observed = chosen.clone();
    let (palette, cx) = cx.add_window_view(|window, cx| {
        let mut palette = CommandPalette::new(
            vec![
                PaletteCommand::new("open", "Open workspace"),
                PaletteCommand::new("search", "Search files"),
            ],
            cx,
        );
        cx.subscribe(&cx.entity(), move |_, _, event: &CommandRun, _| {
            *observed.borrow_mut() = event.0.id.to_string();
        })
        .detach();
        palette.show(window, cx);
        palette
    });
    cx.simulate_input("files");
    cx.simulate_keystrokes("enter");
    assert_eq!(&*chosen.borrow(), "search");
    assert!(!palette.read_with(cx, |p, _| p.is_open()));
}

struct FitHost {
    width: f32,
    stage: Rc<Cell<usize>>,
}
impl Render for FitHost {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        use kit_ui_gpui::components::fit_stages::FitStages;
        let stage = self.stage.clone();
        div().w(px(self.width)).child(
            FitStages::new(
                "measured-fit",
                [
                    div()
                        .w(px(300.))
                        .h(px(30.))
                        .child("Full actions")
                        .into_any_element(),
                    div()
                        .w(px(180.))
                        .h(px(30.))
                        .child("Short actions")
                        .into_any_element(),
                    div().w(px(50.)).h(px(30.)).child("✓").into_any_element(),
                ],
            )
            .on_stage_change(move |selected, _, _| stage.set(*selected)),
        )
    }
}
#[gpui::test]
fn fit_stages_tracks_actual_container_resize_in_both_directions(cx: &mut TestAppContext) {
    let stage = Rc::new(Cell::new(usize::MAX));
    let (host, cx) = cx.add_window_view(|_, _| FitHost {
        width: 400.,
        stage: stage.clone(),
    });
    cx.update(|window, cx| window.draw(cx).clear());
    assert_eq!(stage.get(), 0);
    for (width, expected) in [(220., 1), (100., 2), (400., 0)] {
        host.update(cx, |host, cx| {
            host.width = width;
            cx.notify();
        });
        cx.update(|window, cx| window.draw(cx).clear());
        assert_eq!(stage.get(), expected);
    }
}

#[gpui::test]
fn media_viewer_zooms_pages_and_restores_previous_focus(cx: &mut TestAppContext) {
    use kit_ui_gpui::components::media_viewer::{MediaViewer, MediaViewerItem};
    cx.update(|cx| cx.set_global(Theme::light()));
    let restore = Rc::new(std::cell::RefCell::new(None));
    let observed = restore.clone();
    let (viewer, cx) = cx.add_window_view(|window, cx| {
        let focus = cx.focus_handle();
        focus.focus(window);
        *observed.borrow_mut() = Some(focus);
        let items = ["First", "Second"].map(|name| {
            MediaViewerItem::element(name, gpui::size(px(200.), px(100.)), move |_, _| {
                div().size_full().child(name).into_any_element()
            })
        });
        let mut viewer = MediaViewer::new(items.into(), cx);
        viewer.open(-1, window, cx);
        viewer
    });
    cx.update(|window, cx| window.draw(cx).clear());
    assert_eq!(viewer.read_with(cx, |v, _| v.index()), 1);
    cx.simulate_event(gpui::ScrollWheelEvent {
        position: point(px(500.), px(300.)),
        delta: gpui::ScrollDelta::Pixels(point(px(0.), px(-40.))),
        modifiers: Modifiers::default(),
        touch_phase: gpui::TouchPhase::Moved,
    });
    assert!(viewer.read_with(cx, |v, _| v.scale()) > 1.);
    cx.simulate_keystrokes("right");
    assert_eq!(viewer.read_with(cx, |v, _| v.index()), 0);
    assert_eq!(viewer.read_with(cx, |v, _| v.scale()), 1.);
    cx.simulate_keystrokes("escape");
    assert!(!viewer.read_with(cx, |v, _| v.is_open()));
    assert!(cx.update(|window, _| restore.borrow().as_ref().unwrap().is_focused(window)));
}
