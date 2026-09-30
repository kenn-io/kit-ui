// Mounts MediaViewer with reactive props so a spec can change them while
// it is open (media-viewer.spec.ts). Served by the Vite dev server.
import { mount } from "svelte";
import MediaViewer from "../../../src/lib/components/MediaViewer.svelte";
import type { MediaViewerItem } from "../../../src/lib/utils/media-gallery.ts";

export function mountMediaViewer(
  items: MediaViewerItem[],
  index: number,
  formatPosition?: (position: number, total: number) => string,
) {
  const calls: string[] = [];
  const hook = (name: string) => () => {
    calls.push(`open ${name}`);
    return () => calls.push(`restore ${name}`);
  };
  const props = $state({
    items,
    index,
    onclose: () => {},
    onViewerOpen: hook("A"),
    ...(formatPosition ? { formatPosition } : {}),
  });
  mount(MediaViewer, { target: document.body, props });
  return {
    calls,
    replaceHook: () => {
      props.onViewerOpen = hook("B");
    },
  };
}
