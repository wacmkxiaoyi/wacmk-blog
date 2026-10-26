import { useMemo } from "react";
import { createContentNavigation } from "../../core";

export function useContentToc(document) {
  return useMemo(() => {
    return createContentNavigation(document, { tree: false }).flatItems.map(
      (item) => ({
        id: item.id,
        level: item.level,
        text: item.text,
      }),
    );
  }, [document]);
}
