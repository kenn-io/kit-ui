import type { Attachment } from "svelte/attachments";

/**
 * Fades the top or bottom edge of a scroll container while more content lies
 * past it. Overlay scrollbars (macOS, touch) stay hidden until the user
 * scrolls, so without a fade a list cut at a row boundary looks complete.
 *
 * Attach it to the element that scrolls: `<div {@attach scrollFade}>`. It
 * sets `data-kit-scroll-fade`, plus `data-kit-scroll-fade-top` and
 * `data-kit-scroll-fade-bottom` while that edge hides content; theme.css
 * draws the fades from those attributes. The fades are painted in
 * `--kit-scroll-fade-color` (default `--bg-popover`), so set it on a
 * container whose background is something else.
 */
export const scrollFade: Attachment<HTMLElement> = (node) => {
  let frame = 0;

  function update(): void {
    frame = 0;
    const hiddenBelow = node.scrollHeight - node.clientHeight - node.scrollTop;
    // One pixel of slack: zoom makes scrollTop fractional, so a list
    // scrolled to its end can stop a fraction short of the maximum.
    node.toggleAttribute("data-kit-scroll-fade-top", node.scrollTop > 1);
    node.toggleAttribute("data-kit-scroll-fade-bottom", hiddenBelow > 1);
  }

  // DOM changes arrive in a microtask, mid-update; measure on the next frame
  // instead of forcing a layout there.
  function schedule(): void {
    if (!frame) frame = requestAnimationFrame(update);
  }

  node.setAttribute("data-kit-scroll-fade", "");
  // Scroll events and resize callbacks already run once per frame, after
  // layout, so they measure right away.
  node.addEventListener("scroll", update, { passive: true });
  const resizes = new ResizeObserver(update);
  resizes.observe(node);
  const mutations = new MutationObserver(schedule);
  mutations.observe(node, { childList: true, subtree: true, characterData: true });

  return () => {
    cancelAnimationFrame(frame);
    node.removeEventListener("scroll", update);
    resizes.disconnect();
    mutations.disconnect();
    node.removeAttribute("data-kit-scroll-fade");
    node.removeAttribute("data-kit-scroll-fade-top");
    node.removeAttribute("data-kit-scroll-fade-bottom");
  };
};
