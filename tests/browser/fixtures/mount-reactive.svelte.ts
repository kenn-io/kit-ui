import { mount, type Component } from "svelte";

export function mountReactive<Props extends object>(
  component: Component<Props>,
  host: HTMLElement,
  initial: Props,
) {
  const props = $state({ ...initial });
  mount(component, { target: host, props });
  return {
    host,
    update: (next: Partial<Props>) => Object.assign(props, next),
  };
}
