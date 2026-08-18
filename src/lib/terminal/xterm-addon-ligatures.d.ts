// The ligatures addon's package root resolves to its CJS entry, which cannot
// be imported from browser ESM under Vite; the pane deep-imports the shipped
// .mjs build instead, which carries no type declarations. Alias its types to
// the package root's.
declare module "@xterm/addon-ligatures/lib/addon-ligatures.mjs" {
  export { LigaturesAddon } from "@xterm/addon-ligatures";
}
