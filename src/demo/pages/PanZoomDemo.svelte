<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { attachPanZoom, Button, type PanZoom, type PanZoomView } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  // One-pixel stripes expose blur when actual-pixel sizing is off.
  async function raster(width: number, height: number, fill: string): Promise<string> {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.fillStyle = fill;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#fff";
    for (let x = 0; x < width; x += 2) context.fillRect(x, 0, 1, height / 2);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/png"),
    );
    return URL.createObjectURL(blob);
  }

  let images = $state<{ src: string; alt: string }[]>([]);
  let loaded = $state(0);
  let view = $state<PanZoomView>({ scale: 1, offsetX: 0, offsetY: 0 });
  let dpr = $state(window.devicePixelRatio);
  let largerPanes = $state(false);
  let actualPixels = false;
  let controllers: PanZoom[] = [];
  let imageNodes: HTMLImageElement[] = [];
  let sourceScale = 1;
  let refresh = () => {};

  onMount(() => {
    let disposed = false;
    let urls: string[] = [];
    void Promise.all([raster(3200, 1920, "#6366f1"), raster(3200, 1920, "#22c55e")]).then(
      (srcs) => {
        urls = srcs;
        if (disposed) urls.forEach((url) => URL.revokeObjectURL(url));
        else
          images = srcs.map((src, i) => ({
            src,
            alt: `Photo ${i + 1}, 3200 by 1920 original`,
          }));
      },
    );
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  // Each pane's changes drive the other silently, so linking never loops.
  function linkedPanes(node: HTMLElement) {
    const panes = Array.from(node.querySelectorAll<HTMLElement>(".pan-zoom-demo__pane"));
    imageNodes = panes.map((pane) => pane.querySelector("img")!);
    let oldFittedWidth = 0;
    refresh = () => {
      if (!imageNodes.every((image) => image.complete && image.naturalWidth)) return;
      const image = imageNodes[0]!;
      const fittedWidth = Math.min(
        image.clientWidth,
        (image.clientHeight * image.naturalWidth) / image.naturalHeight,
      );
      sourceScale = image.naturalWidth / (fittedWidth * window.devicePixelRatio);
      if (oldFittedWidth) {
        const scale = actualPixels ? sourceScale : view.scale;
        const ratio = (scale * fittedWidth) / (view.scale * oldFittedWidth);
        view = { scale, offsetX: view.offsetX * ratio, offsetY: view.offsetY * ratio };
      }
      oldFittedWidth = fittedWidth;
      const limits = {
        minScale: Math.min(0.4, sourceScale, view.scale),
        maxScale: Math.max(8, sourceScale, view.scale),
      };
      controllers.forEach((controller) => controller.destroy());
      controllers = panes.map((pane, index) =>
        attachPanZoom(pane, imageNodes[index]!, {
          ...limits,
          onChange: (next) => {
            if (next.scale !== view.scale) actualPixels = false;
            view = next;
            controllers.forEach((other, i) => i !== index && other.setView(next));
          },
        }),
      );
      controllers.forEach((controller) => controller.setView(view));
    };
    const observer = new ResizeObserver(() => refresh());
    panes.forEach((pane) => observer.observe(pane));
    let query: MediaQueryList;
    const watchDpr = () => {
      query?.removeEventListener("change", watchDpr);
      dpr = window.devicePixelRatio;
      refresh();
      query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener("change", watchDpr);
    };
    untrack(watchDpr);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", watchDpr);
      controllers.forEach((controller) => controller.destroy());
    };
  }

  // One image pixel per physical screen pixel.
  function exactSize() {
    actualPixels = true;
    view = { scale: sourceScale, offsetX: 0, offsetY: 0 };
    for (const controller of controllers) controller.setView(view);
    view = controllers[0]!.getView();
  }

  function fit() {
    actualPixels = false;
    controllers[0]?.reset();
  }
</script>

<DemoSection
  title="Linked panes"
  description="Drag either image to move both. Wheel or pinch to zoom, double-click to toggle. Actual pixels shows one image pixel per screen pixel."
>
  {#if images.length}
    <div
      class="pan-zoom-demo"
      style:--pane-width={largerPanes ? "300px" : "240px"}
      {@attach linkedPanes}
    >
      {#each images as image (image.src)}
        <div class="pan-zoom-demo__pane">
          <img
            src={image.src}
            alt={image.alt}
            draggable="false"
            onload={() => {
              loaded++;
              refresh();
            }}
          />
        </div>
      {/each}
    </div>
    <div class="pan-zoom-demo__actions">
      <Button disabled={loaded < 2} onclick={exactSize}>Actual pixels</Button>
      <Button onclick={fit}>Fit</Button>
      <Button onclick={() => (largerPanes = !largerPanes)}
        >{largerPanes ? "Smaller panes" : "Larger panes"}</Button
      >
    </div>
    <output aria-live="off" aria-label="Zoom scale"
      >Scale {view.scale.toFixed(4)} · DPR {dpr}</output
    >
  {/if}
</DemoSection>

<style>
  .pan-zoom-demo,
  .pan-zoom-demo__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .pan-zoom-demo__actions {
    margin-top: var(--space-5);
  }

  .pan-zoom-demo__pane {
    width: var(--pane-width);
    aspect-ratio: 5 / 3;
    box-sizing: content-box;
    overflow: hidden;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-inset);
    touch-action: none;
  }

  .pan-zoom-demo__pane img {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
</style>
