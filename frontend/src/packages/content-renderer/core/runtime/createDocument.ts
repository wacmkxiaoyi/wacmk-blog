import { getAdapterForFormat } from "../adapters";
import { runPlugins } from "../plugins";

export function createDocument({
  format,
  value,
  adapter,
  adapterRegistry,
  plugins = [],
}) {
  const resolvedAdapter = getAdapterForFormat(
    adapterRegistry || {},
    format,
    adapter,
  );

  if (!resolvedAdapter) {
    throw new Error(`No content adapter registered for format: ${format}`);
  }

  const document = resolvedAdapter.parse(value, { format });
  return runPlugins(document, plugins);
}
