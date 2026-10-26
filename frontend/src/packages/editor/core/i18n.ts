import { DEFAULT_TRANSLATIONS } from "./constants.ts";
import type { EditorTranslate } from "./types.ts";

export function translateLabel(
  translate: EditorTranslate | undefined,
  key: string,
  fallback?: string,
) {
  const defaultValue =
    fallback ||
    DEFAULT_TRANSLATIONS[key as keyof typeof DEFAULT_TRANSLATIONS] ||
    key;
  return typeof translate === "function"
    ? translate(key, defaultValue)
    : defaultValue;
}
