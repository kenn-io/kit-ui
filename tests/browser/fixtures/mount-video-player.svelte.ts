// Mounts a VideoPlayer with the given props for media-viewer-video.spec.ts.
// Served by the Vite dev server. `update` changes props on the mounted
// player, as a host's state would.
import { mount } from "svelte";
import VideoPlayer from "../../../src/lib/components/VideoPlayer.svelte";
import clip from "../../../src/demo/assets/media-viewer-demo.webm";

export { clip };

type Props = Parameters<typeof mount<typeof VideoPlayer>>[1]["props"];

export function mountVideoPlayer(initial: Props) {
  const host = document.createElement("div");
  host.style.width = "480px";
  document.body.prepend(host);
  const props = $state({ ...initial });
  mount(VideoPlayer, { target: host, props });
  return {
    host,
    update: (next: Partial<Props>) => Object.assign(props, next),
  };
}
