import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useI18n from "../../hooks/useI18n";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import Button from "../../components/ui/Button";
import Checkbox from "../../components/ui/Checkbox";
import PasswordInput from "../../components/ui/PasswordInput";
import Toast from "../../components/ui/Toast";
import AttachmentTable from "../../components/attachment-manager/AttachmentTable";
import ProfileArticlesSection from "./ProfileArticlesSection";
import ProfileBooksSection from "./ProfileBooksSection";
import ProfileSidebar from "./ProfileSidebar";
import { getProfileSection } from "./profileSections";
import api from "../../api";
import { Table, useTableController } from "../../packages/table";
import "./ProfilePage.css";

const editableFields = [
  "first_name",
  "description",
  "gender",
  "age",
  "github",
  "website",
  "twitter",
  "qq",
  "show_email_on_namecard",
];

function snapshot(profile) {
  return Object.fromEntries(
    editableFields.map((field) => [
      field,
      profile[field] ?? (field === "show_email_on_namecard" ? false : ""),
    ]),
  );
}

function Avatar({ url, name, className }) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase() || "?";
  return url ? (
    <img className={className} src={url} alt="" />
  ) : (
    <span className={`${className} profile-avatar--fallback`}>{initial}</span>
  );
}

function formatPercent(value, prefix) {
  const amount = Math.round(Number(value || 0) * 100);
  return amount > 0 ? `${prefix}${amount}%` : "-";
}

function formatStorageSize(bytes) {
  let value = Number(bytes || 0);
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (value < 1024 || unit === "GB") return `${value.toFixed(2)} ${unit}`;
    value /= 1024;
  }
}

function buildUserGroupRows(config, t) {
  const columns = config?.vip?.levels || [];
  const featureRows = [
    [
      "publishArticles",
      config?.["content.article"]?.allow_non_admin_create,
      config?.["content.article"]?.vip_only,
    ],
    [
      "postComments",
      config?.comment?.allow_user_comment,
      config?.comment?.vip_only,
    ],
    [
      "publishBooks",
      config?.["content.book"]?.allow_non_admin_create,
      config?.["content.book"]?.vip_only,
    ],
    [
      "uploadAttachments",
      config?.["upload.attachment"]?.allow_user_upload,
      config?.["upload.attachment"]?.vip_only,
    ],
    [
      "uploadVideos",
      config?.["upload.video"]?.allow_user_upload,
      config?.["upload.video"]?.vip_only,
    ],
    [
      "aiFeature",
      config?.["basic.live2d"]?.ai?.enabled,
      config?.["basic.live2d"]?.ai?.vip_only,
    ],
  ].map(([key, enabled, vipOnly]) => ({
    label: t(`profile.userGroup.rows.${key}`),
    cells: [
      Boolean(enabled && !vipOnly),
      ...columns.map(() => Boolean(enabled)),
    ],
  }));
  const benefits = [
    [
      "storageCapacity",
      (level) => `${Number(level.storage_capacity_mb || 0).toFixed(2)} MB`,
    ],
    ["vipResources", (level) => level.level > 0],
    ["moneyDiscount", (level) => formatPercent(level.money_discount, "-")],
    ["pointsDiscount", (level) => formatPercent(level.points_discount, "-")],
    ["moneyReward", (level) => formatPercent(level.money_reward, "+")],
    ["pointsReward", (level) => formatPercent(level.points_reward, "+")],
    ["dailyMoney", (level) => level.daily_login_bonus_money || "-"],
    ["dailyPoints", (level) => level.daily_login_bonus_points || "-"],
    ["firstCommentMoney", (level) => level.first_comment_bonus_money || "-"],
    ["firstCommentPoints", (level) => level.first_comment_bonus_points || "-"],
  ].map(([key, getValue]) => ({
    label: t(`profile.userGroup.rows.${key}`),
    cells: [
      key === "storageCapacity"
        ? `${Number(config?.user?.storage_capacity_mb || 0).toFixed(2)} MB`
        : "-",
      ...columns.map(getValue),
    ],
  }));
  return [...featureRows, ...benefits];
}

export default function ProfilePage() {
  const { t } = useI18n();
  const { fetchUser, updateUser } = useAuth();
  const { config } = useSiteRuntime();
  const [profile, setProfile] = useState(null);
  const [initial, setInitial] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [errors, setErrors] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = getProfileSection(searchParams.get("section"));
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailErrors, setEmailErrors] = useState({});
  const [sendingCode, setSendingCode] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
    new_password_confirm: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    api.profile
      .get({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const values = snapshot(data);
        setProfile({ ...data, ...values });
        setInitial(values);
        setEmail(data.email);
      })
      .catch(
        () =>
          !controller.signal.aborted &&
          setNotice({ type: "error", message: t("profile.loadFailed") }),
      );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setInterval(
      () => setResendSeconds((seconds) => Math.max(seconds - 1, 0)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const dirty =
    profile &&
    initial &&
    (JSON.stringify(snapshot(profile)) !== JSON.stringify(initial) ||
      Boolean(avatarFile) ||
      removeAvatar);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: null }));
  }

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setRemoveAvatar(false);
    event.target.value = "";
  }

  function removeCurrentAvatar() {
    setAvatarFile(null);
    setRemoveAvatar(true);
  }

  function undoAvatarRemoval() {
    setRemoveAvatar(false);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const saved = await api.profile.save(
        { ...snapshot(profile), remove_avatar: removeAvatar },
        avatarFile,
      );
      const values = snapshot(saved);
      setProfile({ ...saved, ...values });
      setInitial(values);
      setAvatarFile(null);
      setRemoveAvatar(false);
      updateUser(saved);
      setNotice({ type: "success", message: t("profile.saved") });
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") setErrors(data);
      setNotice({
        type: "error",
        message: data?.detail || t("profile.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendCode() {
    setSendingCode(true);
    setEmailErrors({});
    try {
      const result = await api.profile.sendEmailChangeCode(email);
      setResendSeconds(result.resend_in || 60);
      setNotice({ type: "success", message: t("profile.codeSent") });
    } catch (error) {
      const data = error.response?.data;
      setEmailErrors(data && typeof data === "object" ? data : {});
      setNotice({
        type: "error",
        message: data?.detail || t("profile.sendCodeFailed"),
      });
    } finally {
      setSendingCode(false);
    }
  }

  async function submitEmail(event) {
    event.preventDefault();
    setSavingEmail(true);
    setEmailErrors({});
    try {
      await api.profile.changeEmail(email, verificationCode);
      setVerificationCode("");
      await fetchUser();
      setNotice({ type: "success", message: t("profile.emailSaved") });
    } catch (error) {
      const data = error.response?.data;
      setEmailErrors(data && typeof data === "object" ? data : {});
      setNotice({
        type: "error",
        message: data?.detail || t("profile.emailSaveFailed"),
      });
    } finally {
      setSavingEmail(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      await api.profile.changePassword(passwords);
      setPasswords({
        old_password: "",
        new_password: "",
        new_password_confirm: "",
      });
      setNotice({ type: "success", message: t("profile.passwordSaved") });
    } catch (error) {
      const data = error.response?.data;
      setPasswordErrors(data && typeof data === "object" ? data : {});
      setNotice({
        type: "error",
        message: data?.detail || t("profile.passwordSaveFailed"),
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (!profile)
    return <main className="profile-loading">{t("profile.loading")}</main>;
  const shownAvatar = removeAvatar ? "" : avatarPreview || profile.avatar_url;
  const hasAvatar = Boolean(shownAvatar);

  return (
    <main className="profile-page">
      <ProfileSidebar
        activeSection={activeSection}
        onSectionChange={(section) =>
          setSearchParams(section === "basic" ? {} : { section })
        }
      />
      <section className="profile-content">
        {activeSection === "basic" ? (
          <form className="profile-shell" onSubmit={submit}>
            <header className="profile-heading">
              <span>{t("profile.workspace")}</span>
              <h1>{t("profile.basicTitle")}</h1>
              <p>{t("profile.description")}</p>
            </header>
            <section className="profile-section">
              <h2>{t("profile.basicTitle")}</h2>
              <div className="profile-fields">
                <div className="profile-avatar-field">
                  <button
                    type="button"
                    className="profile-avatar-trigger"
                    onClick={() => inputRef.current?.click()}
                    aria-label={t("profile.changeAvatar")}
                  >
                    <Avatar
                      url={shownAvatar}
                      name={profile.first_name || profile.username}
                      className="profile-avatar"
                    />
                  </button>
                  <input
                    ref={inputRef}
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={chooseAvatar}
                  />
                  <div className="profile-avatar-actions">
                    {hasAvatar && (
                      <button
                        type="button"
                        className="profile-text-button profile-text-button--danger"
                        onClick={removeCurrentAvatar}
                      >
                        {t("profile.removeAvatar")}
                      </button>
                    )}
                    {removeAvatar && (
                      <button
                        type="button"
                        className="profile-text-button"
                        onClick={undoAvatarRemoval}
                      >
                        {t("profile.undoRemove")}
                      </button>
                    )}
                  </div>
                  <small>{t("profile.avatarHelp")}</small>
                  {errors.avatar && (
                    <span className="field-error">{errors.avatar}</span>
                  )}
                </div>
                <Field label={t("profile.username")}>
                  <div className="profile-readonly">{profile.username}</div>
                </Field>
                <Field label={t("profile.nickname")} error={errors.first_name}>
                  <input
                    className="input-control"
                    value={profile.first_name}
                    maxLength="20"
                    onChange={(event) =>
                      setField("first_name", event.target.value)
                    }
                    placeholder={t("profile.nicknamePlaceholder")}
                  />
                </Field>
                <div className="profile-grid">
                  <Field label={t("profile.gender")} error={errors.gender}>
                    <select
                      value={profile.gender}
                      onChange={(event) =>
                        setField("gender", event.target.value)
                      }
                    >
                      <option value="">
                        {t("profile.genderOptions.unspecified")}
                      </option>
                      <option value="male">
                        {t("profile.genderOptions.male")}
                      </option>
                      <option value="female">
                        {t("profile.genderOptions.female")}
                      </option>
                      <option value="other">
                        {t("profile.genderOptions.other")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("profile.age")} error={errors.age}>
                    <input
                      className="input-control"
                      type="number"
                      min="1"
                      max="150"
                      value={profile.age ?? ""}
                      onChange={(event) =>
                        setField(
                          "age",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </Field>
                </div>
                <Field
                  label={t("profile.descriptionLabel")}
                  error={errors.description}
                >
                  <textarea
                    rows="4"
                    maxLength="500"
                    value={profile.description}
                    onChange={(event) =>
                      setField("description", event.target.value)
                    }
                    placeholder={t("profile.descriptionPlaceholder")}
                  />
                </Field>
              </div>
            </section>
            <section className="profile-section">
              <h2>{t("profile.publicLinks")}</h2>
              <div className="profile-fields">
                {["github", "website", "twitter", "qq"].map((field) => (
                  <Field
                    key={field}
                    label={t(`profile.${field}`)}
                    error={errors[field]}
                  >
                    <input
                      className="input-control"
                      type={field === "qq" ? "text" : "url"}
                      value={profile[field]}
                      onChange={(event) => setField(field, event.target.value)}
                      placeholder={t(`profile.${field}Placeholder`)}
                    />
                  </Field>
                ))}
                <Checkbox
                  label={t("profile.showEmail")}
                  checked={profile.show_email_on_namecard}
                  onChange={(event) =>
                    setField("show_email_on_namecard", event.target.checked)
                  }
                />
              </div>
            </section>
            <footer className="profile-actions">
              <Button type="submit" loading={saving} disabled={!dirty}>
                {t("profile.save")}
              </Button>
            </footer>
          </form>
        ) : activeSection === "security" ? (
          <section className="profile-shell">
            <header className="profile-heading">
              <span>{t("profile.workspace")}</span>
              <h1>{t("profile.securityTitle")}</h1>
              <p>{t("profile.securityDescription")}</p>
            </header>
            <form onSubmit={submitEmail}>
              <section className="profile-section">
                <h2>{t("profile.emailAddress")}</h2>
                <div className="profile-fields">
                  <Field label={t("profile.email")} error={emailErrors.email}>
                    <input
                      className="input-control"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailErrors({});
                      }}
                    />
                  </Field>
                  {email !== profile.email && (
                    <Field
                      label={t("profile.verificationCode")}
                      error={
                        emailErrors.verification_code ||
                        emailErrors.non_field_errors
                      }
                    >
                      <div className="profile-inline-field">
                        <input
                          className="input-control"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength="6"
                          value={verificationCode}
                          onChange={(event) =>
                            setVerificationCode(event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          loading={sendingCode}
                          disabled={resendSeconds > 0}
                          onClick={sendCode}
                        >
                          {resendSeconds
                            ? t("profile.resendIn", { seconds: resendSeconds })
                            : t("profile.sendCode")}
                        </Button>
                      </div>
                    </Field>
                  )}
                </div>
                <footer className="profile-actions">
                  <Button
                    type="submit"
                    loading={savingEmail}
                    disabled={email === profile.email || !verificationCode}
                  >
                    {t("profile.saveEmail")}
                  </Button>
                </footer>
              </section>
            </form>
            <form onSubmit={submitPassword}>
              <section className="profile-section">
                <h2>{t("profile.passwordTitle")}</h2>
                <div className="profile-fields">
                  {[
                    ["old_password", "currentPassword"],
                    ["new_password", "newPassword"],
                    ["new_password_confirm", "confirmNewPassword"],
                  ].map(([field, label]) => (
                    <PasswordInput
                      key={field}
                      label={t(`profile.${label}`)}
                      value={passwords[field]}
                      error={passwordErrors[field]}
                      onChange={(event) => {
                        setPasswords((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }));
                        setPasswordErrors((current) => ({
                          ...current,
                          [field]: null,
                        }));
                      }}
                    />
                  ))}
                </div>
                <footer className="profile-actions">
                  <Button
                    type="submit"
                    loading={savingPassword}
                    disabled={!Object.values(passwords).every(Boolean)}
                  >
                    {t("profile.updatePassword")}
                  </Button>
                </footer>
              </section>
            </form>
          </section>
        ) : activeSection === "moneyHistory" ? (
          <BalanceHistorySection key="money" type="money" t={t} />
        ) : activeSection === "pointsHistory" ? (
          <BalanceHistorySection key="points" type="points" t={t} />
        ) : activeSection === "articles" ? (
          <ProfileArticlesSection />
        ) : activeSection === "books" ? (
          <ProfileBooksSection />
        ) : activeSection === "attachments" ? (
          <ProfileAttachmentsSection profile={profile} />
        ) : (
          <UserGroupSection profile={profile} config={config} t={t} />
        )}
      </section>
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}

function ProfileAttachmentsSection({ profile }) {
  const { t } = useI18n();
  return (
    <section className="profile-shell profile-attachments-shell">
      <header className="profile-heading">
        <div>
          <span>{t("profile.workspace")}</span>
          <h1>{t("attachment.mineTitle")}</h1>
          <p>{t("attachment.mineDescription")}</p>
        </div>
        <div className="profile-storage-summary">
          <span>{t("profile.storageUsed")}</span>
          <strong>{formatStorageSize(profile?.storage_used_bytes)}</strong>
        </div>
      </header>
      <AttachmentTable
        fetchData={(
          { query, page, pageSize, sortKey, sortDirection },
          config,
        ) =>
          api.resources.listAttachments(
            {
              query,
              page,
              page_size: pageSize,
              ordering: sortKey
                ? `${sortDirection === "desc" ? "-" : ""}${sortKey}`
                : "-updated_at",
            },
            config,
          )
        }
        updateAttachment={api.resources.updateAttachment}
        deleteAttachment={api.resources.deleteAttachment}
        requestDownload={api.resources.requestStandaloneAttachmentDownload}
      />
    </section>
  );
}

function BalanceHistorySection({ type, t }) {
  const { lang } = useI18n();
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "created_at", direction: "desc" },
    fetchData: ({ page, pageSize }, config) =>
      type === "money"
        ? api.profile.getMoneyHistory({ page, pageSize }, config)
        : api.profile.getPointsHistory({ page, pageSize }, config),
  });
  const formatDate = (value) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  const columns = [
    {
      key: "created_at",
      title: t("profile.history.columns.time"),
      minWidth: 180,
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "change_amount",
      title: t("profile.history.columns.amount"),
      minWidth: 120,
      render: (row) => (
        <strong
          className={`profile-ledger-amount ${row.change_amount > 0 ? "is-positive" : "is-negative"}`}
        >
          {row.change_amount > 0 ? "+" : ""}
          {row.change_amount}
        </strong>
      ),
    },
    {
      key: "balance_after",
      title: t("profile.history.columns.balanceAfter"),
      minWidth: 140,
      render: (row) =>
        row.balance_after.toLocaleString(lang === "en" ? "en-US" : "zh-CN"),
    },
    {
      key: "reason_type",
      title: t("profile.history.columns.reason"),
      minWidth: 220,
      render: (row) => (
        <div className="profile-ledger-reason">
          <span>{t(`profile.history.reasons.${row.reason_type}`)}</span>
          {row.reason_text && <small>{row.reason_text}</small>}
        </div>
      ),
    },
  ];
  const title =
    type === "money"
      ? t("profile.history.moneyTitle")
      : t("profile.history.pointsTitle");
  const description =
    type === "money"
      ? t("profile.history.moneyDescription")
      : t("profile.history.pointsDescription");
  return (
    <section className="profile-shell">
      <header className="profile-heading">
        <span>{t("profile.workspace")}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <Table
        columns={columns}
        rows={controller.rows}
        rowKey={(row) => row.id}
        translate={translate}
        loading={controller.loading}
        error={
          controller.error ? (
            <span>{t("profile.history.loadFailed")}</span>
          ) : null
        }
        empty={<span>{t("profile.history.empty")}</span>}
        page={controller.page}
        pageSize={controller.pageSize}
        total={controller.total}
        pageSizeOptions={[20, 50, 100]}
        onPageChange={controller.changePage}
        onPageSizeChange={controller.changePageSize}
      />
    </section>
  );
}

function UserGroupSection({ profile, config, t }) {
  const tableWrapRef = useRef(null);
  const levels = config?.vip?.levels || [];
  const columns = [
    { key: "normal", label: t("profile.userGroup.normal"), level: 0 },
    ...levels,
  ];
  const rows = buildUserGroupRows(config, t);
  const currentLevel = columns.some(
    (column) => column.level === profile.vip_level,
  )
    ? profile.vip_level
    : 0;

  useEffect(() => {
    const tableWrap = tableWrapRef.current;
    const currentHeader = tableWrap?.querySelector("thead .is-current");
    const stickyHeader = tableWrap?.querySelector("thead th:first-child");
    if (!tableWrap || !currentHeader || !stickyHeader) return;
    const stickyWidth = stickyHeader.getBoundingClientRect().width;
    const currentWidth = currentHeader.getBoundingClientRect().width;
    const target =
      currentHeader.offsetLeft -
      stickyWidth -
      (tableWrap.clientWidth - stickyWidth - currentWidth) / 2;
    tableWrap.scrollLeft = Math.max(Math.round(target), 0);
  }, [currentLevel, levels.length]);

  return (
    <section className="profile-shell">
      <header className="profile-heading">
        <span>{t("profile.workspace")}</span>
        <h1>{t("profile.userGroup.title")}</h1>
        <p>{t("profile.userGroup.description")}</p>
      </header>
      <div ref={tableWrapRef} className="profile-group-table-wrap">
        <table className="profile-group-table">
          <thead>
            <tr>
              <th scope="col">{t("profile.userGroup.feature")}</th>
              {columns.map((column) => (
                <th
                  key={column.key || column.level}
                  scope="col"
                  className={column.level === currentLevel ? "is-current" : ""}
                >
                  {column.label || column.display_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, index) => (
                  <td
                    key={columns[index].key || columns[index].level}
                    className={
                      columns[index].level === currentLevel ? "is-current" : ""
                    }
                  >
                    <span
                      className={
                        typeof cell === "boolean"
                          ? `profile-group-cell ${cell ? "is-supported" : "is-unsupported"}`
                          : "profile-group-cell is-value"
                      }
                    >
                      {typeof cell === "boolean" ? (cell ? "✓" : "×") : cell}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="profile-field">
      <span>{label}</span>
      {children}
      {error && (
        <span className="field-error">
          {Array.isArray(error) ? error.join(" ") : error}
        </span>
      )}
    </label>
  );
}
