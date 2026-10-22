// Mounts a VideoPlayer with the given props for media-viewer-video.spec.ts.
// Served by the Vite dev server.
import { mount } from "svelte";
import VideoPlayer from "../../../src/lib/components/VideoPlayer.svelte";
import clip from "../../../src/demo/assets/media-viewer-demo.webm";

export { clip };

export function mountVideoPlayer(props: Parameters<typeof mount<typeof VideoPlayer>>[1]["props"]) {
  const host = document.createElement("div");
  host.style.width = "480px";
  document.body.prepend(host);
  mount(VideoPlayer, { target: host, props });
  return host;
}
