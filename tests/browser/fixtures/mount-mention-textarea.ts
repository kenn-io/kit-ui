// Mounts a MentionTextarea whose "/" search is async with hideEmpty, and
// whose responses the spec releases by hand, so a test can press keys while
// a lookup is pending (mention-textarea.spec.ts). Served by the Vite dev
// server, which resolves the bare imports.
import { mount } from "svelte";
import MentionTextarea from "../../../src/lib/components/MentionTextarea.svelte";
import type { MentionOption } from "../../../src/lib/components/mention.js";

export interface PendingMention {
  /** Settles every pending lookup with these options. */
  resolve(options: MentionOption[]): void;
  /** Keys the menu passed through to onkeydown. */
  keys: string[];
}

export function mountPendingMention(ariaLabel: string): PendingMention {
  const host = document.createElement("div");
  document.body.append(host);
  let waiting: ((options: MentionOption[]) => void)[] = [];
  const keys: string[] = [];
  mount(MentionTextarea, {
    target: host,
    props: {
      value: "",
      ariaLabel,
      triggers: [
        {
          char: "/",
          hideEmpty: true,
          search: () => new Promise<MentionOption[]>((resolve) => waiting.push(resolve)),
        },
      ],
      onkeydown: (event: KeyboardEvent) => keys.push(event.key),
    },
  });
  return {
    resolve(options) {
      const settle = waiting;
      waiting = [];
      for (const resolve of settle) resolve(options);
    },
    keys,
  };
}
