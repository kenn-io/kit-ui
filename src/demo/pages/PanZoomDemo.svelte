<script lang="ts">
  import { onMount, untrack } from "svelte";
  import {
    actualPixelSize,
    attachPanZoom,
    Button,
    Card,
    Toggle,
    type PanZoom,
    type PanZoomView,
  } from "../../lib/index.js";

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
  let views = $state<PanZoomView[]>([
    { scale: 1, offsetX: 0, offsetY: 0 },
    { scale: 1, offsetX: 0, offsetY: 0 },
  ]);
  let linked = $state(true);
  let lastChanged = $state(0);
  let dpr = $state(window.devicePixelRatio);
  let largerPanes = $state(false);
  let actualPixels = [false, false];
  let controllers: PanZoom[] = [];
  let imageNodes: HTMLImageElement[] = [];
  let sourceScales = $state([1, 1]);
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
    const imageSizes = panes.map(() => ({ width: 0, height: 0 }));
    const oldFittedWidths = [0, 0];
    controllers = panes.map((pane, index) =>
      attachPanZoom(pane, imageNodes[index]!, {
        onChange: (next) => {
          if (next.scale !== views[index]!.scale) actualPixels[index] = false;
          views[index] = next;
          lastChanged = index;
          if (linked) synchronize();
        },
      }),
    );
    refresh = () => {
      if (
        !imageNodes.every(
          (image, index) =>
            image.complete &&
            image.naturalWidth &&
            imageSizes[index]!.width > 0 &&
            imageSizes[index]!.height > 0,
        )
      )
        return;
      imageNodes.forEach((image, index) => {
        const { fittedWidth, scale: sourceScale } = actualPixelSize(
          { width: image.naturalWidth, height: image.naturalHeight },
          imageSizes[index]!,
          window.devicePixelRatio,
        );
        sourceScales[index] = sourceScale;
        const view = views[index]!;
        if (oldFittedWidths[index]) {
          const scale = actualPixels[index] ? sourceScale : view.scale;
          const ratio = (scale * fittedWidth) / (view.scale * oldFittedWidths[index]!);
          views[index] = { scale, offsetX: view.offsetX * ratio, offsetY: view.offsetY * ratio };
        }
        oldFittedWidths[index] = fittedWidth;
      });
      controllers.forEach((controller) =>
        controller.setLimits({
          minScale: Math.min(0.4, ...sourceScales, ...views.map((view) => view.scale)),
          maxScale: Math.max(8, ...sourceScales, ...views.map((view) => view.scale)),
        }),
      );
      controllers.forEach((controller, index) => controller.setView(views[index]!));
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = imageNodes.indexOf(entry.target as HTMLImageElement);
        if (index >= 0)
          imageSizes[index] = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };
      }
      refresh();
    });
    imageNodes.forEach((image) => observer.observe(image));
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

  function synchronize() {
    controllers.forEach((controller, index) => {
      if (index === lastChanged) return;
      views[index] = { ...views[lastChanged]! };
      actualPixels[index] = actualPixels[lastChanged]!;
      controller.setView(views[index]!);
    });
  }

  // One image pixel per physical screen pixel.
  function exactSize() {
    controllers.forEach((controller, index) => {
      actualPixels[index] = true;
      controller.setView({ scale: sourceScales[index]!, offsetX: 0, offsetY: 0 });
      views[index] = controller.getView();
    });
  }

  function fit() {
    controllers.forEach((controller, index) => {
      actualPixels[index] = false;
      controller.setView({ scale: 1, offsetX: 0, offsetY: 0 });
      views[index] = controller.getView();
    });
  }
</script>

<Card level="raised">
  {#if images.length}
    <div class="pan-zoom-demo">
      <div class="pan-zoom-demo__toolbar">
        <Toggle
          bind:checked={linked}
          label="Link views"
          onchange={(checked) => {
            if (checked) synchronize();
          }}
        />
        <Button disabled={loaded < 2} onclick={fit}>Fit</Button>
        <Button disabled={loaded < 2} onclick={exactSize}>Actual pixels</Button>
        <output aria-live="off" aria-label="Zoom scale">
          <strong
            >{Number((views[lastChanged]!.scale / sourceScales[lastChanged]!).toFixed(2))}:1</strong
          >
          · {Number(views[lastChanged]!.scale.toFixed(2))}× from fit · DPR {dpr}
        </output>
      </div>
      <div
        class="pan-zoom-demo__panes"
        style:--pane-ratio={largerPanes ? "5 / 3" : "5 / 2"}
        {@attach linkedPanes}
      >
        {#each images as image, index (image.src)}
          <div class="pan-zoom-demo__image">
            <span>Image {index === 0 ? "A" : "B"}</span>
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
          </div>
        {/each}
      </div>
      <div class="pan-zoom-demo__footer">
        <span>Drag to pan · Scroll or pinch to zoom</span>
        <Button onclick={() => (largerPanes = !largerPanes)}
          >{largerPanes ? "Smaller panes" : "Larger panes"}</Button
        >
      </div>
    </div>
  {/if}
</Card>

<style>
  .pan-zoom-demo {
    width: 100%;
    min-width: 0;
  }

  .pan-zoom-demo__toolbar,
  .pan-zoom-demo__footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-5);
  }

  .pan-zoom-demo__toolbar {
    margin-bottom: var(--space-5);
  }

  .pan-zoom-demo__toolbar output {
    margin-left: auto;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  .pan-zoom-demo__toolbar strong {
    color: var(--text-primary);
  }

  .pan-zoom-demo__panes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5);
  }

  .pan-zoom-demo__image > span {
    display: block;
    margin-bottom: var(--space-3);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .pan-zoom-demo__footer {
    justify-content: space-between;
    margin-top: var(--space-5);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .pan-zoom-demo__pane {
    aspect-ratio: var(--pane-ratio);
    overflow: hidden;
    border: var(--border-width) solid var(--border-default);
    border-radius: var(--radius-md);
    background: var(--bg-inset);
    touch-action: none;
  }

  @media (max-width: 640px) {
    .pan-zoom-demo__panes {
      grid-template-columns: minmax(0, 1fr);
    }

    .pan-zoom-demo__toolbar output {
      width: 100%;
      margin-left: 0;
    }
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
