import { mount } from "svelte";
import CommandPalette from "../../../src/lib/components/CommandPalette.svelte";

type Props = Parameters<typeof mount<typeof CommandPalette>>[1]["props"];

export function mountCommandPalette(initial: Props) {
  const host = document.createElement("div");
  host.dataset.testid = "mounted-palette";
  document.body.append(host);
  const props = $state({ ...initial });
  mount(CommandPalette, { target: host, props });
  return {
    host,
    update: (next: Partial<Props>) => Object.assign(props, next),
  };
}
