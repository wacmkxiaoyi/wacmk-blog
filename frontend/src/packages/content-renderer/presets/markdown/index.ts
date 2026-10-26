import { createPreset } from "../../core";
import { MarkdownAdapter } from "./adapter";
import {
  admonitionPlugin,
  calloutPlugin,
  colorTextPlugin,
  mathPlugin,
  tabsPlugin,
  underlinePlugin,
  videoPlugin,
} from "./plugins";

export const MarkdownPreset = createPreset({
  adapter: MarkdownAdapter,
  plugins: [
    underlinePlugin,
    colorTextPlugin,
    calloutPlugin,
    admonitionPlugin,
    tabsPlugin,
    mathPlugin,
    videoPlugin,
  ],
});

export * from "./adapter/index.ts";
export * from "./plugins/index.ts";
export * from "./serialize/index.ts";
export * from "./transforms/index.ts";
