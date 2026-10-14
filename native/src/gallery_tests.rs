use super::{Gallery, entries};
use gpui::{AppContext, Context, Focusable, TestAppContext, px, size};
use kit_ui_gpui::{
    components::{
        search_input::{SearchChanged, SearchInput},
        text_input,
    },
    theme::Theme,
};

#[gpui::test]
fn gallery_mounts_every_demo_in_both_themes(cx: &mut TestAppContext) {
    cx.update(|cx| {
        cx.set_global(Theme::light());
        text_input::init(cx);
    });
    let (gallery, cx) = cx.add_window_view(|window, cx: &mut Context<Gallery>| {
        let entries = entries();
        let demo = (entries[0].create)(cx);
        let focus = cx.focus_handle();
        focus.focus(window);
        let search = cx.new(|cx| SearchInput::new("Find component", cx));
        Gallery {
            entries,
            selected: 0,
            demo,
            dark: false,
            focus,
            search,
            query: String::new(),
        }
    });
    for viewport in [size(px(1100.), px(760.)), size(px(760.), px(520.))] {
        cx.simulate_resize(viewport);
        for dark in [false, true] {
            cx.update(|_, cx| cx.set_global(if dark { Theme::dark() } else { Theme::light() }));
            let count = gallery.read_with(cx, |g, _| g.entries.len());
            for index in 0..count {
                cx.update(|window, cx| gallery.update(cx, |g, cx| g.select(index, window, cx)));
                cx.update(|window, cx| {
                    window.draw(cx).clear();
                });
                let bounds = cx.debug_bounds("demo-host").expect("demo must mount");
                assert!(
                    bounds.size.width > px(0.) && bounds.size.height > px(0.),
                    "demo needs visible content at index {index}"
                );
            }
        }
    }
    cx.simulate_resize(size(px(760.), px(520.)));
    cx.update(|window, cx| {
        window.draw(cx).clear();
    });
    assert!(cx.debug_bounds("demo-host").is_some());
}

#[gpui::test]
fn gallery_search_filters_navigation(cx: &mut TestAppContext) {
    cx.update(|cx| {
        cx.set_global(Theme::light());
        text_input::init(cx);
    });
    let (gallery, cx) = cx.add_window_view(|window, cx: &mut Context<Gallery>| {
        let entries = entries();
        let demo = (entries[0].create)(cx);
        let focus = cx.focus_handle();
        let search = cx.new(|cx| SearchInput::new("Find component", cx));
        cx.subscribe(&search, |g, _, event: &SearchChanged, cx| {
            g.query = event.text.to_lowercase();
            cx.notify();
        })
        .detach();
        search.read(cx).focus_handle(cx).focus(window);
        Gallery {
            entries,
            selected: 0,
            demo,
            dark: false,
            focus,
            search,
            query: String::new(),
        }
    });
    cx.simulate_input("checkbox");
    assert_eq!(gallery.read_with(cx, |g, _| g.query.clone()), "checkbox");
    cx.update(|window, cx| window.draw(cx).clear());
    let result = cx
        .debug_bounds("component-Checkbox")
        .expect("matching result is rendered");
    cx.simulate_click(result.center(), gpui::Modifiers::default());
    assert_eq!(
        gallery.read_with(cx, |g, _| g.entries[g.selected].name),
        "Checkbox"
    );
    cx.update(|window, cx| {
        gallery
            .read(cx)
            .search
            .read(cx)
            .focus_handle(cx)
            .focus(window)
    });
    cx.simulate_keystrokes("escape");
    assert_eq!(gallery.read_with(cx, |g, _| g.query.clone()), "");
}

#[gpui::test]
fn replacing_a_focused_demo_restores_gallery_navigation(cx: &mut TestAppContext) {
    cx.update(|cx| {
        cx.set_global(Theme::light());
        text_input::init(cx);
    });
    let (gallery, cx) = cx.add_window_view(|window, cx: &mut Context<Gallery>| {
        let entries = entries();
        let demo = (entries[0].create)(cx);
        let focus = cx.focus_handle();
        focus.focus(window);
        let search = cx.new(|cx| SearchInput::new("Find component", cx));
        Gallery {
            entries,
            selected: 0,
            demo,
            dark: false,
            focus,
            search,
            query: String::new(),
        }
    });
    cx.dispatch_action(super::Tab);
    assert!(!cx.update(|window, cx| gallery.read(cx).focus.is_focused(window)));
    cx.dispatch_action(super::Next);
    assert_eq!(
        gallery.read_with(cx, |g, _| g.entries[g.selected].name),
        "AppSidebar"
    );
    assert!(cx.update(|window, cx| gallery.read(cx).focus.is_focused(window)));
    cx.dispatch_action(super::Next);
    assert_eq!(
        gallery.read_with(cx, |g, _| g.entries[g.selected].name),
        "BottomDock"
    );
}
