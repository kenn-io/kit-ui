import { mount } from "svelte";
import "../lib/theme.css";
import "../lib/themes.css";
import "../lib/fonts.css";
import "../lib/mermaid.css";
import "./demo.css";
import App from "./App.svelte";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
