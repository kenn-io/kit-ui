<script module lang="ts">
  export type AvatarShape = "circle" | "rounded" | "square";
  export type AvatarTone = "hashed" | "neutral";
</script>

<script lang="ts">
  import { hashColor } from "../utils/color-hash.js";
  import { formatInitials } from "../utils/format.js";

  interface Props {
    /** Name of the person or account: the accessible name and the source of the initials. */
    name: string;
    /** Picture URL. Without one, or when it fails to load, the initials show. */
    src?: string | null | undefined;
    /** Stable key the initials' color derives from, such as a user ID or an
     * email address. Defaults to `name`. */
    colorKey?: string | undefined;
    /** Replaces the initials derived from `name`, such as one letter for a domain. */
    initials?: string | undefined;
    /** `hashed` gives each key its own accent; `neutral` is a plain grey tile. */
    tone?: AvatarTone;
    /** Width and height in pixels. */
    size?: number;
    /** `circle` for people; `rounded` and `square` tell organizations or domains apart. */
    shape?: AvatarShape;
    /** Hides the avatar from assistive technology when the name is already
     * written beside it. */
    decorative?: boolean;
    class?: string;
  }

  let {
    name,
    src = undefined,
    colorKey = undefined,
    initials = undefined,
    tone = "hashed",
    size = 24,
    shape = "circle",
    decorative = false,
    class: className = "",
  }: Props = $props();

  // The URL that failed, not a flag, so a new src gets a fresh attempt.
  let failedSrc = $state<string | null>(null);

  const showImage = $derived(src != null && src !== "" && src !== failedSrc);
  const glyph = $derived(initials ?? formatInitials(name));
  const color = $derived(tone === "hashed" ? hashColor(colorKey ?? name) : undefined);
</script>

<span
  class={["kit-avatar", `kit-avatar--${shape}`, `kit-avatar--${tone}`, className]}
  style:--kit-avatar-size="{size}px"
  style:--kit-avatar-color={color}
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : name}
  aria-hidden={decorative ? "true" : undefined}
>
  {#if showImage}
    <img
      class="kit-avatar__image"
      src={src!}
      alt=""
      loading="lazy"
      decoding="async"
      onerror={() => (failedSrc = src ?? null)}
    />
  {:else}
    <span class="kit-avatar__initials" aria-hidden="true">{glyph}</span>
  {/if}
</span>

<style>
  .kit-avatar {
    box-sizing: border-box;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--kit-avatar-size);
    height: var(--kit-avatar-size);
    overflow: hidden;
    border-radius: 50%;
    background: var(--bg-inset);
    color: var(--text-secondary);
    font-family: inherit;
    /* The initials scale with the box, which is sized in pixels. */
    font-size: calc(var(--kit-avatar-size) * 0.4);
    font-weight: var(--font-weight-semibold, 600);
    line-height: 1;
    letter-spacing: 0.02em;
    vertical-align: middle;
    user-select: none;
  }

  /* A light tint of the key's accent with the initials in a deeper shade of
   * it. Mixing toward the page surface and the primary ink keeps both legible
   * in light and dark without a per-theme rule. */
  .kit-avatar--hashed {
    background: color-mix(in srgb, var(--kit-avatar-color) 18%, var(--bg-surface));
    color: color-mix(in srgb, var(--kit-avatar-color) 55%, var(--text-primary));
  }

  .kit-avatar--rounded {
    border-radius: 27%;
  }

  .kit-avatar--square {
    border-radius: 12%;
  }

  .kit-avatar__image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .kit-avatar__initials {
    white-space: nowrap;
  }
</style>
