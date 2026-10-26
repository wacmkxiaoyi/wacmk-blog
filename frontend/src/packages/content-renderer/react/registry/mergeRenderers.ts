export function mergeRenderers(defaultRegistry, overrideRegistry) {
  if (!overrideRegistry) {
    return defaultRegistry;
  }

  return {
    blocks: {
      ...defaultRegistry.blocks,
      ...(overrideRegistry.blocks || {}),
    },
    inlines: {
      ...defaultRegistry.inlines,
      ...(overrideRegistry.inlines || {}),
    },
  };
}
