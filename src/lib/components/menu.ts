export type MenuAlign = "start" | "end";
export type MenuInitialFocus = "first" | "last";

export interface MenuItemRegistration {
  element: () => HTMLButtonElement | undefined;
  textValue: () => string;
}

export interface MenuContext {
  readonly id: string;
  readonly open: boolean;
  readonly align: MenuAlign;
  triggerElement: () => HTMLButtonElement | undefined;
  contentElement: () => HTMLElement | undefined;
  setTriggerElement: (element: HTMLButtonElement | undefined) => void;
  setContentElement: (element: HTMLElement | undefined) => void;
  openMenu: (focus: MenuInitialFocus) => void;
  closeMenu: (restoreFocus: boolean) => void;
  registerItem: (item: MenuItemRegistration) => () => void;
  focusInitialItem: () => void;
  focusRelativeItem: (direction: 1 | -1) => void;
  focusEdgeItem: (edge: MenuInitialFocus) => void;
  focusItemByPrefix: (prefix: string) => void;
}

export interface MenuRadioGroupContext {
  readonly value: string;
  select: (value: string) => void;
}

export const menuContextKey = Symbol("kit-menu");
export const menuRadioGroupContextKey = Symbol("kit-menu-radio-group");
