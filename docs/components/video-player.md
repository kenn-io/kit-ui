# VideoPlayer

A video player with its own control bar: play, mute, volume, the time, a
seek bar, an expand control, and full screen. The expand control opens
the video in [MediaViewer](media-viewer.md), which pages through the
page's other images, diagrams, and videos. The browser's built-in
controls can't take an extra button, which is why kit-ui has its own
player.

```svelte
<script lang="ts">
  import { VideoPlayer } from "@kenn-io/kit-ui";
</script>

<VideoPlayer src={url} label="Screen recording of the new sidebar" />
```

The player fills the width of its container and takes the video's
height. Set a width on the container to size it.

## Requirements

VideoPlayer is built from [Video.js 10](https://videojs.org) custom
elements, so apps need the `@videojs/html` peer dependency:

```bash
bun add @videojs/html
```

The player imports only the Video.js controls it uses, never a packaged
skin, so apps don't ship the skins' code. Its styles come from its own
stylesheet, so it works under a Content Security Policy without
`'unsafe-inline'` in `style-src`.

## Expanded view

When `expandable` (the default), the player joins the page gallery and
its expand control, beside full screen, opens MediaViewer on it.

- The viewer plays the video from where the inline player was, and plays
  it if the inline player was playing. Mute and volume carry over both
  ways. The inline player pauses.
- When the video leaves the viewer, the inline player takes back its
  position. It resumes only if the user closed the viewer while the video
  played. Paging away pauses the video.
- Opening the viewer from any item pauses every expandable player on the
  page, because each one hands its playback to the viewer.

Set `expandable={false}` for a player that should not expand or join the
gallery. MediaViewer's own player is one.

## Controls

- A click on the picture plays or pauses. On a touch screen, a tap shows
  or hides the controls instead.
- The controls fade out during playback when the pointer is idle, and
  stay while one of them has keyboard focus.
- While focus is in the player:
  - Space or K plays and pauses.
  - M mutes.
  - F toggles full screen.
  - The Left and Right arrow keys seek five seconds.
- A narrow player (360px or less) or a touch screen hides the volume
  slider. The mute button stays, and touch screens get 44px buttons.

The controls sit on the picture, so they are light on a dark scrim in
every theme. To change them, set `--video-control-color`,
`--video-control-muted-color`, `--video-control-scrim`,
`--video-control-hover`, or `--video-background`.

## Props

| Prop              | Type                               | Default                         | Notes                                                                |
| ----------------- | ---------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `src`             | `string`                           | —                               | The video URL; or give `sources`                                     |
| `sources`         | `{ src: string; type?: string }[]` | `[]`                            | Sources in preference order; the browser plays the first it supports |
| `label`           | `string`                           | —                               | Accessible name of the video, and of the expanded view               |
| `poster`          | `string`                           | —                               | Image shown before playback                                          |
| `preload`         | `"none" \| "metadata" \| "auto"`   | `"metadata"`                    | The `<video>` preload hint                                           |
| `expandable`      | `boolean`                          | `true`                          | Show the expand control and join the page gallery                    |
| `expandLabel`     | `string`                           | `"Open video in expanded view"` | Accessible name of the expand control                                |
| `controlsLabel`   | `string`                           | `"Video controls"`              | Accessible name of the control bar                                   |
| `onViewerOpen`    | `() => () => void`                 | —                               | Suspend app keyboard handling while the viewer is open               |
| `viewerLabels`    | `MediaViewerLabels`                | —                               | Expanded-view strings ([MediaViewer](media-viewer.md))               |
| `video`           | `HTMLVideoElement` (bindable)      | —                               | The `<video>` element, for hosts that drive playback                 |
| `videoAttachment` | `Attachment<HTMLVideoElement>`     | —                               | Attached to the `<video>` element                                    |
| `class`           | `string`                           | —                               | Extra class on the player's root                                     |

Video.js labels its own buttons ("Play", "Mute", "Enter fullscreen") in
English. kit-ui does not localize them yet.
