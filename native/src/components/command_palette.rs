use crate::components::modal::Modal;
use crate::components::search_input::{SearchChanged, SearchInput};
use crate::theme::{control, label, stack, theme};
use gpui::{prelude::*, *};

#[derive(Clone)]
pub struct PaletteCommand {
    pub id: SharedString,
    pub label: SharedString,
    pub section: Option<SharedString>,
    pub keywords: SharedString,
    pub shortcut: Option<SharedString>,
    pub disabled: bool,
}
impl PaletteCommand {
    pub fn new(id: impl Into<SharedString>, label: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            section: None,
            keywords: "".into(),
            shortcut: None,
            disabled: false,
        }
    }
}
#[derive(Clone)]
pub struct CommandRun(pub PaletteCommand);

pub struct CommandPalette {
    pub commands: Vec<PaletteCommand>,
    pub recent_ids: Vec<SharedString>,
    search: Entity<SearchInput>,
    open: bool,
    highlighted: Option<usize>,
    previous_focus: Option<FocusHandle>,
    scroll: ScrollHandle,
}
impl EventEmitter<CommandRun> for CommandPalette {}
impl CommandPalette {
    pub fn new(commands: Vec<PaletteCommand>, cx: &mut Context<Self>) -> Self {
        let search = cx.new(|cx| SearchInput::new("Type a command…", cx));
        cx.subscribe(&search, |this, _, _: &SearchChanged, cx| {
            this.highlighted = this.ranked(cx).iter().position(|c| !c.disabled);
            this.scroll.scroll_to_item(0);
            cx.notify();
        })
        .detach();
        Self {
            commands,
            recent_ids: Vec::new(),
            search,
            open: false,
            highlighted: None,
            previous_focus: None,
            scroll: ScrollHandle::new(),
        }
    }
    pub fn is_open(&self) -> bool {
        self.open
    }
    pub fn show(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.previous_focus = window.focused(cx);
        self.open = true;
        self.search
            .update(cx, |search, cx| search.set_value("", cx));
        self.highlighted = self.ranked(cx).iter().position(|c| !c.disabled);
        self.search.read(cx).focus_handle(cx).focus(window);
        cx.notify();
    }
    pub fn close(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.open = false;
        if let Some(focus) = self.previous_focus.take() {
            focus.focus(window);
        }
        cx.notify();
    }
    fn ranked(&self, cx: &App) -> Vec<PaletteCommand> {
        let query = self.search.read(cx).value(cx).trim().to_lowercase();
        let mut commands: Vec<(usize, PaletteCommand)> = self
            .commands
            .iter()
            .filter_map(|command| {
                let label = command.label.to_lowercase();
                let score = if query.is_empty() {
                    self.recent_ids
                        .iter()
                        .position(|id| id == &command.id)
                        .unwrap_or(self.recent_ids.len())
                } else if label.starts_with(&query) {
                    0
                } else if label.contains(&query) {
                    1
                } else if command.keywords.to_lowercase().contains(&query) {
                    2
                } else {
                    return None;
                };
                let mut command = command.clone();
                if query.is_empty() && self.recent_ids.contains(&command.id) {
                    command.section = Some("Recent".into());
                }
                Some((score, command))
            })
            .collect();
        commands.sort_by_key(|(rank, _)| *rank);
        let mut groups: Vec<(Option<SharedString>, Vec<PaletteCommand>)> = Vec::new();
        for (_, command) in commands {
            if let Some((_, items)) = groups
                .iter_mut()
                .find(|(section, _)| section == &command.section)
            {
                items.push(command);
            } else {
                groups.push((command.section.clone(), vec![command]));
            }
        }
        groups.into_iter().flat_map(|(_, items)| items).collect()
    }
    fn run(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(command) = self
            .ranked(cx)
            .get(index)
            .filter(|command| !command.disabled)
            .cloned()
        {
            self.close(window, cx);
            cx.emit(CommandRun(command));
        }
    }
    fn navigate(&mut self, delta: isize, cx: &mut Context<Self>) {
        let commands = self.ranked(cx);
        if commands.is_empty() {
            return;
        }
        let count = commands.len() as isize;
        let mut index = self
            .highlighted
            .map(|i| i as isize)
            .unwrap_or(if delta > 0 { -1 } else { 0 });
        for _ in 0..commands.len() {
            index = (index + delta).rem_euclid(count);
            if !commands[index as usize].disabled {
                self.highlighted = Some(index as usize);
                self.scroll.scroll_to_item(index as usize);
                cx.notify();
                break;
            }
        }
    }
}
impl Render for CommandPalette {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut root = div();
        if !self.open {
            return root;
        }
        let commands = self.ranked(cx);
        let t = theme(cx);
        let mut results = div()
            .id("palette-results")
            .max_h(px(300.))
            .overflow_y_scroll()
            .track_scroll(&self.scroll);
        let mut section = None;
        for (index, command) in commands.iter().enumerate() {
            if command.section != section {
                section = command.section.clone();
                if let Some(name) = &section {
                    results =
                        results.child(div().px(px(12.)).py(px(6.)).child(label(name.clone(), cx)));
                }
            }
            let selected = self.highlighted == Some(index);
            results = results.child(
                div()
                    .id(("palette-command", index))
                    .flex()
                    .items_center()
                    .justify_between()
                    .px(px(12.))
                    .py(px(10.))
                    .rounded(px(4.))
                    .bg(if selected { t.inset } else { t.surface })
                    .text_color(if command.disabled { t.muted } else { t.text })
                    .when(!command.disabled, |d| {
                        d.cursor_pointer().hover(|s| s.bg(t.inset)).on_click(
                            cx.listener(move |this, _, window, cx| this.run(index, window, cx)),
                        )
                    })
                    .child(command.label.clone())
                    .children(command.shortcut.clone().map(|shortcut| label(shortcut, cx))),
            );
        }
        if commands.is_empty() {
            results = results.child(label("No matching commands", cx));
        }
        let body = stack()
            .capture_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                match event.keystroke.key.as_str() {
                    "down" => this.navigate(1, cx),
                    "up" => this.navigate(-1, cx),
                    "enter" => {
                        if let Some(index) = this.highlighted {
                            this.run(index, window, cx);
                        }
                    }
                    _ => return,
                }
                window.prevent_default();
                cx.stop_propagation();
            }))
            .child(self.search.clone())
            .child(results);
        let weak = cx.entity().downgrade();
        root = root.child(
            Modal::new(
                "Command palette",
                body,
                self.search.read(cx).focus_handle(cx),
                move |window, cx| {
                    let _ = weak.update(cx, |this, cx| this.close(window, cx));
                },
            )
            .width(px(560.))
            .tab_order(vec![self.search.read(cx).focus_handle(cx)]),
        );
        root
    }
}
struct Demo {
    palette: Entity<CommandPalette>,
    last: SharedString,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .child(
                control("open-command-palette", "Open commands", cx).on_click(cx.listener(
                    |this, _, window, cx| {
                        this.palette
                            .update(cx, |palette, cx| palette.show(window, cx))
                    },
                )),
            )
            .child(label(format!("Last command: {}", self.last), cx))
            .child(self.palette.clone())
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    cx.new(|cx| {
        let mut commands = vec![
            PaletteCommand::new("new", "New document"),
            PaletteCommand::new("open", "Open workspace"),
            PaletteCommand::new("search", "Search files"),
            PaletteCommand::new("settings", "Open settings"),
            PaletteCommand::new("publish", "Publish workspace"),
        ];
        commands[0].section = Some("Workspace".into());
        commands[1].section = Some("Workspace".into());
        commands[2].keywords = "find locate".into();
        commands[2].shortcut = Some("⌘ F".into());
        commands[4].disabled = true;
        let palette = cx.new(|cx| {
            let mut palette = CommandPalette::new(commands, cx);
            palette.recent_ids = vec!["settings".into()];
            palette
        });
        cx.subscribe(&palette, |this: &mut Demo, _, event: &CommandRun, cx| {
            this.last = event.0.label.clone();
            cx.notify();
        })
        .detach();
        Demo {
            palette,
            last: "None".into(),
        }
    })
    .into()
}
