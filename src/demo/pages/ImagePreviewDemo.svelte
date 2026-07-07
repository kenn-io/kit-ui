<script lang="ts">
  import ImagePreview from "../../lib/components/ImagePreview.svelte";
  import Button from "../../lib/components/Button.svelte";
  import Modal from "../../lib/components/Modal.svelte";
  import DemoSection from "../DemoSection.svelte";

  const shapes =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="160">
        <circle cx="80" cy="80" r="56" fill="#22c55e"/>
        <rect x="156" y="36" width="88" height="88" rx="12" fill="#6366f1" opacity="0.85"/>
      </svg>`,
    );

  let nestedOpen = $state(false);
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

<DemoSection
  title="Inside modal"
  description="Lightbox dismissal and focus trapping stay isolated when the preview is rendered inside another overlay."
  code={'<Modal title="Image attachment"><ImagePreview src={dataURL} alt="attachment.png" /></Modal>'}
>
  <Button onclick={() => (nestedOpen = true)}>Open image modal</Button>

  {#if nestedOpen}
    <Modal title="Image attachment" onclose={() => (nestedOpen = false)}>
      <ImagePreview
        src={shapes}
        alt="Nested demo shapes"
        expandLabel="Expand nested image"
        closeLabel="Close nested image"
      />
    </Modal>
  {/if}
</DemoSection>
