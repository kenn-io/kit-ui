// Mounts an ImagePreview outside the demo gallery so a spec can unmount it
// while its viewer is open (media-viewer.spec.ts). Served by the Vite dev
// server, which resolves the bare imports.
import { mount, unmount } from "svelte";
import ImagePreview from "../../../src/lib/components/ImagePreview.svelte";

export function mountImagePreview(alt: string): () => void {
  const host = document.createElement("div");
  document.body.append(host);
  const src =
    "data:image/svg+xml," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"/>');
  const preview = mount(ImagePreview, { target: host, props: { src, alt } });
  return () => {
    void unmount(preview);
    host.remove();
  };
}
