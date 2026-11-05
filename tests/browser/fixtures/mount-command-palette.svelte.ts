import type { ComponentProps } from "svelte";
import CommandPalette from "../../../src/lib/components/CommandPalette.svelte";
import { mountReactive } from "./mount-reactive.svelte.js";

type Props = ComponentProps<typeof CommandPalette>;

export function mountCommandPalette(initial: Props) {
  const host = document.createElement("div");
  host.dataset.testid = "mounted-palette";
  document.body.append(host);
  return mountReactive(CommandPalette, host, initial);
}
