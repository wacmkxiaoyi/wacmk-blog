const en: Record<string, Record<string, string>> = {
  navigator: {
    expand: "Open outline",
    collapse: "Close outline",
    heading: "Contents",
  },
};

const zhHans: Record<string, Record<string, string>> = {
  navigator: {
    expand: "打开目录",
    collapse: "收起目录",
    heading: "目录",
  },
};

const locales: Record<string, Record<string, Record<string, string>>> = {
  en,
  "zh-hans": zhHans,
};

export function resolveNavigatorLabel(path: string, lang?: string): string {
  const activeLocale = locales[lang || "en"] || locales.en;
  const keys = path.split(".");
  let value: any = activeLocale;
  for (const k of keys) {
    if (value == null) break;
    value = value[k];
  }
  return typeof value === "string" ? value : path;
}

export function getNavigatorLang(): string {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("wacmk_lang");
  if (stored && locales[stored]) return stored;
  const browserLang = navigator.language || "";
  if (browserLang.startsWith("zh")) return "zh-hans";
  return "en";
}
