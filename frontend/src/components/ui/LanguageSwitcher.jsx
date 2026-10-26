import useI18n from "../../hooks/useI18n";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  const langs = [
    { code: "zh-hans", label: t("lang.zh") },
    { code: "en", label: t("lang.en") },
  ];

  return (
    <div className="lang-switcher">
      {langs.map(({ code, label }, i) => (
        <span key={code}>
          {i > 0 && (
            <span className="lang-divider" aria-hidden="true">
              |
            </span>
          )}
          <button
            type="button"
            className={`lang-option${lang === code ? " lang-option--active" : ""}`}
            onClick={() => setLang(code)}
          >
            {label}
          </button>
        </span>
      ))}
    </div>
  );
}
