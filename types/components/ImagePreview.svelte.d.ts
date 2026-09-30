interface Props {
    /** Image URL — remote, relative, or a data:/blob: URL. */
    src: string;
    alt: string;
    /** Caps the rendered image height (any CSS length). */
    maxHeight?: string;
    /** Click-to-expand into the full-viewport MediaViewer (default true),
     * which also pages through the page's other expandable media. */
    expandable?: boolean;
    /** Shown in place of the image when it fails to load. */
    errorLabel?: string;
    expandLabel?: string;
    closeLabel?: string;
}
declare const ImagePreview: import("svelte").Component<Props, {}, "">;
type ImagePreview = ReturnType<typeof ImagePreview>;
export default ImagePreview;
