/** Extract the contents of <style> blocks from a .svelte file, preserving
 * offsets so line numbers stay correct. For .css files, the whole file is one
 * block at offset 0. */
export function styleBlocks(source: any, filename: any): {
    css: any;
    offset: number;
}[];
/** @media widths must come from the shared breakpoint set. */
export function checkBreakpoints(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Raw colors in styles should be theme tokens. Colors inside var()
 * fallbacks are allowed; inside color-mix() only the pure #000/#fff shade
 * constants are (mixing arbitrary palette hex would dodge the contract). */
export function checkRawColors(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Literal disabled opacity drifts from the shared state token. Only inspect
 * selectors that target the disabled control itself; dimming a descendant is
 * a separate visual treatment. */
export function checkHandRolledDisabledState(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Custom transforms on the active control bypass the shared press motion. */
export function checkHandRolledPressState(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** A fixed full-viewport overlay is almost always a hand-rolled modal. */
export function checkHandRolledModal(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** A rotate-to-360 keyframe is a hand-rolled spinner. */
export function checkHandRolledSpinner(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** The popover card chrome (border-default + radius-md + shadow-lg on one
 * rule) is the library's floating-surface identity — theme.css ships it as
 * .kit-popover-card, so a hand-written copy should use the class instead.
 * Matching needs all three in one rule block: shadow-lg alone is also the
 * drawer/flash chrome, and border+radius alone is any card. */
export function checkHandRolledPopoverCard(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** The three Card hierarchy recipes (inset / default / raised). Matching is
 * signature-exact — background + border + radius (+ shadow-sm for raised)
 * in one rule — so near-misses like TextInput's wrapper (bg-surface +
 * border-DEFAULT + radius-md) stay clean. The popover chrome (shadow-lg)
 * is the separate hand-rolled-popover-card rule. */
export function checkHandRolledCard(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Direct clipboard writes should go through copyToClipboard / CopyButton
 * (they handle the non-secure-context fallback). */
export function checkClipboard(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Custom combobox/listbox markup duplicates the dropdown components. */
export function checkCombobox(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Raw <kbd> elements duplicate KbdBadge. */
export function checkKbd(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** A pane-resize cursor in styles is a hand-rolled pane splitter. */
export function checkHandRolledSplitter(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** A segmented-control/seg-btn pattern that consumer apps repeat inline. Matches
 * only class attributes and CSS selectors, not prose or identifiers. */
export function checkHandRolledSegmented(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled hover tooltips duplicate Tooltip. role="tooltip" is the
 * reliable marker: any conformant custom tooltip must carry it. */
export function checkHandRolledTooltip(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled bottom status bars duplicate StatusBar. Matches the class
 * name both apps converged on; kit-status-bar (the library's own class,
 * e.g. in retheming CSS) is exempt. */
export function checkHandRolledStatusBar(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled app header bars duplicate TopBar. Matches the class names
 * both apps' AppHeaders converged on (app-header / header-left /
 * header-right); kit-top-bar is exempt. */
export function checkHandRolledTopBar(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled square icon buttons duplicate IconButton. Matches the
 * icon-btn / icon-button class names both apps converged on;
 * kit-icon-button is exempt. */
export function checkHandRolledIconButton(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled code-block cards duplicate CodeBlock. Matches the
 * .code-block class both apps converged on (a pre wrapper with copy
 * button + language label); kit-code-block is exempt. */
export function checkHandRolledCodeBlock(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled empty/placeholder states duplicate EmptyState. */
export function checkHandRolledEmptyState(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled image preview panels duplicate ImagePreview. Matches
 * image-preview class names (including prefixed diff-image-preview);
 * kit-image-preview is exempt. */
export function checkHandRolledImagePreview(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Custom sortable table headers duplicate TableHeaderCell. */
export function checkHandRolledTableSort(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled search inputs duplicate SearchInput. type="search" is the
 * reliable marker; the class names are established consumer patterns.
 * kit-search-input (the library's own class) is exempt. */
export function checkHandRolledSearchInput(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Native date inputs duplicate the calendar components (and render
 * platform chrome that ignores the theme). */
export function checkHandRolledDateInput(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled toasts/snackbars duplicate FlashBanner + the flash store.
 * \b also matches inside compounds like undo-toast. */
export function checkHandRolledToast(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled slide-in drawers and explicit inline bottom-panel patterns
 * duplicate DetailDrawer or BottomDock. Other drawer-* and generic dock names
 * are left alone; kit component classes are exempt. */
export function checkHandRolledDrawer(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled find bars duplicate FindBar; kit-find-bar is exempt. */
export function checkHandRolledFindBar(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled status dots duplicate StatusDot; kit-status-dot is exempt. */
export function checkHandRolledStatusDot(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-rolled sidebar toggles duplicate SidebarToggle; kit-sidebar-toggle
 * is exempt. */
export function checkHandRolledSidebarToggle(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Raw native checkboxes (bare markup, input[type=checkbox] selectors, or
 * checkbox-scoped accent-color styling) duplicate Checkbox/Toggle.
 * accent-color on OTHER controls (range sliders, progress) is legitimate —
 * theme.css sets it globally — so the CSS signal requires a selector that
 * names checkboxes. kit-ui's own Markdown component already styles
 * rendered task-list checkboxes. */
export function checkHandRolledCheckbox(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Hand-built switches (role="switch" plus a track/knob) duplicate Toggle. */
export function checkHandRolledToggle(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** The visually-hidden clip recipe is shipped as .kit-sr-only in theme.css. */
export function checkHandRolledSrOnly(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Overlay-scale z-index literals should come from the z token ladder so
 * app overlays stack predictably against library popovers/tooltips. Small
 * literals (<100) are legitimate local stacking. */
export function checkRawZIndex(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Manual dark-mode wiring (prefers-color-scheme media queries, toggling a
 * dark class by hand) bypasses the theme store — tokens already resolve per
 * theme, and initTheme owns the system-preference subscription. */
export function checkManualColorScheme(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Virtualization library imports duplicate VirtualList. */
export function checkHandRolledVirtualization(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** A vertical scroller with its native scrollbar hidden should use ScrollBox,
 * which preserves the native control and adds the accessible region contract.
 * Horizontal strips (overflow-x) are exempt — ScrollBox is vertical-only. */
export function checkHandRolledScrollBox(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Direct markdown/sanitizer imports duplicate the markdown pipeline,
 * which bundles sanitization and code highlighting. */
export function checkHandRolledMarkdown(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Direct mermaid imports duplicate kit-ui's markdown-mermaid module,
 * which bundles the strict-sandbox config, per-document budgets, themed
 * re-rendering, and the pan/zoom viewer. */
export function checkHandRolledMermaid(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** The tabbable-elements selector is the signature of a hand-rolled focus
 * trap (Tab cycling, initial focus, roving menus). trapFocus also locks
 * body scroll re-entrantly and restores focus on teardown. */
export function checkHandRolledFocusTrap(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Local debounce implementations (a relative debounce module or an inline
 * function) duplicate the library util, which also ships .cancel(). */
export function checkLocalDebounce(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Any font-size on html/:root (other than 100%/1rem/initial) breaks the rem
 * type scale: px pins it (defeating the browser font-size preference), and
 * rem/var values make every token compound against the shrunken root. */
export function checkPinnedRootFontSize(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** The retired parallel mobile type scale; the single token ladder is
 * redefined on coarse-pointer (touch) devices instead — never by width. */
export function checkLegacyMobileType(source: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Flex/grid gaps should come from the spacing ladder. */
export function checkNonstandardSpacing(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Legacy Svelte syntax (pre-runes). */
export function checkLegacySvelte(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Consumer CSS reaching into Chip's internal label span — the historical
 * icon-alignment override (`.kit-chip__label svg { vertical-align: … }`).
 * Chip centers label svgs itself now, and trailing indicators have a
 * first-class snippet, so any such rule is stale drift against a private
 * element. Suffixed local classes (.kit-chip__label-wrapper) are someone
 * else's name, not the internal — `-` continues a CSS identifier, so a
 * plain \b would false-positive on them. */
export function checkChipLabelOverride(source: any, filename: any): {
    rule: string;
    line: number;
    message: string;
}[];
/** Run all (or the selected) rules on one file's source. */
export function checkSource(source: any, filename: any, ruleNames?: string[]): any[];
/**
 * Rules for kit-ui-check: scan Svelte/CSS sources in a consuming project for
 * hand-rolled equivalents of kit-ui components and design-token violations.
 *
 * Each rule is a pure function of (source, filename) returning findings:
 *   { rule, line, message }
 *
 * Suppress a finding by putting `kit-ui-check-ignore` in a comment on the
 * offending line or the line above it.
 */
export const STANDARD_BREAKPOINTS: number[];
export const SPACING_LADDER: number[];
export const ALL_RULES: {
    "nonstandard-breakpoint": typeof checkBreakpoints;
    "raw-color": typeof checkRawColors;
    "hand-rolled-disabled-state": typeof checkHandRolledDisabledState;
    "hand-rolled-press-state": typeof checkHandRolledPressState;
    "hand-rolled-modal": typeof checkHandRolledModal;
    "hand-rolled-spinner": typeof checkHandRolledSpinner;
    "hand-rolled-clipboard": typeof checkClipboard;
    "hand-rolled-dropdown": typeof checkCombobox;
    "hand-rolled-kbd": typeof checkKbd;
    "hand-rolled-splitter": typeof checkHandRolledSplitter;
    "hand-rolled-segmented": typeof checkHandRolledSegmented;
    "hand-rolled-table-sort": typeof checkHandRolledTableSort;
    "hand-rolled-tooltip": typeof checkHandRolledTooltip;
    "hand-rolled-popover-card": typeof checkHandRolledPopoverCard;
    "hand-rolled-card": typeof checkHandRolledCard;
    "hand-rolled-status-bar": typeof checkHandRolledStatusBar;
    "hand-rolled-code-block": typeof checkHandRolledCodeBlock;
    "hand-rolled-empty-state": typeof checkHandRolledEmptyState;
    "hand-rolled-icon-button": typeof checkHandRolledIconButton;
    "hand-rolled-image-preview": typeof checkHandRolledImagePreview;
    "hand-rolled-top-bar": typeof checkHandRolledTopBar;
    "hand-rolled-search-input": typeof checkHandRolledSearchInput;
    "hand-rolled-date-input": typeof checkHandRolledDateInput;
    "hand-rolled-toast": typeof checkHandRolledToast;
    "hand-rolled-drawer": typeof checkHandRolledDrawer;
    "hand-rolled-find-bar": typeof checkHandRolledFindBar;
    "hand-rolled-status-dot": typeof checkHandRolledStatusDot;
    "hand-rolled-checkbox": typeof checkHandRolledCheckbox;
    "hand-rolled-toggle": typeof checkHandRolledToggle;
    "hand-rolled-sidebar-toggle": typeof checkHandRolledSidebarToggle;
    "hand-rolled-sr-only": typeof checkHandRolledSrOnly;
    "hand-rolled-virtualization": typeof checkHandRolledVirtualization;
    "hand-rolled-scroll-box": typeof checkHandRolledScrollBox;
    "hand-rolled-markdown": typeof checkHandRolledMarkdown;
    "hand-rolled-mermaid": typeof checkHandRolledMermaid;
    "hand-rolled-focus-trap": typeof checkHandRolledFocusTrap;
    "local-debounce": typeof checkLocalDebounce;
    "manual-color-scheme": typeof checkManualColorScheme;
    "raw-z-index": typeof checkRawZIndex;
    "pinned-root-font-size": typeof checkPinnedRootFontSize;
    "legacy-mobile-type": typeof checkLegacyMobileType;
    "nonstandard-spacing": typeof checkNonstandardSpacing;
    "legacy-svelte": typeof checkLegacySvelte;
    "chip-label-override": typeof checkChipLabelOverride;
};
