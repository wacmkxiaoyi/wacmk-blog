import { useNavigate } from "react-router-dom";
import useI18n from "../../hooks/useI18n";

const nav = ["basic", "users", "posts", "books", "attachments", "audit"];

function ManageSidebar({ active }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <aside className="manage-sidebar">
      <span>{t("admin.basic.workspace")}</span>
      <h2>{t("admin.basic.management")}</h2>
      <nav>
        {nav.map((item) => {
          const enabled =
            item === "basic" ||
            item === "users" ||
            item === "posts" ||
            item === "books" ||
            item === "attachments" ||
            item === "audit";
          const target = item === "posts" ? "articles" : item;
          return (
            <button
              key={item}
              className={item === active ? "is-active" : ""}
              disabled={!enabled}
              onClick={() => enabled && navigate(`/manage/${target}`)}
            >
              {t(`admin.basic.nav.${item}`)}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export { ManageSidebar };
export default ManageSidebar;
