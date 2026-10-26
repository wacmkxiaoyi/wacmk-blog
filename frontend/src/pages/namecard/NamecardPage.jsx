import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useI18n from "../../hooks/useI18n";
import api from "../../api";
import BalanceIcon from "../../components/ui/BalanceIcon";
import "./NamecardPage.css";
import "./NamecardLayout.css";
import "./NamecardBalances.css";

const tabs = ["basic", "posts", "books", "comments"];

function Avatar({ user }) {
  const initial = (user.first_name || user.username || "?")
    .slice(0, 1)
    .toUpperCase();
  return user.avatar_url ? (
    <img className="namecard-avatar" src={user.avatar_url} alt="" />
  ) : (
    <span className="namecard-avatar namecard-avatar--fallback">{initial}</span>
  );
}

export default function NamecardPage() {
  const { userId } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("basic");
  const [error, setError] = useState(false);

  useEffect(() => {
    setUser(null);
    setError(false);
    const controller = new AbortController();
    api.namecards
      .get(userId, { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setUser(data))
      .catch(() => !controller.signal.aborted && setError(true));
    return () => controller.abort();
  }, [userId]);
  if (error)
    return <main className="namecard-message">{t("namecard.loadFailed")}</main>;
  if (!user)
    return <main className="namecard-message">{t("namecard.loading")}</main>;
  return (
    <main className="namecard-page">
      <aside className="namecard-sidebar">
        <span>{t("namecard.workspace")}</span>
        <h2>{t("namecard.title")}</h2>
        <nav>
          {tabs.map((item) => (
            <button
              type="button"
              key={item}
              className={tab === item ? "is-active" : ""}
              onClick={() => setTab(item)}
            >
              {t(`namecard.tabs.${item}`)}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="namecard-back"
          onClick={() => navigate(-1)}
        >
          {t("namecard.back")}
        </button>
      </aside>
      <section className="namecard-content">
        {tab === "basic" ? (
          <Basic user={user} t={t} />
        ) : (
          <Placeholder tab={tab} t={t} />
        )}
      </section>
    </main>
  );
}

function Basic({ user, t }) {
  const social = [
    ["GitHub", user.github],
    [t("namecard.website"), user.website],
    ["X / Twitter", user.twitter],
    ["QQ", user.qq],
    [t("namecard.email"), user.email],
  ].filter(([, value]) => value);
  return (
    <section className="namecard-shell">
      <header className="namecard-heading">
        <div className="namecard-person">
          <Avatar user={user} />
          <div>
            <div className="namecard-title-line">
              <h1>{user.first_name || user.username}</h1>
              {(user.is_staff || user.is_superuser) && (
                <span className="namecard-tag">
                  {t("namecard.administrator")}
                </span>
              )}
              {user.vip_level > 0 && (
                <span className="namecard-tag namecard-tag--vip">
                  VIP {user.vip_level}
                </span>
              )}
            </div>
            <p>@{user.username}</p>
          </div>
        </div>
        {user.show_balances && (
          <div className="namecard-balances">
            <span
              className="namecard-balance namecard-balance--money"
              aria-label={t("namecard.money")}
            >
              <BalanceIcon type="money" />
              <strong>{user.money_balance}</strong>
            </span>
            <span
              className="namecard-balance namecard-balance--points"
              aria-label={t("namecard.points")}
            >
              <BalanceIcon type="points" />
              <strong>{user.points_balance}</strong>
            </span>
          </div>
        )}
      </header>
      <section className="namecard-section">
        <h2>{t("namecard.basicInformation")}</h2>
        <dl className="namecard-facts">
          <div>
            <dt>{t("namecard.gender")}</dt>
            <dd>
              {user.gender
                ? t(`profile.genderOptions.${user.gender}`)
                : t("namecard.unspecified")}
            </dd>
          </div>
          <div>
            <dt>{t("namecard.age")}</dt>
            <dd>{user.age || t("namecard.unspecified")}</dd>
          </div>
        </dl>
        <div className="namecard-description">
          {user.description || <em>{t("namecard.noDescription")}</em>}
        </div>
      </section>
      {social.length > 0 && (
        <section className="namecard-section">
          <h2>{t("namecard.links")}</h2>
          <div className="namecard-links">
            {social.map(([label, value]) => (
              <a
                key={label}
                href={value.startsWith("http") ? value : undefined}
                target="_blank"
                rel="noreferrer"
              >
                {label}: <span>{value}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function Placeholder({ tab, t }) {
  return (
    <section className="namecard-shell namecard-placeholder">
      <span>{t(`namecard.tabs.${tab}`)}</span>
      <h1>{t("namecard.comingSoon")}</h1>
      <p>{t("namecard.placeholderDescription")}</p>
      <div className="namecard-placeholder-cards">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}
