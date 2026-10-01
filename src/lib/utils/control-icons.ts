/*
 * Lucide icons for imperatively built control buttons (the markdown
 * post-processors' viewer controls). Instead of managing per-button Svelte
 * lifecycles, each icon component is mounted once into a detached host,
 * its svg markup captured, and the instance unmounted; buttons clone the
 * cached markup. Imported dynamically (with text glyphs as fallback)
 * because .svelte modules can't load in the unit-test runtime.
 */

export type ControlIcon = "expand" | "copy" | "reset" | "check";

const CONTROL_ICON_GLYPHS: Record<ControlIcon, string> = {
  expand: "⟷",
  copy: "⧉",
  reset: "⟳",
  check: "✓",
};

let controlIconSvgs: Record<ControlIcon, string> | null = null;
let controlIconPromise: Promise<void> | null = null;

export function loadControlIcons(): Promise<void> {
  controlIconPromise ??= (async () => {
    const [svelte, expand, copy, reset, check] = await Promise.all([
      import("svelte"),
      import("@lucide/svelte/icons/maximize-2"),
      import("@lucide/svelte/icons/copy"),
      import("@lucide/svelte/icons/rotate-ccw"),
      import("@lucide/svelte/icons/check"),
    ]);
    const renderIconSvg = (icon: { default: unknown }): string => {
      const host = document.createElement("div");
      const instance = svelte.mount(icon.default as Parameters<typeof svelte.mount>[0], {
        target: host,
        props: { size: 16, "aria-hidden": "true" },
      });
      const svg = host.innerHTML;
      svelte.unmount(instance);
      return svg;
    };
    controlIconSvgs = {
      expand: renderIconSvg(expand),
      copy: renderIconSvg(copy),
      reset: renderIconSvg(reset),
      check: renderIconSvg(check),
    };
  })().catch(() => {
    // Icon chunk failed (offline) — buttons fall back to text glyphs and
    // a later call retries the import.
    controlIconPromise = null;
  });
  return controlIconPromise;
}

export function setControlIcon(button: HTMLButtonElement, icon: ControlIcon): void {
  if (controlIconSvgs) {
    button.innerHTML = controlIconSvgs[icon];
  } else {
    button.textContent = CONTROL_ICON_GLYPHS[icon];
  }
}
