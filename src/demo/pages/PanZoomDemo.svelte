<script lang="ts">
  import { onMount } from "svelte";
  import { attachPanZoom, Button, type PanZoom, type PanZoomView } from "../../lib/index.js";
  import DemoSection from "../DemoSection.svelte";

  // Striped originals whose 1:1 views need scales above 8 and below 0.4
  // in a 240px pane: 1px stripes blur unless shown at exactly one image
  // pixel per screen pixel.
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
  let exactIndex: number | null = null;
  let controllers: PanZoom[] = [];
  let imageNodes: HTMLImageElement[] = [];
  const limits = { minScale: 0.1, maxScale: 32 };

  onMount(() => {
    let disposed = false;
    let urls: string[] = [];
    void Promise.all([raster(6000, 3600, "#6366f1"), raster(80, 48, "#22c55e")]).then((srcs) => {
      urls = srcs;
      if (disposed) urls.forEach((url) => URL.revokeObjectURL(url));
      else
        images = srcs.map((src, i) => ({
          src,
          alt: i === 0 ? "Large 6000 by 3600 original" : "Small 80 by 48 original",
        }));
    });
    return () => {
      disposed = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  });

  // Each pane's changes drive the other silently, so linking never loops.
  function linkedPanes(node: HTMLElement) {
    const panes = Array.from(node.querySelectorAll<HTMLElement>(".pan-zoom-demo__pane"));
    imageNodes = panes.map((pane) => pane.querySelector("img")!);
    controllers = panes.map((pane, index) =>
      attachPanZoom(pane, imageNodes[index]!, {
        ...limits,
        onChange: (next) => {
          view = next;
          controllers.forEach((other, i) => i !== index && other.setView(next));
        },
      }),
    );
    let query: MediaQueryList;
    const watchDpr = () => {
      query?.removeEventListener("change", watchDpr);
      dpr = window.devicePixelRatio;
      if (exactIndex !== null) exactSize(exactIndex);
      query = matchMedia(`(resolution: ${dpr}dppx)`);
      query.addEventListener("change", watchDpr);
    };
    watchDpr();
    return () => {
      query.removeEventListener("change", watchDpr);
      controllers.forEach((controller) => controller.destroy());
    };
  }

  // One image pixel per physical screen pixel.
  function exactSize(index: number) {
    const image = imageNodes[index]!;
    // These originals are unrotated, and their image boxes have no padding.
    const displayW = image.naturalWidth;
    const displayH = image.naturalHeight;
    const fittedW = Math.min(image.clientWidth, (image.clientHeight * displayW) / displayH);
    exactIndex = index;
    view = { scale: displayW / (fittedW * dpr), offsetX: 0, offsetY: 0 };
    for (const controller of controllers) controller.setView(view);
    view = controllers[0]!.getView();
  }

  function fit() {
    exactIndex = null;
    controllers[0]?.reset();
  }
</script>

<DemoSection
  title="Linked panes"
  description="Drag either image to move both. Wheel or pinch to zoom, double-click to toggle. Actual pixels shows one image pixel per screen pixel."
  code={`const limits = { minScale: 0.1, maxScale: 32 };
const rotation = 0; // These originals are unrotated.
const quarterTurn = rotation % 180 !== 0;
const displayW = quarterTurn ? image.naturalHeight : image.naturalWidth;
const displayH = quarterTurn ? image.naturalWidth : image.naturalHeight;
// client dimensions equal content dimensions here: no image padding or border.
const fittedW = Math.min(image.clientWidth, image.clientHeight * displayW / displayH);
const scale = displayW / (fittedW * devicePixelRatio);
const right = attachPanZoom(rightPane, rightImage, limits);
const left = attachPanZoom(leftPane, leftImage, {
  ...limits,
  onChange: (view) => right.setView(view),
});
left.setView({ scale, offsetX: 0, offsetY: 0 });
right.setView(left.getView());`}
>
  {#if images.length}
    <div class="pan-zoom-demo" {@attach linkedPanes}>
      {#each images as image (image.src)}
        <div class="pan-zoom-demo__pane">
          <img src={image.src} alt={image.alt} draggable="false" onload={() => loaded++} />
        </div>
      {/each}
    </div>
    <div class="pan-zoom-demo__actions">
      <Button disabled={loaded < 2} onclick={() => exactSize(0)}>Large at actual pixels</Button>
      <Button disabled={loaded < 2} onclick={() => exactSize(1)}>Small at actual pixels</Button>
      <Button onclick={fit}>Fit</Button>
    </div>
    <output aria-live="polite">Scale {view.scale.toFixed(4)} · DPR {dpr}</output>
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
    width: 240px;
    height: 144px;
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
