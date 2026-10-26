import type { RichTextEditorBridge } from "../../helpers/types.ts";

export function makeBridgeRef(): RichTextEditorBridge {
  return {
    openModal: () => {},
    openContextMenu: () => {},
    translate: (_key: string, fallback: string) => fallback,
    resolveAssetUrl: () => undefined,
    getAssetPreviewVersion: () => 0,
    subscribeAssetPreview: () => () => {},
    getCustomBlockVersion: () => 0,
    subscribeCustomBlock: () => () => {},
  };
}
