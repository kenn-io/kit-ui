// Components
export { default as BottomDock } from "./components/BottomDock.svelte";
export { default as Button } from "./components/Button.svelte";
export type { ButtonSize, ButtonSurface, ButtonTone } from "./components/Button.svelte";
export { default as Calendar } from "./components/Calendar.svelte";
export { default as Checkbox } from "./components/Checkbox.svelte";
export { default as Card } from "./components/Card.svelte";
export type { CardLevel, CardPadding, CardTone } from "./components/Card.svelte";
export { default as Chip } from "./components/Chip.svelte";
export type { ChipSize, ChipTone } from "./components/Chip.svelte";
export { default as ChipStack } from "./components/ChipStack.svelte";
export { default as CodeBlock } from "./components/CodeBlock.svelte";
export { default as CollapsibleSidebar } from "./components/CollapsibleSidebar.svelte";
export { default as ColorLabel } from "./components/ColorLabel.svelte";
export type { ColorLabelSize } from "./components/ColorLabel.svelte";
export { default as CommandPalette } from "./components/CommandPalette.svelte";
export { default as CommentCard } from "./components/CommentCard.svelte";
export type { PaletteCommand } from "./components/CommandPalette.svelte";
export { default as CopyButton } from "./components/CopyButton.svelte";
export { default as DetailDrawer } from "./components/DetailDrawer.svelte";
export { default as DiffStats, formatDiffStat } from "./components/DiffStats.svelte";
export { default as EmptyState } from "./components/EmptyState.svelte";
export { default as FilterDropdown } from "./components/FilterDropdown.svelte";
export type { FilterDropdownItem, FilterDropdownSection } from "./components/FilterDropdown.svelte";
export { default as FindBar } from "./components/FindBar.svelte";
export { default as FitStages } from "./components/FitStages.svelte";
export { default as FlashBanner } from "./components/FlashBanner.svelte";
export { default as IconButton } from "./components/IconButton.svelte";
export type { IconButtonSize, IconButtonTone } from "./components/IconButton.svelte";
export { default as ImagePreview } from "./components/ImagePreview.svelte";
export { default as KbdBadge } from "./components/KbdBadge.svelte";
export { default as Markdown } from "./components/Markdown.svelte";
export { default as MentionTextarea } from "./components/MentionTextarea.svelte";
export type { MentionOption } from "./components/mention.js";
export { default as Modal } from "./components/Modal.svelte";
export type { ModalTone } from "./components/Modal.svelte";
export { default as DateRangePicker } from "./components/DateRangePicker.svelte";
export {
  allFromDate,
  daysAgo,
  DEFAULT_RANGE_PRESETS,
  localDateStr,
  monthGridDates,
  monthLabels,
  periodBounds,
  presetRange,
  resolveRange,
  stepAnchor,
  todayStr,
  weekdayLabels,
  type CalendarNavLabels,
  type CalendarSelection,
  type CalendarUnit,
  type CustomSelection,
  type DateRange,
  type RangeMode,
  type RangePreset,
  type RangeSelection,
  type RelativeSelection,
} from "./components/date-range.js";
export { default as RefreshControl } from "./components/RefreshControl.svelte";
export { default as ScrollBox } from "./components/ScrollBox.svelte";
export { default as SearchInput } from "./components/SearchInput.svelte";
export { default as SegmentedControl } from "./components/SegmentedControl.svelte";
export type {
  SegmentedControlOption,
  SegmentedControlTone,
} from "./components/SegmentedControl.svelte";
export { default as SelectDropdown } from "./components/SelectDropdown.svelte";
export type {
  SelectDropdownIndicator,
  SelectDropdownIndicatorTone,
  SelectDropdownOption,
} from "./components/select-dropdown.js";
export { default as SettingsLayout } from "./components/SettingsLayout.svelte";
export type { SettingsCategory } from "./components/SettingsLayout.svelte";
export { default as SettingsSection } from "./components/SettingsSection.svelte";
export { default as SidebarToggle } from "./components/SidebarToggle.svelte";
export type { SidebarToggleState } from "./components/SidebarToggle.svelte";
export { default as Spinner } from "./components/Spinner.svelte";
export { default as SplitResizeHandle } from "./components/SplitResizeHandle.svelte";
export type { SplitResizeEvent, SplitResizeOrientation } from "./components/split-resize.js";
export { default as StatusBar } from "./components/StatusBar.svelte";
export { default as StatusDot } from "./components/StatusDot.svelte";
export type { StatusDotStatus } from "./components/StatusDot.svelte";
export { default as Table } from "./components/Table.svelte";
export { default as TableHeaderCell } from "./components/TableHeaderCell.svelte";
export type { SortDirection } from "./components/TableHeaderCell.svelte";
export { default as TextInput } from "./components/TextInput.svelte";
export type { TextInputSize } from "./components/TextInput.svelte";
export { default as ThemeToggle } from "./components/ThemeToggle.svelte";
export { default as Timeline } from "./components/Timeline.svelte";
export { default as TimelineItem } from "./components/TimelineItem.svelte";
export type { TimelineTone } from "./components/TimelineItem.svelte";
export { default as Toggle } from "./components/Toggle.svelte";
export { default as Tooltip } from "./components/Tooltip.svelte";
export { default as TopBar } from "./components/TopBar.svelte";
export type {
  TopBarTab,
  TopBarTabIndicator,
  TopBarTabIndicatorTone,
} from "./components/TopBar.svelte";
export { default as Typeahead } from "./components/Typeahead.svelte";
export type { TypeaheadOption } from "./components/typeahead.js";
export { default as VirtualList } from "./components/VirtualList.svelte";
export {
  offsetOfIndex,
  virtualSlice,
  type VirtualSlice,
  type VirtualSliceInput,
} from "./components/virtual.js";

// Breakpoints
export { BREAKPOINTS, MEDIA, type BreakpointName } from "./breakpoints.js";

// Stores
export {
  dismissFlash,
  getFlash,
  getFlashes,
  getFlashMessage,
  showFlash,
  type FlashOptions,
  type FlashState,
  type FlashTone,
} from "./stores/flash.svelte.js";
export {
  cleanupTheme,
  getHighContrast,
  getThemeMode,
  getThemeName,
  initTheme,
  isDark,
  KIT_THEMES,
  setHighContrast,
  setThemeMode,
  setThemeName,
  type KitThemeInfo,
  type ThemeMode,
  type ThemeOptions,
} from "./stores/theme.svelte.js";

// Utilities
export { copyToClipboard } from "./utils/clipboard.js";
export { DEFAULT_HASH_PALETTE, hashColor } from "./utils/color-hash.js";
export { debounce, type DebouncedFn } from "./utils/debounce.js";
export { trapFocus } from "./utils/focus-trap.js";
export { autoReposition, dismissable, type DismissableOptions } from "./utils/popover.js";
export { backdropCloses, escapeCloses } from "./utils/overlay.js";
export { formatCost, formatDuration, formatNumber, formatTokenCount } from "./utils/format.js";
export {
  createRefreshScheduler,
  DEFAULT_REFRESH_INTERVAL_MS,
  formatRefreshAge,
  type RefreshScheduler,
} from "./utils/refresh.js";
export {
  appShortcuts,
  createShortcutManager,
  formatShortcutKeys,
  initShortcuts,
  isMacPlatform,
  parseShortcut,
  ROOT_SCOPE,
  shortcutMatches,
  type ParsedShortcut,
  type RegisteredShortcut,
  type ShortcutManager,
  type ShortcutOptions,
} from "./utils/shortcuts.js";
export {
  codeFenceLanguage,
  createMarkdownRenderer,
  escapeHtml,
  highlightCode,
  renderMarkdown,
  renderMarkdownSync,
  type MarkdownRenderer,
  type MarkdownRendererOptions,
} from "./utils/markdown.js";
export { formatRelativeTime, formatTimestamp, truncate } from "./utils/time.js";
export { floatingPopoverStyle, type FloatingPopoverInput } from "./components/floatingPosition.js";
