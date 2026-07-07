<script lang="ts">
  import ImagePreview from "../../lib/components/ImagePreview.svelte";
  import DemoSection from "../DemoSection.svelte";

  const shapes =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160">
        <circle cx="80" cy="80" r="56" fill="#22c55e"/>
        <rect x="156" y="36" width="88" height="88" rx="12" fill="#6366f1" opacity="0.85"/>
      </svg>`,
    );
</script>

<DemoSection
  title="Basic"
  description="Contain-fit image centered on a checkerboard backdrop, as used for image files in diff views. Click (or focus + Enter) to expand into a lightbox; Escape, the backdrop, or the close button dismiss it."
  code={'<ImagePreview src={dataURL} alt="screenshot.png" />'}
>
  <ImagePreview src={shapes} alt="Demo shapes" />
</DemoSection>

<DemoSection
  title="Not expandable"
  description="expandable={false} renders the plain image with no lightbox trigger."
  code={'<ImagePreview src={dataURL} alt="screenshot.png" expandable={false} />'}
>
  <ImagePreview src={shapes} alt="Demo shapes, static" expandable={false} />
</DemoSection>

<DemoSection
  title="Constrained height"
  description="maxHeight caps the rendered image (default 70vh); wide images always shrink to fit."
  code={'<ImagePreview src={dataURL} alt="screenshot.png" maxHeight="96px" />'}
>
  <ImagePreview src={shapes} alt="Demo shapes, small" maxHeight="96px" />
</DemoSection>

<DemoSection
  title="Load failure"
  description="A broken source swaps in the (localizable) errorLabel instead of a broken-image glyph."
  code={'<ImagePreview src="/missing.png" alt="Missing" errorLabel="Unable to load image" />'}
>
  <ImagePreview src="/this-image-does-not-exist.png" alt="Missing image" />
</DemoSection>
