import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useI18n from "../../hooks/useI18n";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import {
  APP_REPOSITORY_URL,
  getRouteHeaderOptions,
  primaryNavigation,
} from "../../config/appNavigation";
import BalanceIcon from "../ui/BalanceIcon";
import "./AppHeader.css";

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    article: (
      <>
        <path d="M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 10h6M9 14h6M9 18h4" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21Z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21Z" />
      </>
    ),
    tag: (
      <>
        <path d="M20.5 13.5 13.5 20.5a2.1 2.1 0 0 1-3 0l-7-7A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.5.5l7 7a2.1 2.1 0 0 1 0 3Z" />
        <circle cx="8" cy="8" r="1" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    github: (
      <>
        <path d="M15 22v-3.9c.04-1-.35-1.98-1.08-2.67 3.53-.4 7.24-1.73 7.24-7.84a6.1 6.1 0 0 0-1.62-4.23 5.67 5.67 0 0 0-.15-4.17s-1.32-.42-4.34 1.62a14.9 14.9 0 0 0-7.9 0C4.13.77 2.8 1.2 2.8 1.2a5.67 5.67 0 0 0-.15 4.17 6.1 6.1 0 0 0-1.62 4.23c0 6.1 3.7 7.43 7.23 7.84A3.58 3.58 0 0 0 7.2 20v2" />
        <path d="M7.2 19.2c-3.2 1-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67" />
      </>
    ),
    manage: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 12h8M12 8v8" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M21 19V5a2 2 0 0 0-2-2h-5" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function getUserViewModel(user, config, t) {
  const vip = config?.vip?.levels?.find(
    (level) => level.level === user?.vip_level,
  );
  const identity =
    user?.is_staff || user?.is_superuser
      ? t("header.account.administrator")
      : vip?.display_name || t("header.account.normalUser");
  return {
    displayName:
      user?.display_name || user?.first_name || user?.username || "-",
    subtitle: user?.email || "-",
    identity,
    money: user?.money_balance ?? 0,
    points: user?.points_balance ?? 0,
    avatarUrl: user?.avatar_url || null,
  };
}

export default function AppHeader() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { config } = useSiteRuntime();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();
  const headerOptions = getRouteHeaderOptions(location.pathname);
  const search = headerOptions.search;
  const params = new URLSearchParams(location.search);
  const [searchValue, setSearchValue] = useState(
    search ? params.get(search.queryKey) || "" : "",
  );
  const account = getUserViewModel(user, config, t);
  const initials = account.displayName.trim().slice(0, 1).toUpperCase() || "?";
  const canManage = Boolean(user?.is_staff || user?.is_superuser);

  useEffect(() => {
    setSearchValue(search ? params.get(search.queryKey) || "" : "");
  }, [location.search, search]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeForOutsidePointer(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function closeForEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeForOutsidePointer);
    document.addEventListener("keydown", closeForEscape);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsidePointer);
      document.removeEventListener("keydown", closeForEscape);
    };
  }, [menuOpen]);

  function submitSearch(event) {
    event.preventDefault();
    if (!search) return;
    const nextParams = new URLSearchParams();
    const value = searchValue.trim();
    if (value) nextParams.set(search.queryKey, value);
    navigate({ pathname: search.endpoint, search: nextParams.toString() });
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/", { replace: true });
  }

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <nav
          className="app-header__nav"
          aria-label={t("header.primaryNavigation")}
        >
          {primaryNavigation.map((item) => {
            const label = t(`header.navigation.${item.key}`);
            const content = (
              <>
                <span className="app-header__nav-icon">
                  <Icon name={item.icon} />
                </span>
                <span className="app-header__nav-label">{label}</span>
              </>
            );
            if (!item.available) {
              return (
                <span
                  key={item.key}
                  className="app-header__nav-item app-header__nav-item--placeholder"
                  aria-label={t("header.comingSoon", { label })}
                >
                  {content}
                </span>
              );
            }
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `app-header__nav-item${isActive ? " is-active" : ""}`
                }
                aria-label={label}
              >
                {content}
              </NavLink>
            );
          })}
        </nav>

        <div className="app-header__center">
          {search ? (
            <form className="app-header__search-form" onSubmit={submitSearch}>
              <label className="sr-only" htmlFor="app-global-search">
                {t("header.search.label")}
              </label>
              <input
                id="app-global-search"
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t(`header.search.${search.scope}`)}
              />
              <button type="submit" aria-label={t("header.search.submit")}>
                <Icon name="search" size={16} />
              </button>
            </form>
          ) : null}
        </div>

        <div className="app-header__controls">
          <a
            className="app-header__repository"
            href={APP_REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("header.repository.label")}
          >
            <Icon name="github" size={19} />
            <span>{t("header.repository.title")}</span>
          </a>

          <div className="app-header__account" ref={menuRef}>
            <button
              ref={triggerRef}
              type="button"
              className="app-header__avatar-button"
              aria-label={t("header.account.openMenu")}
              aria-haspopup="menu"
              aria-controls={menuId}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
            {menuOpen ? (
              <div id={menuId} className="app-header__account-menu" role="menu">
                <div className="app-header__account-summary">
                  <span className="app-header__avatar app-header__avatar--large">
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt="" />
                    ) : (
                      initials
                    )}
                  </span>
                  <div>
                    <strong>{account.displayName}</strong>
                    <span>{account.subtitle}</span>
                    <p>[{account.identity}]</p>
                  </div>
                </div>
                <div
                  className="app-header__balances"
                  aria-label={t("header.account.summary")}
                >
                  <span>
                    <BalanceIcon type="money" size={16} />
                    {account.money}
                  </span>
                  <span>
                    <BalanceIcon type="points" size={16} />
                    {account.points}
                  </span>
                </div>
                <div className="app-header__menu-links">
                  {canManage ? (
                    <Link
                      role="menuitem"
                      to="/manage/basic"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="manage" size={16} />
                      {t("header.account.management")}
                    </Link>
                  ) : null}
                  <Link
                    role="menuitem"
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon name="profile" size={16} />
                    {t("header.account.profile")}
                  </Link>
                </div>
                <button
                  type="button"
                  className="app-header__logout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <Icon name="logout" size={16} />
                  {t("auth.signOut")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
