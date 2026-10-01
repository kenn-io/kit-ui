// Mounts MediaViewer with reactive props so a spec can change them while
// it is open (media-viewer.spec.ts). Served by the Vite dev server.
import { mount } from "svelte";
import MediaViewer from "../../../src/lib/components/MediaViewer.svelte";
import type { MediaViewerItem, MediaViewerLabels } from "../../../src/lib/utils/media-gallery.ts";

export function mountMediaViewer(
  items: MediaViewerItem[],
  index: number,
  labels: MediaViewerLabels = {},
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
    ...labels,
  });
  mount(MediaViewer, { target: document.body, props });
  return {
    calls,
    replaceHook: () => {
      props.onViewerOpen = hook("B");
    },
    replaceItems: (next: MediaViewerItem[]) => {
      props.items = next;
    },
  };
}
