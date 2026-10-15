use gpui::{prelude::*, *};
use kit_ui_gpui::{
    components,
    theme::{Theme, control, theme},
};

actions!(
    gallery,
    [
        Quit,
        Next,
        Previous,
        ToggleTheme,
        Reset,
        FocusSearch,
        Tab,
        TabPrev
    ]
);

struct Entry {
    name: &'static str,
    count: usize,
    create: fn(&mut App) -> AnyView,
}

struct Gallery {
    entries: Vec<Entry>,
    selected: usize,
    demo: AnyView,
    dark: bool,
    focus: FocusHandle,
    search: Entity<components::search_input::SearchInput>,
    query: String,
}
impl Gallery {
    fn select(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        self.focus.focus(window);
        self.selected = index;
        self.demo = (self.entries[index].create)(cx);
        cx.notify();
    }
    fn next(&mut self, _: &Next, window: &mut Window, cx: &mut Context<Self>) {
        self.select((self.selected + 1) % self.entries.len(), window, cx);
    }
    fn previous(&mut self, _: &Previous, window: &mut Window, cx: &mut Context<Self>) {
        self.select(
            (self.selected + self.entries.len() - 1) % self.entries.len(),
            window,
            cx,
        );
    }
    fn toggle_theme(&mut self, _: &ToggleTheme, _: &mut Window, cx: &mut Context<Self>) {
        self.dark = theme(cx).background.l >= 0.5;
        cx.set_global(if self.dark {
            Theme::dark()
        } else {
            Theme::light()
        });
        cx.refresh_windows();
    }
    fn focus_search(&mut self, _: &FocusSearch, window: &mut Window, cx: &mut Context<Self>) {
        self.search.read(cx).focus_handle(cx).focus(window);
    }
    fn reset(&mut self, _: &Reset, window: &mut Window, cx: &mut Context<Self>) {
        self.select(self.selected, window, cx);
    }
}
impl Render for Gallery {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        self.dark = t.background.l < 0.5;
        let current = &self.entries[self.selected];
        div()
            .id("gallery")
            .key_context("Gallery")
            .track_focus(&self.focus)
            .on_action(|_: &Tab, window, _| window.focus_next())
            .on_action(|_: &TabPrev, window, _| window.focus_prev())
            .on_action(cx.listener(Self::next))
            .on_action(cx.listener(Self::previous))
            .on_action(cx.listener(Self::focus_search))
            .on_action(cx.listener(Self::toggle_theme))
            .on_action(cx.listener(Self::reset))
            .size_full()
            .flex()
            .flex_col()
            .bg(t.background)
            .text_color(t.text)
            .font_family("Inter")
            .text_size(px(13.))
            .line_height(relative(1.5))
            .child(
                div()
                    .flex()
                    .items_center()
                    .justify_between()
                    .h(px(56.))
                    .px(px(24.))
                    .border_b_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .child(
                        div()
                            .text_size(px(18.))
                            .font_weight(FontWeight::BOLD)
                            .child("Kit UI / GPUI"),
                    )
                    .child(
                        div()
                            .flex()
                            .gap(px(8.))
                            .child(
                                control("reset", "Reset demo", cx)
                                    .on_click(cx.listener(|s, _, w, cx| s.reset(&Reset, w, cx))),
                            )
                            .child(
                                control(
                                    "theme",
                                    if self.dark { "Light mode" } else { "Dark mode" },
                                    cx,
                                )
                                .on_click(
                                    cx.listener(|s, _, w, cx| s.toggle_theme(&ToggleTheme, w, cx)),
                                ),
                            ),
                    ),
            )
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_h_0()
                    .child(
                        div()
                            .id("navigation")
                            .w(px(232.))
                            .flex_shrink_0()
                            .h_full()
                            .overflow_y_scroll()
                            .bg(t.surface)
                            .border_r_1()
                            .border_color(t.border)
                            .p(px(12.))
                            .child(div().mb(px(12.)).child(self.search.clone()))
                            .child(
                                div()
                                    .px(px(12.))
                                    .py(px(8.))
                                    .text_color(t.muted)
                                    .child("Components"),
                            )
                            .children(
                                self.entries
                                    .iter()
                                    .enumerate()
                                    .filter(|(_, e)| e.name.to_lowercase().contains(&self.query))
                                    .map(|(i, entry)| {
                                        div()
                                            .id(("component", i))
                                            .debug_selector({
                                                let name = entry.name;
                                                move || format!("component-{name}").into()
                                            })
                                            .flex()
                                            .justify_between()
                                            .items_center()
                                            .px(px(12.))
                                            .py(px(9.))
                                            .rounded(px(4.))
                                            .cursor_pointer()
                                            .focusable()
                                            .tab_stop(true)
                                            .focus(|s| s.border_1().border_color(t.accent))
                                            .bg(if self.selected == i {
                                                t.inset
                                            } else {
                                                t.surface
                                            })
                                            .hover(|s| s.bg(t.inset))
                                            .child(entry.name)
                                            .child(
                                                div()
                                                    .text_color(t.muted)
                                                    .child(entry.count.to_string()),
                                            )
                                            .on_click(cx.listener(move |s, _, window, cx| {
                                                s.select(i, window, cx)
                                            }))
                                    }),
                            ),
                    )
                    .child(
                        div()
                            .id("content")
                            .flex_1()
                            .min_w_0()
                            .h_full()
                            .overflow_y_scroll()
                            .p(px(32.))
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .justify_between()
                                    .mb(px(24.))
                                    .child(
                                        div()
                                            .text_size(px(24.))
                                            .font_weight(FontWeight::BOLD)
                                            .child(current.name),
                                    )
                                    .child(
                                        div()
                                            .text_color(t.muted)
                                            .child(format!("{} uses in Forge", current.count)),
                                    ),
                            )
                            .child(
                                div()
                                    .debug_selector(|| "demo-host".into())
                                    .child(self.demo.clone()),
                            ),
                    ),
            )
            .child(
                div()
                    .h(px(28.))
                    .px(px(16.))
                    .flex()
                    .items_center()
                    .justify_between()
                    .border_t_1()
                    .border_color(t.border)
                    .bg(t.surface)
                    .text_color(t.muted)
                    .text_size(px(11.))
                    .child(if cfg!(debug_assertions) {
                        "Debug"
                    } else {
                        "Release"
                    })
                    .child("⌘ ↑ / ↓ Components    ⌘ D Theme    ⌘ R Reset    ⌘ Q Quit"),
            )
    }
}

fn entries() -> Vec<Entry> {
    vec![
        Entry {
            name: "AdaptiveActionGrid",
            count: 2,
            create: components::adaptive_action_grid::demo,
        },
        Entry {
            name: "AppSidebar",
            count: 0,
            create: components::app_sidebar::demo,
        },
        Entry {
            name: "BottomDock",
            count: 1,
            create: components::bottom_dock::demo,
        },
        Entry {
            name: "Button",
            count: 154,
            create: components::button::demo,
        },
        Entry {
            name: "Calendar",
            count: 0,
            create: components::calendar::demo,
        },
        Entry {
            name: "Card",
            count: 29,
            create: components::card::demo,
        },
        Entry {
            name: "Checkbox",
            count: 31,
            create: components::checkbox::demo,
        },
        Entry {
            name: "Chip",
            count: 69,
            create: components::chip::demo,
        },
        Entry {
            name: "ChipStack",
            count: 0,
            create: components::chip_stack::demo,
        },
        Entry {
            name: "CodeBlock",
            count: 3,
            create: components::code_block::demo,
        },
        Entry {
            name: "CollapsibleSidebar",
            count: 3,
            create: components::collapsible_sidebar::demo,
        },
        Entry {
            name: "ColorLabel",
            count: 2,
            create: components::color_label::demo,
        },
        Entry {
            name: "CommandPalette",
            count: 0,
            create: components::command_palette::demo,
        },
        Entry {
            name: "CommentCard",
            count: 4,
            create: components::comment_card::demo,
        },
        Entry {
            name: "CopyButton",
            count: 4,
            create: components::copy_button::demo,
        },
        Entry {
            name: "DatePicker",
            count: 0,
            create: components::date_picker::demo,
        },
        Entry {
            name: "DateRangePicker",
            count: 0,
            create: components::date_range_picker::demo,
        },
        Entry {
            name: "DetailDrawer",
            count: 0,
            create: components::detail_drawer::demo,
        },
        Entry {
            name: "DiffStats",
            count: 6,
            create: components::diff_stats::demo,
        },
        Entry {
            name: "EmptyState",
            count: 15,
            create: components::empty_state::demo,
        },
        Entry {
            name: "FilterDropdown",
            count: 10,
            create: components::filter_dropdown::demo,
        },
        Entry {
            name: "FindBar",
            count: 0,
            create: components::find_bar::demo,
        },
        Entry {
            name: "FitStages",
            count: 2,
            create: components::fit_stages::demo,
        },
        Entry {
            name: "FlashBanner",
            count: 1,
            create: components::flash_banner::demo,
        },
        Entry {
            name: "FormField",
            count: 0,
            create: components::form_field::demo,
        },
        Entry {
            name: "HarnessIcon",
            count: 6,
            create: components::harness_icon::demo,
        },
        Entry {
            name: "IconButton",
            count: 43,
            create: components::icon_button::demo,
        },
        Entry {
            name: "ImagePreview",
            count: 2,
            create: components::image_preview::demo,
        },
        Entry {
            name: "KbdBadge",
            count: 5,
            create: components::kbd_badge::demo,
        },
        Entry {
            name: "Markdown",
            count: 1,
            create: components::markdown::demo,
        },
        Entry {
            name: "MediaViewer",
            count: 0,
            create: components::media_viewer::demo,
        },
        Entry {
            name: "MentionTextarea",
            count: 0,
            create: components::mention_textarea::demo,
        },
        Entry {
            name: "Menu",
            count: 3,
            create: components::menu::demo,
        },
        Entry {
            name: "MenuContent",
            count: 3,
            create: components::menu_content::demo,
        },
        Entry {
            name: "MenuItem",
            count: 3,
            create: components::menu_item::demo,
        },
        Entry {
            name: "MenuRadioGroup",
            count: 1,
            create: components::menu_radio_group::demo,
        },
        Entry {
            name: "MenuRadioItem",
            count: 1,
            create: components::menu_radio_item::demo,
        },
        Entry {
            name: "MenuSeparator",
            count: 0,
            create: components::menu_separator::demo,
        },
        Entry {
            name: "MenuTrigger",
            count: 3,
            create: components::menu_trigger::demo,
        },
        Entry {
            name: "MetricCard",
            count: 0,
            create: components::metric_card::demo,
        },
        Entry {
            name: "Modal",
            count: 29,
            create: components::modal::demo,
        },
        Entry {
            name: "Notice",
            count: 0,
            create: components::notice::demo,
        },
        Entry {
            name: "PageFrame",
            count: 0,
            create: components::page_frame::demo,
        },
        Entry {
            name: "ProviderBrandMark",
            count: 0,
            create: components::provider_brand_mark::demo,
        },
        Entry {
            name: "ProviderButton",
            count: 0,
            create: components::provider_button::demo,
        },
        Entry {
            name: "RefreshControl",
            count: 0,
            create: components::refresh_control::demo,
        },
        Entry {
            name: "ScrollBox",
            count: 16,
            create: components::scroll_box::demo,
        },
        Entry {
            name: "SearchInput",
            count: 19,
            create: components::search_input::demo,
        },
        Entry {
            name: "SegmentedControl",
            count: 2,
            create: components::segmented_control::demo,
        },
        Entry {
            name: "SelectDropdown",
            count: 21,
            create: components::select_dropdown::demo,
        },
        Entry {
            name: "SettingsLayout",
            count: 1,
            create: components::settings_layout::demo,
        },
        Entry {
            name: "SettingsSection",
            count: 1,
            create: components::settings_section::demo,
        },
        Entry {
            name: "SidebarToggle",
            count: 7,
            create: components::sidebar_toggle::demo,
        },
        Entry {
            name: "Spinner",
            count: 51,
            create: components::spinner::demo,
        },
        Entry {
            name: "SplitResizeHandle",
            count: 9,
            create: components::split_resize_handle::demo,
        },
        Entry {
            name: "StatusBar",
            count: 2,
            create: components::status_bar::demo,
        },
        Entry {
            name: "StatusDot",
            count: 24,
            create: components::status_dot::demo,
        },
        Entry {
            name: "StructuredList",
            count: 0,
            create: components::structured_list::demo,
        },
        Entry {
            name: "StructuredListRow",
            count: 0,
            create: components::structured_list_row::demo,
        },
        Entry {
            name: "Table",
            count: 2,
            create: components::table::demo,
        },
        Entry {
            name: "TableHeaderCell",
            count: 13,
            create: components::table_header_cell::demo,
        },
        Entry {
            name: "TextInput",
            count: 14,
            create: components::text_input::demo,
        },
        Entry {
            name: "ThemeToggle",
            count: 1,
            create: components::theme_toggle::demo,
        },
        Entry {
            name: "Timeline",
            count: 2,
            create: components::timeline::demo,
        },
        Entry {
            name: "TimelineItem",
            count: 3,
            create: components::timeline_item::demo,
        },
        Entry {
            name: "Toggle",
            count: 22,
            create: components::toggle::demo,
        },
        Entry {
            name: "Tooltip",
            count: 2,
            create: components::tooltip::demo,
        },
        Entry {
            name: "TopBar",
            count: 1,
            create: components::top_bar::demo,
        },
        Entry {
            name: "Typeahead",
            count: 8,
            create: components::typeahead::demo,
        },
        Entry {
            name: "VirtualList",
            count: 0,
            create: components::virtual_list::demo,
        },
    ]
}
fn main() {
    Application::new()
        .with_assets(kit_ui_gpui::assets::Assets)
        .run(|cx: &mut App| {
            // GPUI selects concrete faces; register each weight used by Kit UI.
            cx.text_system()
                .add_fonts(vec![
                    std::borrow::Cow::Borrowed(include_bytes!("../assets/fonts/Inter-Regular.ttf")),
                    std::borrow::Cow::Borrowed(include_bytes!("../assets/fonts/Inter-Medium.ttf")),
                    std::borrow::Cow::Borrowed(include_bytes!(
                        "../assets/fonts/Inter-SemiBold.ttf"
                    )),
                    std::borrow::Cow::Borrowed(include_bytes!("../assets/fonts/Inter-Bold.ttf")),
                ])
                .expect("load bundled Inter fonts");
            cx.set_global(Theme::light());
            components::text_input::init(cx);
            cx.bind_keys([
                KeyBinding::new("cmd-q", Quit, None),
                KeyBinding::new("tab", Tab, Some("Gallery")),
                KeyBinding::new("shift-tab", TabPrev, Some("Gallery")),
                KeyBinding::new("cmd-f", FocusSearch, Some("Gallery")),
                KeyBinding::new("cmd-down", Next, Some("Gallery")),
                KeyBinding::new("cmd-up", Previous, Some("Gallery")),
                KeyBinding::new("cmd-d", ToggleTheme, Some("Gallery")),
                KeyBinding::new("cmd-r", Reset, Some("Gallery")),
            ]);
            cx.on_action(|_: &Quit, cx| cx.quit());
            cx.set_menus(vec![Menu {
                name: "Kit UI".into(),
                items: vec![MenuItem::action("Quit", Quit)],
            }]);
            let bounds = Bounds::centered(None, size(px(1100.), px(760.)), cx);
            cx.open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    window_min_size: Some(size(px(760.), px(520.))),
                    titlebar: Some(TitlebarOptions {
                        title: Some("Kit UI GPUI experiment".into()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                |window, cx| {
                    cx.new(|cx| {
                        let entries = entries();
                        let demo = (entries[0].create)(cx);
                        let focus = cx.focus_handle();
                        focus.focus(window);
                        let search = cx.new(|cx| {
                            components::search_input::SearchInput::new("Find component", cx)
                        });
                        cx.subscribe(
                            &search,
                            |s: &mut Gallery,
                             _,
                             event: &components::search_input::SearchChanged,
                             cx| {
                                s.query = event.text.to_lowercase();
                                cx.notify();
                            },
                        )
                        .detach();
                        Gallery {
                            entries,
                            selected: 0,
                            demo,
                            dark: false,
                            focus,
                            search,
                            query: String::new(),
                        }
                    })
                },
            )
            .expect("open native gallery window");
            cx.activate(true);
        });
}

#[cfg(test)]
#[path = "gallery_tests.rs"]
mod tests;
