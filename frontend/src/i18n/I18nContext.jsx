import { createContext, useCallback, useMemo, useState } from "react";
import zh from "../i18n/locales/zh.json";
import en from "../i18n/locales/en.json";
import api from "../api";

const messages = { "zh-hans": zh, en };

const LANG_KEY = "wacmk_lang";

function detectLanguage() {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && messages[stored]) return stored;

  const browserLang = navigator.language || "";
  if (browserLang.startsWith("zh")) return "zh-hans";
  return "en";
}

export const I18nContext = createContext(null);

export default function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);

  const setLang = useCallback((code) => {
    setLangState(code);
    localStorage.setItem(LANG_KEY, code);

    api.i18n.setLanguage(code).catch(() => {});
  }, []);

  const t = useCallback(
    (path, vars = {}) => {
      const keys = path.split(".");
      let value = messages[lang];
      for (const k of keys) {
        if (value == null) break;
        value = value[k];
      }
      if (typeof value !== "string") return path;
      return value.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
