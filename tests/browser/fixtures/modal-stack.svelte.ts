// A $state-backed modal stack like the ones apps pass as MediaViewer's
// onViewerOpen hook: pushing reads and writes reactive state
// (media-viewer.spec.ts).
// Static resolution shares the demo's gallery registry after Vite hot updates.
export { openMediaViewerGallery } from "../../../src/lib/utils/media-gallery.js";

const frames = $state<string[]>([]);

export function pushFrame(): () => void {
  const id = `frame-${frames.length}`;
  frames.push(id);
  return () => {
    const index = frames.indexOf(id);
    if (index >= 0) frames.splice(index, 1);
  };
}

export function depth(): number {
  return frames.length;
}
