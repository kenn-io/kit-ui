<script module lang="ts">
  // Each import registers one Video.js element. Only the parts this bar
  // uses are imported; the packaged skins are not, so apps don't ship them.
  import "@videojs/html/video/player";
  import "@videojs/html/ui/container";
  import "@videojs/html/ui/controls";
  import "@videojs/html/ui/controls-backdrop";
  import "@videojs/html/ui/controls-content";
  import "@videojs/html/ui/controls-group";
  import "@videojs/html/ui/play-button";
  import "@videojs/html/ui/mute-button";
  import "@videojs/html/ui/volume-slider";
  import "@videojs/html/ui/time-slider";
  import "@videojs/html/ui/slider-track";
  import "@videojs/html/ui/slider-fill";
  import "@videojs/html/ui/slider-buffer";
  import "@videojs/html/ui/slider-thumb";
  import "@videojs/html/ui/time";
  import "@videojs/html/ui/time-group";
  import "@videojs/html/ui/time-separator";
  import "@videojs/html/ui/fullscreen-button";
  import "@videojs/html/ui/playback-rate-button";
  import "@videojs/html/ui/hotkey";
  import "@videojs/html/ui/gesture";

  // The playback speed a reader last picked, shared by every player on the
  // site, so a reader who watches at 1.2× gets 1.2× everywhere.
  const PLAYBACK_RATE_KEY = "kit-ui:video-playback-rate";

  function savedPlaybackRate(): number | null {
    try {
      const rate = Number(localStorage.getItem(PLAYBACK_RATE_KEY));
      return Number.isFinite(rate) && rate > 0 && rate <= 16 ? rate : null;
    } catch {
      // Storage blocked (private modes, sandboxed frames): play at 1×.
      return null;
    }
  }

  function savePlaybackRate(rate: number): void {
    try {
      localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
    } catch {
      // Storage blocked; the speed lasts only for this player.
    }
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { Attachment } from "svelte/attachments";
  import Maximize from "@lucide/svelte/icons/maximize";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";
  import Minimize from "@lucide/svelte/icons/minimize";
  import Pause from "@lucide/svelte/icons/pause";
  import Play from "@lucide/svelte/icons/play";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Volume2 from "@lucide/svelte/icons/volume-2";
  import VolumeX from "@lucide/svelte/icons/volume-x";
  import {
    openMediaViewerGallery,
    registerMediaViewerItem,
    unregisterMediaViewerItem,
    type MediaViewerLabels,
    type MediaViewerVideoItem,
  } from "../utils/media-gallery.js";

  interface Props {
    /** The video URL. Give `sources` instead for several formats. */
    src?: string;
    /** Sources in preference order, rendered as `<source>` elements; the
     * browser plays the first it supports. */
    sources?: { src: string; type?: string }[];
    /** Accessible name of the video. */
    label: string;
    poster?: string;
    preload?: "none" | "metadata" | "auto";
    /** Show the expand control, which opens the page gallery (MediaViewer)
     * on this video. The gallery pages through the page's other images,
     * diagrams, and videos. */
    expandable?: boolean;
    expandLabel?: string;
    /** Suspend app-level keyboard handling while the expanded view is
     * open (see MediaViewer's `onViewerOpen`). */
    onViewerOpen?: () => () => void;
    /** Strings for the expanded view (see MediaViewer's label props). */
    viewerLabels?: MediaViewerLabels;
    /** Accessible name of the control bar. */
    controlsLabel?: string;
    /** The `<video>` element, for hosts that drive playback. */
    video?: HTMLVideoElement;
    /** Attached to the `<video>` element. */
    videoAttachment?: Attachment<HTMLVideoElement>;
    class?: string;
  }

  let {
    src = undefined,
    sources = [],
    label,
    poster = undefined,
    preload = "metadata",
    expandable = true,
    expandLabel = "Open video in expanded view",
    onViewerOpen = undefined,
    viewerLabels = undefined,
    controlsLabel = "Video controls",
    video = $bindable(),
    videoAttachment = undefined,
    class: className = "",
  }: Props = $props();

  // Starts at the remembered speed and remembers changes. Loading a source
  // resets the speed to defaultPlaybackRate, so a change sets that too;
  // otherwise a reload would drop back to the old speed and save it.
  function rememberPlaybackRate(player: HTMLVideoElement) {
    const saved = savedPlaybackRate();
    if (saved !== null) {
      player.defaultPlaybackRate = saved;
      player.playbackRate = saved;
    }
    const save = () => {
      // Setting the default fires another ratechange, which finds them equal.
      if (player.defaultPlaybackRate !== player.playbackRate)
        player.defaultPlaybackRate = player.playbackRate;
      savePlaybackRate(player.playbackRate);
    };
    player.addEventListener("ratechange", save);
    return () => player.removeEventListener("ratechange", save);
  }

  // The browser picks among <source> children only when the video first
  // loads; a new list needs load() to take effect. A new src loads itself.
  // Counting the changes lets a handover from the expanded view tell that
  // the player now shows another clip.
  let loadedSources: string | null = null;
  let sourceChanges = 0;
  $effect(() => {
    const list = [src ?? "", ...sources.map((source) => `${source.src} ${source.type ?? ""}`)].join(
      "\n",
    );
    if (loadedSources !== null && list !== loadedSources) {
      sourceChanges += 1;
      if (!src) untrack(() => video)?.load();
    }
    loadedSources = list;
  });

  // Close function of a viewer this player opened; the viewer lives on
  // document.body, so it must not outlive the player.
  let closeOwnViewer: (() => void) | null = null;

  async function openViewer(entry: HTMLElement): Promise<void> {
    const close: () => void = await openMediaViewerGallery(entry, {
      ...viewerLabels,
      onViewerOpen,
      onClose: () => {
        if (closeOwnViewer === close) closeOwnViewer = null;
      },
    });
    closeOwnViewer = close;
  }

  // Called when any gallery viewer opens with this player in it. The
  // viewer plays its own copy, so this player pauses and hands over where
  // it was, and takes the position back when the video leaves the viewer.
  function expandedItem(player: HTMLVideoElement): MediaViewerVideoItem {
    const playing = !player.paused && !player.ended;
    const changesAtOpen = sourceChanges;
    player.pause();
    return {
      kind: "video",
      // An idle player (preload="none") may not have picked a source yet;
      // the viewer then picks from the same list.
      src: player.currentSrc,
      sources: src ? [{ src }, ...sources] : sources,
      label,
      currentTime: player.currentTime,
      playing,
      muted: player.muted,
      volume: player.volume,
      onleave: (state) => {
        if (!player.isConnected) return;
        player.muted = state.muted;
        player.volume = state.volume;
        // The position and playback belong to the clip that was expanded,
        // not to one the host has put in its place since.
        if (sourceChanges !== changesAtOpen) return;
        player.currentTime = state.currentTime;
        if (state.playing) player.play().catch(() => {});
      },
    };
  }

  // The player's root is its entry in the page gallery.
  function galleryEntry(entry: HTMLElement) {
    registerMediaViewerItem(entry, () => expandedItem(video!));
    return () => {
      unregisterMediaViewerItem(entry);
      closeOwnViewer?.();
    };
  }

  let root: HTMLElement | undefined = $state();
</script>

<div bind:this={root} class={["kit-video-player", className]} {@attach expandable && galleryEntry}>
  <video-player class="kit-video-player__player">
    <media-container class="kit-video-player__container">
      <!-- A caption track is the host's to supply; most videos here are
        screen recordings without one. -->
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={video}
        class="kit-video-player__video"
        {src}
        {poster}
        {preload}
        aria-label={label}
        playsinline
        {@attach rememberPlaybackRate}
        {@attach videoAttachment}
      >
        {#each sources as source (source.src)}
          <source src={source.src} type={source.type} />
        {/each}
      </video>

      <media-controls class="kit-video-player__controls">
        <media-controls-backdrop class="kit-video-player__backdrop"></media-controls-backdrop>
        <media-controls-content class="kit-video-player__bar">
          <!-- A wide player shows the seek bar above the buttons; a narrow
            one puts it between them, as Video.js's own skin does. -->
          <media-controls-group class="kit-video-player__row" aria-label={controlsLabel}>
            <media-play-button class="kit-video-player__button kit-video-player__play">
              <Play
                class="kit-video-player__icon kit-video-player__icon--play"
                size={18}
                aria-hidden="true"
              />
              <Pause
                class="kit-video-player__icon kit-video-player__icon--pause"
                size={18}
                aria-hidden="true"
              />
              <RotateCcw
                class="kit-video-player__icon kit-video-player__icon--replay"
                size={18}
                aria-hidden="true"
              />
            </media-play-button>
            <media-mute-button class="kit-video-player__button kit-video-player__mute">
              <Volume2
                class="kit-video-player__icon kit-video-player__icon--unmuted"
                size={18}
                aria-hidden="true"
              />
              <VolumeX
                class="kit-video-player__icon kit-video-player__icon--muted"
                size={18}
                aria-hidden="true"
              />
            </media-mute-button>
            <media-volume-slider class="kit-video-player__volume">
              <media-slider-track class="kit-video-player__track">
                <media-slider-fill class="kit-video-player__fill"></media-slider-fill>
              </media-slider-track>
              <media-slider-thumb class="kit-video-player__thumb"></media-slider-thumb>
            </media-volume-slider>
            <media-time-slider class="kit-video-player__seek">
              <media-slider-track class="kit-video-player__track">
                <media-slider-buffer class="kit-video-player__buffer"></media-slider-buffer>
                <media-slider-fill class="kit-video-player__fill"></media-slider-fill>
              </media-slider-track>
              <media-slider-thumb class="kit-video-player__thumb"></media-slider-thumb>
            </media-time-slider>
            <media-time-group class="kit-video-player__time">
              <media-time type="current"></media-time>
              <media-time-separator></media-time-separator>
              <media-time type="duration"></media-time>
            </media-time-group>

            <span class="kit-video-player__spacer"></span>

            <div class="kit-video-player__corner">
              <!-- Cycles through Video.js's speeds; the label is the speed. -->
              <media-playback-rate-button class="kit-video-player__button kit-video-player__rate"
              ></media-playback-rate-button>
              {#if expandable}
                <button
                  type="button"
                  class="kit-video-player__button kit-video-player__expand"
                  aria-label={expandLabel}
                  title={expandLabel}
                  onclick={() => {
                    if (root) void openViewer(root);
                  }}
                >
                  <Maximize2 size={18} aria-hidden="true" />
                </button>
              {/if}
              <media-fullscreen-button
                class="kit-video-player__button kit-video-player__fullscreen"
              >
                <Maximize
                  class="kit-video-player__icon kit-video-player__icon--enter"
                  size={18}
                  aria-hidden="true"
                />
                <Minimize
                  class="kit-video-player__icon kit-video-player__icon--exit"
                  size={18}
                  aria-hidden="true"
                />
              </media-fullscreen-button>
            </div>
          </media-controls-group>
        </media-controls-content>
      </media-controls>

      <!-- A click on the picture plays and pauses; a tap on a touch
        screen shows or hides the controls instead. -->
      <media-gesture type="tap" pointer="mouse" action="togglePaused"></media-gesture>
      <media-hotkey keys="Space" action="togglePaused"></media-hotkey>
      <media-hotkey keys="k" action="togglePaused"></media-hotkey>
      <media-hotkey keys="m" action="toggleMuted"></media-hotkey>
      <media-hotkey keys="f" action="toggleFullscreen"></media-hotkey>
      <media-hotkey keys="ArrowLeft" action="seekStep" value={-5}></media-hotkey>
      <media-hotkey keys="ArrowRight" action="seekStep" value={5}></media-hotkey>
    </media-container>
  </video-player>
</div>

<style>
  /* Controls sit on the picture, so they are light on a dark scrim in
   * every theme. Override these to retheme the bar. */
  .kit-video-player {
    --kit-video-player-control: var(--video-control-color, #fff);
    --kit-video-player-control-muted: var(--video-control-muted-color, rgb(255 255 255 / 0.35));
    --kit-video-player-scrim: var(--video-control-scrim, rgb(0 0 0 / 0.6));
    --kit-video-player-hover: var(--video-control-hover, rgb(255 255 255 / 0.16));

    position: relative;
    display: block;
    max-width: 100%;
    overflow: hidden;
    container-type: inline-size;
    background: var(--video-background, #000);
    border-radius: var(--radius-md);
  }

  .kit-video-player__player,
  .kit-video-player__container {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
  }

  .kit-video-player__video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* The bar sits in flow at the bottom of the controls, so the controls,
   * which cover the picture, place the corner group on a narrow player.
   * They take their size from the picture, so they can answer height
   * queries; the root's height comes from its content. */
  .kit-video-player__controls {
    position: absolute;
    inset: 0;
    z-index: 0;
    container: kit-video-player-controls / size;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none;
  }

  .kit-video-player__backdrop {
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(to top, var(--kit-video-player-scrim), transparent 45%);
    transition: opacity var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-video-player__bar {
    display: block;
    padding: var(--space-2) var(--space-3);
    color: var(--kit-video-player-control);
    pointer-events: auto;
    transition: opacity var(--transition-fast) var(--transition-ease, ease);
  }

  /* Video.js reflects whether the controls show; they fade out during
   * playback when the pointer is idle, and stay while one has focus. */
  .kit-video-player__backdrop:not(:global([data-visible])),
  .kit-video-player__bar:not(:global([data-visible])):not(:has(:focus-visible)) {
    opacity: 0;
  }

  /* The seek bar takes a line of its own above the buttons. */
  .kit-video-player__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
  }

  .kit-video-player__corner {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-1);
  }

  .kit-video-player__spacer {
    flex: 1;
  }

  .kit-video-player__button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    color: inherit;
    background: transparent;
    border: 0;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-video-player__rate {
    width: auto;
    min-width: 32px;
    padding: 0 var(--space-1);
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
  }

  .kit-video-player__rate::after {
    content: attr(data-rate) "×";
  }

  .kit-video-player__button:hover {
    background: var(--kit-video-player-hover);
  }

  .kit-video-player__button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 1px;
  }

  /* Each Video.js button carries every icon; its state shows one. */
  .kit-video-player__button :global(.kit-video-player__icon) {
    display: none;
  }
  .kit-video-player__play:global([data-paused]:not([data-ended]))
    :global(.kit-video-player__icon--play),
  .kit-video-player__play:global(:not([data-paused])) :global(.kit-video-player__icon--pause),
  .kit-video-player__play:global([data-ended]) :global(.kit-video-player__icon--replay),
  .kit-video-player__mute:global(:not([data-muted])) :global(.kit-video-player__icon--unmuted),
  .kit-video-player__mute:global([data-muted]) :global(.kit-video-player__icon--muted),
  .kit-video-player__fullscreen:global(:not([data-fullscreen]))
    :global(.kit-video-player__icon--enter),
  .kit-video-player__fullscreen:global([data-fullscreen]) :global(.kit-video-player__icon--exit) {
    display: block;
  }

  /* The expanded view opens on the page, which a full-screen element
   * covers, so the control would open it out of sight. */
  :global(:fullscreen) .kit-video-player__expand {
    display: none;
  }

  .kit-video-player__mute:global([data-hidden]),
  .kit-video-player__volume:global([data-hidden]),
  .kit-video-player__fullscreen:global([data-hidden]) {
    display: none;
  }

  .kit-video-player__seek,
  .kit-video-player__volume {
    position: relative;
    display: flex;
    align-items: center;
    height: 16px;
    cursor: pointer;
  }

  .kit-video-player__seek {
    flex: 0 0 100%;
    order: -1;
  }

  .kit-video-player__volume {
    flex: none;
    width: 64px;
    margin-right: var(--space-2);
  }

  .kit-video-player__track {
    position: absolute;
    right: 0;
    left: 0;
    height: 4px;
    overflow: hidden;
    background: var(--kit-video-player-control-muted);
    border-radius: 9999px;
  }

  .kit-video-player__buffer,
  .kit-video-player__fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
  }

  .kit-video-player__buffer {
    width: var(--media-slider-buffer);
    background: var(--kit-video-player-control-muted);
  }

  .kit-video-player__fill {
    width: var(--media-slider-fill);
    background: var(--kit-video-player-control);
  }

  .kit-video-player__thumb {
    position: absolute;
    left: var(--media-slider-fill);
    width: 12px;
    height: 12px;
    background: var(--kit-video-player-control);
    border-radius: 50%;
    transform: translateX(-50%) scale(0);
    transition: transform var(--transition-fast) var(--transition-ease, ease);
  }

  .kit-video-player__seek:global([data-interactive]) .kit-video-player__thumb,
  .kit-video-player__volume:global([data-interactive]) .kit-video-player__thumb,
  .kit-video-player__seek:focus-visible .kit-video-player__thumb,
  .kit-video-player__volume:focus-visible .kit-video-player__thumb {
    transform: translateX(-50%) scale(1);
  }

  .kit-video-player__seek:focus-visible,
  .kit-video-player__volume:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .kit-video-player__time {
    display: inline-flex;
    gap: var(--space-1);
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* A narrow player keeps every control on one row, as Video.js's own
   * skin does below 32rem: the seek bar moves between the buttons, and
   * speed, expand, and full screen move to the top corner. Stacked rows would
   * not fit the height of a small 16:9 player. Mute stays without its
   * slider. */
  @container (width < 32rem) {
    .kit-video-player__bar {
      padding: var(--space-1) var(--space-2);
    }
    .kit-video-player__row {
      flex-wrap: nowrap;
    }
    .kit-video-player__seek {
      flex: 1 1 0;
      order: 0;
      min-width: 0;
    }
    .kit-video-player__volume,
    .kit-video-player__spacer {
      display: none;
    }
    .kit-video-player__corner {
      position: absolute;
      top: var(--space-1);
      right: var(--space-1);
      background: var(--kit-video-player-scrim);
      border-radius: var(--radius-md);
    }
  }

  /* The seek bar still shows the position. */
  @container (width < 22.5rem) {
    .kit-video-player__time {
      display: none;
    }
  }

  /* Video.js's skin size for every pointer; at 44px a small player could
   * not fit its controls. */
  @media (hover: none), (pointer: coarse) {
    .kit-video-player__button {
      width: 36px;
      height: 36px;
    }
    .kit-video-player__volume {
      display: none;
    }
  }

  /* A short player, such as a narrow ultrawide video, has no room for the
   * bottom row and the corner group at full size; 24px buttons, the
   * smallest WCAG target, fit both down to a 60px-tall picture. */
  @container kit-video-player-controls (height < 5.5rem) {
    .kit-video-player__button {
      width: 24px;
      min-width: 24px;
      height: 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-video-player__backdrop,
    .kit-video-player__bar,
    .kit-video-player__button,
    .kit-video-player__thumb {
      transition: none;
    }
  }
</style>
