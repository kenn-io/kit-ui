use std::ops::Range;

// Native text handling adapted from Zed GPUI 0.2.2 examples/input.rs.
// Copyright Zed Industries. Licensed under Apache-2.0.
use crate::theme::{control, label, row, stack, theme};
use gpui::{prelude::*, *};
use unicode_segmentation::*;

actions!(
    mention_textarea,
    [
        Backspace,
        Delete,
        Left,
        Right,
        SelectLeft,
        SelectRight,
        SelectAll,
        Home,
        End,
        ShowCharacterPalette,
        Up,
        Down,
        Newline,
        Accept,
        Dismiss,
        SelectUp,
        SelectDown,
        SelectHome,
        SelectEnd,
        Paste,
        Cut,
        Copy,
    ]
);

#[derive(Clone, Debug)]
pub struct MentionChanged {
    pub text: SharedString,
}

pub struct MentionTextarea {
    focus_handle: FocusHandle,
    content: SharedString,
    placeholder: SharedString,
    selected_range: Range<usize>,
    selection_reversed: bool,
    marked_range: Option<Range<usize>>,
    last_layout: Vec<(usize, ShapedLine)>,
    last_bounds: Option<Bounds<Pixels>>,
    is_selecting: bool,
    pub disabled: bool,
    pub readonly: bool,
    pub invalid: bool,
    pub height: f32,
    horizontal_offset: Pixels,
    pub options: Vec<MentionOption>,
    pub max_results: usize,
    pub hide_empty: bool,
    active: Option<(usize, char, String)>,
    highlight: usize,
}

impl EventEmitter<MentionChanged> for MentionTextarea {}

impl MentionTextarea {
    pub fn new(placeholder: impl Into<SharedString>, cx: &mut Context<Self>) -> Self {
        Self {
            focus_handle: cx.focus_handle().tab_stop(true),
            content: "".into(),
            placeholder: placeholder.into(),
            selected_range: 0..0,
            selection_reversed: false,
            marked_range: None,
            last_layout: Vec::new(),
            last_bounds: None,
            is_selecting: false,
            disabled: false,
            readonly: false,
            invalid: false,
            height: 120.,
            horizontal_offset: px(0.),
            options: Vec::new(),
            max_results: 8,
            hide_empty: false,
            active: None,
            highlight: 0,
        }
    }

    pub fn value(&self) -> SharedString {
        self.content.clone()
    }

    pub fn set_value(&mut self, value: impl Into<SharedString>, cx: &mut Context<Self>) {
        let value = value.into();
        self.content = value.replace("\r\n", "\n").into();
        self.selected_range = self.content.len()..self.content.len();
        self.selection_reversed = false;
        self.marked_range = None;
        self.horizontal_offset = px(0.);
        self.last_layout.clear();
        self.refresh_mentions();
        cx.emit(MentionChanged {
            text: self.content.clone(),
        });
        cx.notify();
    }

    fn left(&mut self, _: &Left, _: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.move_to(self.previous_boundary(self.cursor_offset()), cx);
        } else {
            self.move_to(self.selected_range.start, cx)
        }
    }

    fn right(&mut self, _: &Right, _: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.move_to(self.next_boundary(self.selected_range.end), cx);
        } else {
            self.move_to(self.selected_range.end, cx)
        }
    }

    fn select_left(&mut self, _: &SelectLeft, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(self.previous_boundary(self.cursor_offset()), cx);
    }

    fn select_right(&mut self, _: &SelectRight, _: &mut Window, cx: &mut Context<Self>) {
        self.select_to(self.next_boundary(self.cursor_offset()), cx);
    }

    fn select_all(&mut self, _: &SelectAll, _: &mut Window, cx: &mut Context<Self>) {
        self.move_to(0, cx);
        self.select_to(self.content.len(), cx)
    }

    fn home(&mut self, _: &Home, _: &mut Window, cx: &mut Context<Self>) {
        let start = self.content[..self.cursor_offset()]
            .rfind('\n')
            .map(|i| i + 1)
            .unwrap_or(0);
        self.move_to(start, cx);
    }

    fn end(&mut self, _: &End, _: &mut Window, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let end = self.content[cursor..]
            .find('\n')
            .map(|i| cursor + i)
            .unwrap_or(self.content.len());
        self.move_to(end, cx);
    }

    fn select_home(&mut self, _: &SelectHome, _: &mut Window, cx: &mut Context<Self>) {
        let start = self.content[..self.cursor_offset()]
            .rfind('\n')
            .map(|i| i + 1)
            .unwrap_or(0);
        self.select_to(start, cx);
    }
    fn select_end(&mut self, _: &SelectEnd, _: &mut Window, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let end = self.content[cursor..]
            .find('\n')
            .map(|i| cursor + i)
            .unwrap_or(self.content.len());
        self.select_to(end, cx);
    }

    fn backspace(&mut self, _: &Backspace, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.select_to(self.previous_boundary(self.cursor_offset()), cx)
        }
        self.replace_text_in_range(None, "", window, cx)
    }

    fn delete(&mut self, _: &Delete, window: &mut Window, cx: &mut Context<Self>) {
        if self.selected_range.is_empty() {
            self.select_to(self.next_boundary(self.cursor_offset()), cx)
        }
        self.replace_text_in_range(None, "", window, cx)
    }

    fn on_mouse_down(
        &mut self,
        event: &MouseDownEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.disabled {
            return;
        }
        window.focus(&self.focus_handle);
        self.is_selecting = true;

        if event.modifiers.shift {
            self.select_to(self.index_for_mouse_position(event.position), cx);
        } else {
            self.move_to(self.index_for_mouse_position(event.position), cx)
        }
    }

    fn on_mouse_up(&mut self, _: &MouseUpEvent, _window: &mut Window, _: &mut Context<Self>) {
        self.is_selecting = false;
    }

    fn on_mouse_move(&mut self, event: &MouseMoveEvent, _: &mut Window, cx: &mut Context<Self>) {
        if self.is_selecting {
            self.select_to(self.index_for_mouse_position(event.position), cx);
        }
    }

    fn show_character_palette(
        &mut self,
        _: &ShowCharacterPalette,
        window: &mut Window,
        _: &mut Context<Self>,
    ) {
        window.show_character_palette();
    }

    fn paste(&mut self, _: &Paste, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(text) = cx.read_from_clipboard().and_then(|item| item.text()) {
            self.replace_text_in_range(None, &text, window, cx);
        }
    }

    fn copy(&mut self, _: &Copy, _: &mut Window, cx: &mut Context<Self>) {
        if !self.selected_range.is_empty() {
            cx.write_to_clipboard(ClipboardItem::new_string(
                self.content[self.selected_range.clone()].to_string(),
            ));
        }
    }
    fn cut(&mut self, _: &Cut, window: &mut Window, cx: &mut Context<Self>) {
        if !self.selected_range.is_empty() {
            cx.write_to_clipboard(ClipboardItem::new_string(
                self.content[self.selected_range.clone()].to_string(),
            ));
            self.replace_text_in_range(None, "", window, cx)
        }
    }

    fn move_to(&mut self, offset: usize, cx: &mut Context<Self>) {
        self.selected_range = offset..offset;
        self.selection_reversed = false;
        self.refresh_mentions();
        cx.notify()
    }

    fn cursor_offset(&self) -> usize {
        if self.selection_reversed {
            self.selected_range.start
        } else {
            self.selected_range.end
        }
    }

    fn index_for_mouse_position(&self, position: Point<Pixels>) -> usize {
        if self.content.is_empty() {
            return 0;
        }

        let Some(bounds) = self.last_bounds else {
            return 0;
        };
        let row = (((position.y - bounds.top()) / px(22.)).max(0.) as usize)
            .min(self.last_layout.len().saturating_sub(1));
        self.last_layout
            .get(row)
            .map(|(start, line)| start + line.closest_index_for_x(position.x - bounds.left()))
            .unwrap_or(0)
    }

    fn select_to(&mut self, offset: usize, cx: &mut Context<Self>) {
        if self.selection_reversed {
            self.selected_range.start = offset
        } else {
            self.selected_range.end = offset
        };
        if self.selected_range.end < self.selected_range.start {
            self.selection_reversed = !self.selection_reversed;
            self.selected_range = self.selected_range.end..self.selected_range.start;
        }
        self.refresh_mentions();
        cx.notify()
    }

    fn offset_from_utf16(&self, offset: usize) -> usize {
        let mut utf8_offset = 0;
        let mut utf16_count = 0;

        for ch in self.content.chars() {
            if utf16_count >= offset {
                break;
            }
            utf16_count += ch.len_utf16();
            utf8_offset += ch.len_utf8();
        }

        utf8_offset
    }

    fn offset_to_utf16(&self, offset: usize) -> usize {
        let mut utf16_offset = 0;
        let mut utf8_count = 0;

        for ch in self.content.chars() {
            if utf8_count >= offset {
                break;
            }
            utf8_count += ch.len_utf8();
            utf16_offset += ch.len_utf16();
        }

        utf16_offset
    }

    fn range_to_utf16(&self, range: &Range<usize>) -> Range<usize> {
        self.offset_to_utf16(range.start)..self.offset_to_utf16(range.end)
    }

    fn range_from_utf16(&self, range_utf16: &Range<usize>) -> Range<usize> {
        self.offset_from_utf16(range_utf16.start)..self.offset_from_utf16(range_utf16.end)
    }

    fn previous_boundary(&self, offset: usize) -> usize {
        self.content
            .grapheme_indices(true)
            .rev()
            .find_map(|(idx, _)| (idx < offset).then_some(idx))
            .unwrap_or(0)
    }

    fn next_boundary(&self, offset: usize) -> usize {
        self.content
            .grapheme_indices(true)
            .find_map(|(idx, _)| (idx > offset).then_some(idx))
            .unwrap_or(self.content.len())
    }
}

impl EntityInputHandler for MentionTextarea {
    fn text_for_range(
        &mut self,
        range_utf16: Range<usize>,
        actual_range: &mut Option<Range<usize>>,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<String> {
        let range = self.range_from_utf16(&range_utf16);
        actual_range.replace(self.range_to_utf16(&range));
        Some(self.content[range].to_string())
    }

    fn selected_text_range(
        &mut self,
        _ignore_disabled_input: bool,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<UTF16Selection> {
        if self.disabled {
            return None;
        }
        Some(UTF16Selection {
            range: self.range_to_utf16(&self.selected_range),
            reversed: self.selection_reversed,
        })
    }

    fn marked_text_range(
        &self,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<Range<usize>> {
        self.marked_range
            .as_ref()
            .map(|range| self.range_to_utf16(range))
    }

    fn unmark_text(&mut self, _window: &mut Window, cx: &mut Context<Self>) {
        self.marked_range = None;
        cx.notify();
    }

    fn replace_text_in_range(
        &mut self,
        range_utf16: Option<Range<usize>>,
        new_text: &str,
        _: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.disabled || self.readonly {
            return;
        }
        let new_text = new_text.replace("\r\n", "\n");
        let new_text = new_text.as_str();
        let range = range_utf16
            .as_ref()
            .map(|range_utf16| self.range_from_utf16(range_utf16))
            .or(self.marked_range.clone())
            .unwrap_or(self.selected_range.clone());

        self.content =
            (self.content[0..range.start].to_owned() + new_text + &self.content[range.end..])
                .into();
        self.selected_range = range.start + new_text.len()..range.start + new_text.len();
        self.marked_range.take();
        self.selection_reversed = false;
        self.refresh_mentions();
        cx.emit(MentionChanged {
            text: self.content.clone(),
        });
        cx.notify();
    }

    fn replace_and_mark_text_in_range(
        &mut self,
        range_utf16: Option<Range<usize>>,
        new_text: &str,
        new_selected_range_utf16: Option<Range<usize>>,
        _window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if self.disabled || self.readonly {
            return;
        }
        let new_text = new_text.replace("\r\n", "\n");
        let new_text = new_text.as_str();
        let range = range_utf16
            .as_ref()
            .map(|range_utf16| self.range_from_utf16(range_utf16))
            .or(self.marked_range.clone())
            .unwrap_or(self.selected_range.clone());

        self.content =
            (self.content[0..range.start].to_owned() + new_text + &self.content[range.end..])
                .into();
        if !new_text.is_empty() {
            self.marked_range = Some(range.start..range.start + new_text.len());
        } else {
            self.marked_range = None;
        }
        let insertion_start_utf16 = self.offset_to_utf16(range.start);
        let inserted_len = new_text.encode_utf16().count();
        self.selected_range = new_selected_range_utf16
            .map(|selected| {
                self.range_from_utf16(
                    &(insertion_start_utf16 + selected.start.min(inserted_len)
                        ..insertion_start_utf16 + selected.end.min(inserted_len)),
                )
            })
            .unwrap_or_else(|| range.start + new_text.len()..range.start + new_text.len());

        self.selection_reversed = false;
        self.refresh_mentions();
        cx.emit(MentionChanged {
            text: self.content.clone(),
        });
        cx.notify();
    }

    fn bounds_for_range(
        &mut self,
        range_utf16: Range<usize>,
        bounds: Bounds<Pixels>,
        _window: &mut Window,
        _cx: &mut Context<Self>,
    ) -> Option<Bounds<Pixels>> {
        let range = self.range_from_utf16(&range_utf16);
        let (row, (start, line)) = self
            .last_layout
            .iter()
            .enumerate()
            .rev()
            .find(|(_, (start, _))| *start <= range.start)?;
        let bounds = self.last_bounds.unwrap_or(bounds);
        let y = bounds.top() + px(row as f32 * 22.);
        Some(Bounds::new(
            point(bounds.left() + line.x_for_index(range.start - start), y),
            size(
                (line.x_for_index(range.end.min(start + line.text.len()) - start)
                    - line.x_for_index(range.start - start))
                .max(px(2.)),
                px(22.),
            ),
        ))
    }

    fn character_index_for_point(
        &mut self,
        point: Point<Pixels>,
        _: &mut Window,
        _: &mut Context<Self>,
    ) -> Option<usize> {
        Some(self.offset_to_utf16(self.index_for_mouse_position(point)))
    }
}

/// A synchronous suggestion source. Each trigger has its own filtered options.
#[derive(Clone)]
pub struct MentionOption {
    pub trigger: char,
    pub insert: SharedString,
    pub label: SharedString,
    pub meta: SharedString,
}

impl MentionTextarea {
    fn refresh_mentions(&mut self) {
        let caret = self.cursor_offset();
        let before = &self.content[..caret];
        let start = before
            .rfind(char::is_whitespace)
            .map(|i| i + before[i..].chars().next().unwrap().len_utf8())
            .unwrap_or(0);
        self.active = before[start..]
            .chars()
            .next()
            .filter(|ch| self.options.iter().any(|o| o.trigger == *ch))
            .map(|ch| (start, ch, before[start + ch.len_utf8()..].to_string()));
        self.highlight = 0;
    }

    fn matches(&self) -> Vec<MentionOption> {
        let Some((_, trigger, query)) = &self.active else {
            return Vec::new();
        };
        let query = query.to_lowercase();
        self.options
            .iter()
            .filter(|o| {
                o.trigger == *trigger
                    && (o.insert.to_lowercase().contains(&query)
                        || o.label.to_lowercase().contains(&query))
            })
            .take(self.max_results)
            .cloned()
            .collect()
    }

    fn insert_option(
        &mut self,
        option: MentionOption,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let Some((start, trigger, _)) = self.active.clone() else {
            return;
        };
        self.selected_range = start..self.cursor_offset();
        self.replace_text_in_range(None, &format!("{trigger}{} ", option.insert), window, cx);
        self.active = None;
        window.focus(&self.focus_handle);
        cx.notify();
    }

    fn vertical(&mut self, direction: isize, select: bool, cx: &mut Context<Self>) {
        let cursor = self.cursor_offset();
        let Some((row, (start, line))) = self
            .last_layout
            .iter()
            .enumerate()
            .rev()
            .find(|(_, (start, _))| *start <= cursor)
        else {
            return;
        };
        let target =
            (row as isize + direction).clamp(0, self.last_layout.len() as isize - 1) as usize;
        let x = line.x_for_index(cursor - start);
        let (start, line) = &self.last_layout[target];
        let offset = start + line.closest_index_for_x(x);
        if select {
            self.select_to(offset, cx);
        } else {
            self.move_to(offset, cx);
        }
    }

    fn up(&mut self, _: &Up, _: &mut Window, cx: &mut Context<Self>) {
        let n = self.matches().len();
        if n > 0 {
            self.highlight = (self.highlight + n - 1) % n;
            cx.notify();
        } else {
            self.vertical(-1, false, cx);
        }
    }
    fn down(&mut self, _: &Down, _: &mut Window, cx: &mut Context<Self>) {
        let n = self.matches().len();
        if n > 0 {
            self.highlight = (self.highlight + 1) % n;
            cx.notify();
        } else {
            self.vertical(1, false, cx);
        }
    }
    fn select_up(&mut self, _: &SelectUp, _: &mut Window, cx: &mut Context<Self>) {
        self.vertical(-1, true, cx);
    }
    fn select_down(&mut self, _: &SelectDown, _: &mut Window, cx: &mut Context<Self>) {
        self.vertical(1, true, cx);
    }
    fn newline(&mut self, _: &Newline, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(option) = self.matches().get(self.highlight).cloned() {
            self.insert_option(option, window, cx);
        } else {
            self.replace_text_in_range(None, "\n", window, cx);
        }
    }
    fn accept(&mut self, _: &Accept, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(option) = self.matches().get(self.highlight).cloned() {
            self.insert_option(option, window, cx);
        } else {
            cx.propagate();
        }
    }
    fn dismiss(&mut self, _: &Dismiss, _: &mut Window, cx: &mut Context<Self>) {
        self.active = None;
        cx.notify();
    }
}

struct TextElement {
    input: Entity<MentionTextarea>,
}
struct PrepaintState {
    lines: Vec<(usize, ShapedLine)>,
    cursor: Option<PaintQuad>,
    selections: Vec<PaintQuad>,
    origin: Point<Pixels>,
}
impl IntoElement for TextElement {
    type Element = Self;
    fn into_element(self) -> Self {
        self
    }
}
impl Element for TextElement {
    type RequestLayoutState = ();
    type PrepaintState = PrepaintState;
    fn id(&self) -> Option<ElementId> {
        None
    }
    fn source_location(&self) -> Option<&'static core::panic::Location<'static>> {
        None
    }
    fn request_layout(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        let input = self.input.read(cx);
        let mut style = Style::default();
        style.size.width = relative(1.).into();
        style.size.height =
            px((input.content.split('\n').count() as f32 * 22.).max(input.height)).into();
        (window.request_layout(style, [], cx), ())
    }
    fn prepaint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) -> PrepaintState {
        let input = self.input.read(cx);
        let style = window.text_style();
        let placeholder = input.content.is_empty();
        let text = if placeholder {
            input.placeholder.clone()
        } else {
            input.content.clone()
        };
        let mut start = 0;
        let mut lines = Vec::new();
        for text in text.split('\n') {
            let run = TextRun {
                len: text.len(),
                font: style.font(),
                color: if placeholder {
                    theme(cx).muted
                } else {
                    style.color
                },
                background_color: None,
                underline: None,
                strikethrough: None,
            };
            let mut runs = vec![run.clone()];
            if !placeholder && let Some(mark) = &input.marked_range {
                let a = mark.start.saturating_sub(start).min(text.len());
                let b = mark.end.saturating_sub(start).min(text.len());
                if a < b {
                    runs = vec![
                        TextRun {
                            len: a,
                            ..run.clone()
                        },
                        TextRun {
                            len: b - a,
                            underline: Some(UnderlineStyle {
                                color: Some(run.color),
                                thickness: px(1.),
                                wavy: false,
                            }),
                            ..run.clone()
                        },
                        TextRun {
                            len: text.len() - b,
                            ..run
                        },
                    ];
                    runs.retain(|r| r.len > 0);
                }
            }
            lines.push((
                start,
                window.text_system().shape_line(
                    text.to_owned().into(),
                    style.font_size.to_pixels(window.rem_size()),
                    &runs,
                    None,
                ),
            ));
            start += text.len() + 1;
        }
        let cursor = input.cursor_offset();
        let selected = input.selected_range.clone();
        let mut offset = input.horizontal_offset;
        if let Some((_, (start, line))) = lines
            .iter()
            .enumerate()
            .rev()
            .find(|(_, (s, _))| *s <= cursor)
        {
            let x = line.x_for_index(cursor - start);
            if x - offset > bounds.size.width - px(2.) {
                offset = (x - bounds.size.width + px(2.)).max(px(0.));
            } else if x < offset {
                offset = x;
            }
        }
        let origin = point(bounds.left() - offset, bounds.top());
        let mut selections = Vec::new();
        let mut caret = None;
        for (row, (start, line)) in lines.iter().enumerate() {
            let y = origin.y + px(row as f32 * 22.);
            let end = start + line.text.len();
            if selected.is_empty() && cursor >= *start && cursor <= end {
                caret = Some(fill(
                    Bounds::new(
                        point(origin.x + line.x_for_index(cursor - start), y),
                        size(px(2.), px(22.)),
                    ),
                    theme(cx).accent,
                ));
            } else if !selected.is_empty() && selected.start <= end && selected.end > *start {
                let a = selected.start.max(*start) - start;
                let b = selected.end.min(end) - start;
                let width = (line.x_for_index(b) - line.x_for_index(a)).max(px(3.));
                selections.push(fill(
                    Bounds::new(
                        point(origin.x + line.x_for_index(a), y),
                        size(width, px(22.)),
                    ),
                    theme(cx).accent.opacity(0.25),
                ));
            }
        }
        self.input
            .update(cx, |input, _| input.horizontal_offset = offset);
        PrepaintState {
            lines,
            cursor: caret,
            selections,
            origin,
        }
    }
    fn paint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _: &mut (),
        state: &mut PrepaintState,
        window: &mut Window,
        cx: &mut App,
    ) {
        let input = self.input.read(cx);
        let focus = input.focus_handle.clone();
        if !input.disabled {
            window.handle_input(
                &focus,
                ElementInputHandler::new(bounds, self.input.clone()),
                cx,
            );
        }
        for selection in state.selections.drain(..) {
            window.paint_quad(selection);
        }
        for (row, (_, line)) in state.lines.iter().enumerate() {
            line.paint(
                point(state.origin.x, state.origin.y + px(row as f32 * 22.)),
                px(22.),
                window,
                cx,
            )
            .unwrap();
        }
        if focus.is_focused(window)
            && let Some(cursor) = state.cursor.take()
        {
            window.paint_quad(cursor);
        }
        self.input.update(cx, |input, _| {
            input.last_layout = std::mem::take(&mut state.lines);
            input.last_bounds = Some(Bounds::new(state.origin, bounds.size));
        });
    }
}

impl Render for MentionTextarea {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let t = theme(cx);
        let focused = self.focus_handle.is_focused(window);
        let matches = self.matches();
        let menu = focused && self.active.is_some() && (!self.hide_empty || !matches.is_empty());
        stack()
            .gap(px(4.))
            .child(
                div()
                    .key_context("MentionTextarea")
                    .track_focus(&self.focus_handle.clone().tab_stop(!self.disabled))
                    .cursor(CursorStyle::IBeam)
                    .w_full()
                    .p(px(8.))
                    .border_1()
                    .rounded(px(4.))
                    .border_color(if self.invalid {
                        t.danger
                    } else if focused {
                        t.accent
                    } else {
                        t.border
                    })
                    .bg(t.surface)
                    .text_color(t.text)
                    .text_size(px(13.))
                    .line_height(px(22.))
                    .opacity(if self.disabled { 0.5 } else { 1. })
                    .on_action(cx.listener(Self::backspace))
                    .on_action(cx.listener(Self::delete))
                    .on_action(cx.listener(Self::left))
                    .on_action(cx.listener(Self::right))
                    .on_action(cx.listener(Self::select_left))
                    .on_action(cx.listener(Self::select_right))
                    .on_action(cx.listener(Self::select_all))
                    .on_action(cx.listener(Self::home))
                    .on_action(cx.listener(Self::end))
                    .on_action(cx.listener(Self::select_home))
                    .on_action(cx.listener(Self::select_end))
                    .on_action(cx.listener(Self::paste))
                    .on_action(cx.listener(Self::copy))
                    .on_action(cx.listener(Self::cut))
                    .on_action(cx.listener(Self::show_character_palette))
                    .on_action(cx.listener(Self::up))
                    .on_action(cx.listener(Self::down))
                    .on_action(cx.listener(Self::select_up))
                    .on_action(cx.listener(Self::select_down))
                    .on_action(cx.listener(Self::newline))
                    .on_action(cx.listener(Self::accept))
                    .on_action(cx.listener(Self::dismiss))
                    .on_mouse_down(MouseButton::Left, cx.listener(Self::on_mouse_down))
                    .on_mouse_up(MouseButton::Left, cx.listener(Self::on_mouse_up))
                    .on_mouse_up_out(MouseButton::Left, cx.listener(Self::on_mouse_up))
                    .on_mouse_move(cx.listener(Self::on_mouse_move))
                    .child(
                        div()
                            .w_full()
                            .overflow_hidden()
                            .child(TextElement { input: cx.entity() }),
                    ),
            )
            .when(menu, |s| {
                s.child(
                    stack()
                        .gap(px(2.))
                        .p(px(4.))
                        .border_1()
                        .border_color(t.border)
                        .rounded(px(4.))
                        .bg(t.surface)
                        .when(matches.is_empty(), |s| s.child(label("No matches", cx)))
                        .children(matches.into_iter().enumerate().map(|(index, option)| {
                            let title = format!(
                                "{}{}   {}   {}",
                                option.trigger, option.insert, option.label, option.meta
                            );
                            control(("mention-option", index), title, cx)
                                .tab_stop(false)
                                .when(index == self.highlight, |d| {
                                    d.bg(t.inset).border_color(t.accent)
                                })
                                .on_mouse_down(
                                    MouseButton::Left,
                                    cx.listener(move |this, _, window, cx| {
                                        this.insert_option(option.clone(), window, cx);
                                        cx.stop_propagation();
                                    }),
                                )
                        })),
                )
            })
    }
}
impl Focusable for MentionTextarea {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}

pub fn init(cx: &mut App) {
    cx.bind_keys([
        KeyBinding::new("backspace", Backspace, Some("MentionTextarea")),
        KeyBinding::new("delete", Delete, Some("MentionTextarea")),
        KeyBinding::new("left", Left, Some("MentionTextarea")),
        KeyBinding::new("right", Right, Some("MentionTextarea")),
        KeyBinding::new("shift-left", SelectLeft, Some("MentionTextarea")),
        KeyBinding::new("shift-right", SelectRight, Some("MentionTextarea")),
        KeyBinding::new("up", Up, Some("MentionTextarea")),
        KeyBinding::new("down", Down, Some("MentionTextarea")),
        KeyBinding::new("shift-up", SelectUp, Some("MentionTextarea")),
        KeyBinding::new("shift-down", SelectDown, Some("MentionTextarea")),
        KeyBinding::new("enter", Newline, Some("MentionTextarea")),
        KeyBinding::new("tab", Accept, Some("MentionTextarea")),
        KeyBinding::new("escape", Dismiss, Some("MentionTextarea")),
        KeyBinding::new("cmd-a", SelectAll, Some("MentionTextarea")),
        KeyBinding::new("ctrl-a", SelectAll, Some("MentionTextarea")),
        KeyBinding::new("cmd-v", Paste, Some("MentionTextarea")),
        KeyBinding::new("ctrl-v", Paste, Some("MentionTextarea")),
        KeyBinding::new("cmd-c", Copy, Some("MentionTextarea")),
        KeyBinding::new("ctrl-c", Copy, Some("MentionTextarea")),
        KeyBinding::new("cmd-x", Cut, Some("MentionTextarea")),
        KeyBinding::new("ctrl-x", Cut, Some("MentionTextarea")),
        KeyBinding::new("home", Home, Some("MentionTextarea")),
        KeyBinding::new("end", End, Some("MentionTextarea")),
        KeyBinding::new("shift-home", SelectHome, Some("MentionTextarea")),
        KeyBinding::new("shift-end", SelectEnd, Some("MentionTextarea")),
        KeyBinding::new(
            "ctrl-cmd-space",
            ShowCharacterPalette,
            Some("MentionTextarea"),
        ),
    ]);
}
struct Demo {
    input: Entity<MentionTextarea>,
    saved: SharedString,
}
impl Render for Demo {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        stack()
            .max_w(px(560.))
            .child(label("Message", cx))
            .child(self.input.clone())
            .child(
                row().child(
                    control("mention-submit", "Save message", cx).on_click(cx.listener(
                        |this, _, _, cx| {
                            this.saved = this.input.read(cx).value();
                            cx.notify();
                        },
                    )),
                ),
            )
            .child(label("Saved message", cx))
            .child(
                stack().gap(px(0.)).children(
                    self.saved
                        .split('\n')
                        .map(|line| div().min_h(px(22.)).child(line.to_owned())),
                ),
            )
    }
}
pub fn demo(cx: &mut App) -> AnyView {
    init(cx);
    cx.new(|cx| {
        let input = cx.new(|cx| {
            let mut input = MentionTextarea::new(
                "Write a message… Use # for issues, @ for people, / for commands.",
                cx,
            );
            input.options = [
                ('#', "42", "Fix sidebar", "issue"),
                ('#', "108", "Native gallery", "issue"),
                ('@', "alex", "Alex", "teammate"),
                ('@', "sam", "Sam", "teammate"),
                ('/', "review", "Request review", "command"),
                ('/', "summarize", "Summarize", "command"),
            ]
            .into_iter()
            .map(|(trigger, insert, label, meta)| MentionOption {
                trigger,
                insert: insert.into(),
                label: label.into(),
                meta: meta.into(),
            })
            .collect();
            input
        });
        Demo {
            input,
            saved: "No saved message".into(),
        }
    })
    .into()
}

#[cfg(test)]
mod tests {
    use super::{MentionOption, MentionTextarea, init};
    use gpui::{Focusable, TestAppContext};

    #[gpui::test]
    fn multiline_editing_and_keyboard_mentions(cx: &mut TestAppContext) {
        cx.update(|cx| {
            cx.set_global(crate::theme::Theme::light());
            init(cx);
        });
        let (input, cx) = cx.add_window_view(|window, cx| {
            let mut input = MentionTextarea::new("Message", cx);
            input.options = vec![
                MentionOption {
                    trigger: '@',
                    insert: "alex".into(),
                    label: "Alex".into(),
                    meta: "".into(),
                },
                MentionOption {
                    trigger: '@',
                    insert: "alice".into(),
                    label: "Alice".into(),
                    meta: "".into(),
                },
            ];
            input.focus_handle(cx).focus(window);
            input
        });
        cx.simulate_input("First 🦀");
        cx.simulate_keystrokes("enter");
        cx.simulate_input("Hello @al");
        cx.simulate_keystrokes("down enter");
        assert_eq!(
            input.read_with(cx, |i, _| i.value().to_string()),
            "First 🦀\nHello @alice "
        );
        cx.simulate_keystrokes("enter");
        cx.simulate_input("Third");
        cx.simulate_keystrokes("home shift-end");
        cx.simulate_input("Last");
        assert_eq!(
            input.read_with(cx, |i, _| i.value().to_string()),
            "First 🦀\nHello @alice \nLast"
        );
        cx.simulate_keystrokes("cmd-a");
        cx.simulate_input("Pasted\nmultiline");
        assert_eq!(
            input.read_with(cx, |i, _| i.value().to_string()),
            "Pasted\nmultiline"
        );
    }
}
