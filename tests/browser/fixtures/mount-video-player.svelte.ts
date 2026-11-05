// Mounts a VideoPlayer with the given props for media-viewer-video.spec.ts.
// Served by the Vite dev server. `update` changes props on the mounted
// player, as a host's state would.
import type { ComponentProps } from "svelte";
import VideoPlayer from "../../../src/lib/components/VideoPlayer.svelte";
import clip from "../../../src/demo/assets/media-viewer-demo.webm";
import { mountReactive } from "./mount-reactive.svelte.js";

export { clip };

type Props = ComponentProps<typeof VideoPlayer>;

export function mountVideoPlayer(initial: Props) {
  const host = document.createElement("div");
  host.style.width = "480px";
  document.body.prepend(host);
  return mountReactive(VideoPlayer, host, initial);
}
