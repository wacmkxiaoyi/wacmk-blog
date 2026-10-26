import { useMemo } from "react";
import { createDocument } from "../../core";

export function useContentDocument({
  format,
  value,
  adapter,
  adapterRegistry,
  plugins,
}) {
  return useMemo(
    () => createDocument({ format, value, adapter, adapterRegistry, plugins }),
    [format, value, adapter, adapterRegistry, plugins],
  );
}
