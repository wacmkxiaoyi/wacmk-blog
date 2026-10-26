import useI18n from "../../hooks/useI18n";
import { enabledProfileSections, profileSections } from "./profileSections";

export default function ProfileSidebar({
  activeSection = "articles",
  onSectionChange,
}) {
  const { t } = useI18n();
  return (
    <aside className="profile-sidebar">
      <span>{t("profile.workspace")}</span>
      <h2>{t("profile.title")}</h2>
      <nav aria-label={t("profile.navigation")}>
        {profileSections.map((section) => {
          const enabled = enabledProfileSections.has(section);
          const active = section === activeSection;
          return (
            <button
              key={section}
              type="button"
              className={active ? "is-active" : ""}
              disabled={!enabled}
              onClick={() => enabled && onSectionChange?.(section)}
              aria-current={active ? "page" : undefined}
            >
              {t(`profile.nav.${section}`)}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
