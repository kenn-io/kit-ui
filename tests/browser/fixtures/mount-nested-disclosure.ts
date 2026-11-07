// Mounts a card Disclosure inside a plain one, outside the demo gallery,
// so disclosure.spec.ts can check that variant styles do not leak into
// nested disclosures. Served by the Vite dev server.
import { mount } from "svelte";
import NestedDisclosure from "./NestedDisclosure.svelte";

export function mountNestedDisclosure(): void {
  const host = document.createElement("div");
  document.body.append(host);
  mount(NestedDisclosure, { target: host });
}
