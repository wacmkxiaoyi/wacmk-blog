const DEFAULT_TRANSLATIONS: Record<string, string> = {
  "catalog.toolbar.addGroup": "Add group",
  "catalog.addGroup.title": "New group",
  "catalog.addGroup.placeholder": "Enter group name",
  "catalog.addGroup.confirm": "Create",
  "catalog.addGroup.cancel": "Cancel",
  "catalog.moveUp": "Move up",
  "catalog.moveDown": "Move down",
  "catalog.rename": "Rename",
  "catalog.delete": "Delete",
  "catalog.rename.title": "Rename",
  "catalog.rename.placeholder": "Enter new name",
  "catalog.rename.confirm": "Rename",
  "catalog.rename.cancel": "Cancel",
  "catalog.empty": "No items yet. Use the toolbar to add content.",
};

export const DEFAULT_TRANSLATIONS_CATALOG = DEFAULT_TRANSLATIONS;

export function resolveCatalogLabel(
  translate: ((key: string, fallback: string) => string) | undefined,
  key: string,
  fallback: string,
): string {
  if (translate) {
    return translate(key, fallback);
  }
  return DEFAULT_TRANSLATIONS[key] ?? fallback;
}
