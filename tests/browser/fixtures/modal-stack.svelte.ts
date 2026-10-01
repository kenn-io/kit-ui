// A $state-backed modal stack like the ones apps pass as MediaViewer's
// onViewerOpen hook: pushing reads and writes reactive state
// (media-viewer.spec.ts).
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
