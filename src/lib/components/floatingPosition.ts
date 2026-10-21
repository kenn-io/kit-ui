type FloatingAlign = "start" | "center" | "end";
type FloatingPlacement = "auto" | "below" | "above";

export interface FloatingPopoverInput {
  trigger: Pick<DOMRect, "left" | "right" | "top" | "bottom">;
  viewportWidth: number;
  viewportHeight?: number;
  popoverWidth?: number;
  popoverHeight?: number;
  align?: FloatingAlign;
  edgeGap?: number;
  triggerGap?: number;
  maxWidth?: number;
  constrainWidth?: boolean;
  /** "auto" (default) flips above the trigger when it would overflow the
   * viewport bottom; "below"/"above" force one side. */
  placement?: FloatingPlacement;
}

export interface FloatingPopoverPosition {
  left: number;
  top: number;
  /** Set only with `constrainWidth`. */
  width: number | undefined;
}

/** Viewport coordinates for a fixed popover; `floatingPopoverStyle` formats
 * them as inline style. */
export function floatingPopoverPosition({
  trigger,
  viewportWidth,
  viewportHeight,
  popoverWidth,
  popoverHeight,
  align = "start",
  edgeGap = 8,
  triggerGap = 4,
  maxWidth,
  constrainWidth = false,
  placement = "auto",
}: FloatingPopoverInput): FloatingPopoverPosition {
  const availableWidth = Math.max(0, viewportWidth - edgeGap * 2);
  const width = constrainWidth
    ? Math.min(maxWidth ?? availableWidth, availableWidth)
    : (popoverWidth ?? 0);
  const left = clamp(
    alignedLeft(trigger, width, align),
    edgeGap,
    Math.max(edgeGap, viewportWidth - width - edgeGap),
  );
  const top = floatingTop({
    trigger,
    popoverHeight,
    viewportHeight,
    edgeGap,
    triggerGap,
    placement,
  });
  return { left, top: Math.round(top), width: constrainWidth ? Math.round(width) : undefined };
}

export function floatingPopoverStyle(input: FloatingPopoverInput): string {
  const { left, top, width } = floatingPopoverPosition(input);
  const style = [`left: ${formatPx(left)}px`, `top: ${top}px`];
  if (width !== undefined) {
    style.push(`width: ${width}px`);
  }
  return style.join("; ");
}

function alignedLeft(
  trigger: Pick<DOMRect, "left" | "right">,
  width: number,
  align: FloatingAlign,
): number {
  if (align === "end") return trigger.right - width;
  if (align === "center") return (trigger.left + trigger.right - width) / 2;
  return trigger.left;
}

interface FloatingTopInput {
  trigger: Pick<DOMRect, "top" | "bottom">;
  popoverHeight: number | undefined;
  viewportHeight: number | undefined;
  edgeGap: number;
  triggerGap: number;
  placement: FloatingPlacement;
}

function floatingTop({
  trigger,
  popoverHeight,
  viewportHeight,
  edgeGap,
  triggerGap,
  placement,
}: FloatingTopInput): number {
  const below = trigger.bottom + triggerGap;
  if (placement === "above") {
    return Math.max(edgeGap, trigger.top - (popoverHeight ?? 0) - triggerGap);
  }
  if (placement === "below" || popoverHeight === undefined || viewportHeight === undefined) {
    return below;
  }

  const above = trigger.top - popoverHeight - triggerGap;
  return below + popoverHeight > viewportHeight - edgeGap ? Math.max(edgeGap, above) : below;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}

function formatPx(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
