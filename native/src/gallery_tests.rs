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
            runtime_stats: cx.new(super::runtime_stats::RuntimeStats::new),
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
            runtime_stats: cx.new(super::runtime_stats::RuntimeStats::new),
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
            runtime_stats: cx.new(super::runtime_stats::RuntimeStats::new),
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

#[gpui::test]
fn image_preview_demo_loads_the_bundled_file_as_image_pixels(cx: &mut TestAppContext) {
    cx.update(|cx| cx.set_global(Theme::light()));
    let (_, cx) =
        cx.add_window_view(|_, cx| ImageDemoHost(kit_ui_gpui::components::image_preview::demo(cx)));
    cx.update(|window, cx| window.draw(cx).clear());
    cx.run_until_parked();
    cx.update(|window, cx| window.draw(cx).clear());
    let source = gpui::Resource::Path(
        std::path::PathBuf::from(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/assets/demo/activity-chart.png"
        ))
        .into(),
    );
    let image = cx
        .update(|window, cx| window.get_asset::<gpui::ImgResourceLoader>(&source, cx))
        .expect("rendering must have loaded the file, rather than starting an HTTP request")
        .expect("bundled image must decode");
    assert_eq!(
        image.size(0),
        size(gpui::DevicePixels(640), gpui::DevicePixels(360))
    );
    let pixels = image.as_bytes(0).unwrap();
    let blue_bar = (220 * 640 + 120) * 4;
    assert_eq!(&pixels[blue_bar..blue_bar + 4], &[246, 130, 59, 255]);
}

struct ImageDemoHost(gpui::AnyView);
impl gpui::Render for ImageDemoHost {
    fn render(&mut self, _: &mut gpui::Window, _: &mut Context<Self>) -> impl gpui::IntoElement {
        self.0.clone()
    }
}

#[gpui::test]
fn expanded_media_demo_loads_the_bundled_image(cx: &mut TestAppContext) {
    cx.update(|cx| cx.set_global(Theme::light()));
    let (_, cx) =
        cx.add_window_view(|_, cx| ImageDemoHost(kit_ui_gpui::components::media_viewer::demo(cx)));
    cx.update(|window, cx| window.draw(cx).clear());
    cx.simulate_click(gpui::point(px(20.), px(44.)), gpui::Modifiers::default());
    cx.update(|window, cx| window.draw(cx).clear());
    cx.run_until_parked();
    cx.update(|window, cx| window.draw(cx).clear());
    let source = gpui::Resource::Path(
        std::path::PathBuf::from(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/assets/demo/activity-chart.png"
        ))
        .into(),
    );
    let image = cx
        .update(|window, cx| window.get_asset::<gpui::ImgResourceLoader>(&source, cx))
        .expect("opening the real demo must load a filesystem image")
        .expect("bundled image must decode");
    assert_eq!(
        image.size(0),
        size(gpui::DevicePixels(640), gpui::DevicePixels(360))
    );
}

#[gpui::test]
fn bundled_action_icons_rasterize_visible_pixels(cx: &mut TestAppContext) {
    for name in [
        "plus",
        "check",
        "x",
        "search",
        "refresh",
        "settings",
        "panel-left",
    ] {
        let source = gpui::Resource::Path(
            std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join(format!("assets/icons/{name}.svg"))
                .into(),
        );
        let (_, _) = cx.update(|cx| cx.fetch_asset::<gpui::ImgResourceLoader>(&source));
        cx.background_executor.run_until_parked();
        let image = cx.update(|cx| cx.fetch_asset::<gpui::ImgResourceLoader>(&source).0);
        // The real decoder must produce visible alpha, not an empty SVG.
        let image = cx
            .background_executor
            .block(image)
            .expect("bundled SVG must decode");
        assert!(
            image
                .as_bytes(0)
                .unwrap()
                .chunks_exact(4)
                .any(|pixel| pixel[3] > 0),
            "{name} must contain visible artwork"
        );
    }
}
