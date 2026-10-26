import type { TableTranslate } from "./types.ts";

const DEFAULT_TRANSLATIONS: Record<string, string> = {
  "table.searchPlaceholder": "Search...",
  "table.searchButton": "Search",
  "table.noData": "No data found.",
  "table.loading": "Loading...",
  "table.pagination.previous": "Previous",
  "table.pagination.next": "Next",
  "table.pagination.go": "Go",
  "table.pagination.jumpToPage": "Jump to page",
  "table.pagination.pageSize": "Rows",
  "table.pagination.pageStatus": "Page: {current} / {total}",
};

export const DEFAULT_TRANSLATIONS_TABLE = DEFAULT_TRANSLATIONS;

export function resolveTableLabel(
  translate: TableTranslate | undefined,
  key: string,
  fallback: string,
): string {
  if (translate) {
    return translate(key, fallback);
  }
  return DEFAULT_TRANSLATIONS[key] ?? fallback;
}
