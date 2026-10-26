import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import { Modal } from "../../../packages/modal";
import { Table, useTableController } from "../../../packages/table";
import ManageSidebar from "../ManageSidebar";
import api from "../../../api";
import "../Basic/BasicSettingsPage.css";
import "./UserManagementPage.css";
import "./UserManagementLayout.css";

const blankUser = { username: "", email: "", first_name: "", password: "" };

function formatStorageSize(bytes) {
  let value = Number(bytes || 0);
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (value < 1024 || unit === "GB") return `${value.toFixed(2)} ${unit}`;
    value /= 1024;
  }
}

function Avatar({ user }) {
  const initial = (user.first_name || user.username || "?")
    .slice(0, 1)
    .toUpperCase();
  return user.avatar_url ? (
    <img className="managed-user-avatar" src={user.avatar_url} alt="" />
  ) : (
    <span className="managed-user-avatar managed-user-avatar--fallback">
      {initial}
    </span>
  );
}

function errorMessage(error, fallback) {
  const data = error.response?.data;
  if (data?.detail) return data.detail;
  return error.message || fallback;
}

export default function UserManagementPage() {
  const { t } = useI18n();
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const { user: actor } = useAuth();
  const { config } = useSiteRuntime();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [createValues, setCreateValues] = useState(blankUser);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "username", direction: "asc" },
    fetchData: api.manage.listUsers,
  });

  async function createUser() {
    setSaving(true);
    try {
      await api.manage.createUser(createValues);
      setCreateOpen(false);
      setCreateValues(blankUser);
      setNotice({ type: "success", message: t("admin.users.created") });
      await controller.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.users.createFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    setSaving(true);
    try {
      await api.manage.deleteUser(deleting.id);
      controller.removeRow((row) => row.id === deleting.id);
      setDeleting(null);
      setNotice({ type: "success", message: t("admin.users.deleted") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.users.deleteFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "username",
      title: t("admin.users.columns.user"),
      canOrder: true,
      minWidth: 220,
      render: (row) => (
        <div className="managed-user-cell">
          <Avatar user={row} />
          <div>
            <strong>{row.first_name || row.username}</strong>
            <small>@{row.username}</small>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      title: t("admin.users.columns.email"),
      canOrder: true,
      minWidth: 230,
      render: (row) => row.email,
    },
    {
      key: "role",
      title: t("admin.users.columns.roles"),
      canOrder: true,
      minWidth: 145,
      render: (row) => (
        <div className="managed-user-tags">
          {row.is_superuser && (
            <span className="managed-tag managed-tag--admin">
              {t("admin.users.superuser")}
            </span>
          )}
          {row.is_staff && (
            <span className="managed-tag">{t("admin.users.staff")}</span>
          )}
          {row.vip_level > 0 && (
            <span className="managed-tag managed-tag--vip">
              VIP {row.vip_level}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "is_active",
      title: t("admin.users.columns.status"),
      canOrder: true,
      minWidth: 115,
      render: (row) => (
        <span
          className={`managed-tag ${row.is_active ? "managed-tag--active" : "managed-tag--muted"}`}
        >
          {row.is_active ? t("admin.users.active") : t("admin.users.disabled")}
        </span>
      ),
    },
    {
      key: "storage_used_bytes",
      title: t("admin.users.columns.storageUsed"),
      minWidth: 145,
      render: (row) => formatStorageSize(row.storage_used_bytes),
    },
    {
      key: "date_joined",
      title: t("admin.users.columns.joined"),
      canOrder: true,
      minWidth: 150,
      render: (row) =>
        new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
          new Date(row.date_joined),
        ),
    },
  ];

  return (
    <main className="manage-page">
      <ManageSidebar active="users" />
      <section className="manage-content">
        <div className="settings-shell users-shell">
          <header className="settings-heading users-heading">
            <div>
              <span>{t("admin.basic.website")}</span>
              <h1>{t("admin.users.title")}</h1>
              <p>{t("admin.users.description")}</p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              {t("admin.users.create")}
            </Button>
          </header>
          <Table
            columns={columns}
            rows={controller.rows}
            rowKey={(row) => row.id}
            translate={translate}
            loading={controller.loading}
            error={
              controller.error ? (
                <span>{t("admin.users.loadFailed")}</span>
              ) : null
            }
            empty={<span>{t("admin.users.empty")}</span>}
            searchText={controller.searchText}
            onSearchTextChange={controller.setSearchText}
            onSearchEnter={controller.submitSearch}
            searchPlaceholderText={t("admin.users.searchPlaceholder")}
            sortKey={controller.sortKey}
            sortDirection={controller.sortDirection}
            onSortChange={controller.changeSort}
            page={controller.page}
            pageSize={controller.pageSize}
            total={controller.total}
            pageSizeOptions={[20, 50, 100]}
            onPageChange={controller.changePage}
            onPageSizeChange={controller.changePageSize}
            getRowContextActions={(row) => [
              {
                group: 1,
                children: [
                  {
                    key: "namecard",
                    label: t("admin.users.browse"),
                    onClick: () => navigate(`/users/${row.id}/namecard`),
                  },
                  {
                    key: "edit",
                    label: t("admin.users.edit"),
                    onClick: () => row.can_manage && setEditing(row),
                    disabled: !row.can_manage,
                  },
                ],
              },
              {
                group: 2,
                children: [
                  {
                    key: "delete",
                    label: t("admin.users.delete"),
                    danger: true,
                    onClick: () => setDeleting(row),
                    disabled: !row.can_manage_sensitive,
                  },
                ],
              },
            ]}
          />
        </div>
      </section>
      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        kicker={t("admin.users.title")}
        title={t("admin.users.createTitle")}
        actions={[
          {
            key: "cancel",
            label: t("admin.users.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "save",
            label: t("admin.users.create"),
            variant: "primary",
            loading: saving,
            onClick: createUser,
          },
        ]}
      >
        <UserFields
          values={createValues}
          onChange={(field, value) =>
            setCreateValues((current) => ({ ...current, [field]: value }))
          }
          create
          t={t}
        />
      </Modal>
      <EditUserModal
        open={Boolean(editing)}
        user={editing}
        actor={actor}
        maxVipLevel={config?.vip?.levels?.length || 0}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(user, message) => {
          controller.replaceRow((row) => row.id === user.id, user);
          setEditing(null);
          setNotice({ type: "success", message });
        }}
        onError={(error) =>
          setNotice({
            type: "error",
            message: errorMessage(error, t("admin.users.saveFailed")),
          })
        }
        t={t}
      />
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        kicker={t("admin.users.danger")}
        title={t("admin.users.deleteTitle")}
        actions={[
          {
            key: "cancel",
            label: t("admin.users.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t("admin.users.delete"),
            variant: "danger",
            loading: saving,
            onClick: removeUser,
          },
        ]}
      >
        <p>
          {t("admin.users.deleteDescription", {
            username: deleting?.username || "",
          })}
        </p>
      </Modal>
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}

function UserFields({ values, onChange, create = false, t }) {
  const fields = [
    ["username", t("profile.username")],
    ["first_name", t("profile.nickname")],
    ["email", t("profile.email")],
  ];
  return (
    <div className="managed-user-form">
      {fields.map(([field, label]) => (
        <label key={field}>
          <span>{label}</span>
          <input
            className="input-control"
            type={field === "email" ? "email" : "text"}
            value={values[field] ?? ""}
            disabled={!create && field === "username"}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </label>
      ))}
      {create && (
        <label>
          <span>{t("field.password")}</span>
          <input
            className="input-control"
            type="password"
            value={values.password}
            onChange={(event) => onChange("password", event.target.value)}
          />
        </label>
      )}
    </div>
  );
}

function EditUserModal({
  open,
  user,
  actor,
  maxVipLevel,
  onOpenChange,
  onSaved,
  onError,
  t,
}) {
  const [values, setValues] = useState(user);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef(null);
  useEffect(() => {
    setValues(user);
    setAvatarFile(null);
    setAvatarPreview("");
  }, [user]);
  useEffect(() => {
    if (!avatarFile) return undefined;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);
  if (!user || !values) return null;
  const sensitive = actor?.is_superuser && user.id !== actor.id;
  const set = (field, value) =>
    setValues((current) => ({ ...current, [field]: value }));
  const shownAvatar = values.remove_avatar
    ? ""
    : avatarPreview || values.avatar_url;
  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    set("remove_avatar", false);
    event.target.value = "";
  }
  function removeAvatar() {
    setAvatarFile(null);
    set("remove_avatar", true);
  }
  function undoAvatarRemoval() {
    set("remove_avatar", false);
  }
  async function save() {
    setSaving(true);
    try {
      if (sensitive && Number(values.vip_level || 0) > maxVipLevel) {
        throw new Error(
          t("admin.users.vipLevelOutOfRange", { max: maxVipLevel }),
        );
      }
      const saved = await api.manage.updateUser(user.id, values, avatarFile);
      let updatedUser = saved;
      if (sensitive) {
        updatedUser = await api.manage.updateUserRole(user.id, {
          is_staff: values.is_staff,
          is_superuser: values.is_superuser,
          vip_level: Number(values.vip_level || 0),
        });
        updatedUser = await api.manage.adjustUserBalances(user.id, {
          money_balance: Number(values.money_balance || 0),
          points_balance: Number(values.points_balance || 0),
          reason: values.reason || "",
        });
        if (values.reset_password)
          await api.manage.resetUserPassword(user.id, {
            new_password: values.reset_password,
          });
      }
      await onSaved(updatedUser, t("admin.users.saved"));
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="table"
      kicker={`@${user.username}`}
      title={t("admin.users.editTitle")}
      actions={[
        {
          key: "cancel",
          label: t("admin.users.cancel"),
          variant: "secondary",
          onClick: ({ close }) => close(),
        },
        {
          key: "save",
          label: t("admin.users.save"),
          variant: "primary",
          loading: saving,
          onClick: save,
        },
      ]}
    >
      <div className="managed-user-editor">
        <section>
          <h3>{t("admin.users.basicInformation")}</h3>
          <div className="managed-user-avatar-editor">
            <button
              type="button"
              className="managed-user-avatar-trigger"
              onClick={() => avatarInputRef.current?.click()}
              aria-label={t("profile.changeAvatar")}
            >
              {shownAvatar ? (
                <img
                  className="managed-user-avatar-large"
                  src={shownAvatar}
                  alt=""
                />
              ) : (
                <span className="managed-user-avatar-large managed-user-avatar--fallback">
                  {(values.first_name || values.username || "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={chooseAvatar}
            />
            <div>
              <div className="managed-user-avatar-actions">
                {shownAvatar && (
                  <button
                    type="button"
                    className="text-button text-button--danger"
                    onClick={removeAvatar}
                  >
                    {t("profile.removeAvatar")}
                  </button>
                )}
                {values.remove_avatar && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={undoAvatarRemoval}
                  >
                    {t("profile.undoRemove")}
                  </button>
                )}
              </div>
              <small>{t("profile.avatarHelp")}</small>
            </div>
          </div>
          <UserFields values={values} onChange={set} t={t} />
          <label className="managed-user-toggle">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(event) => set("is_active", event.target.checked)}
            />
            {t("admin.users.active")}
          </label>
        </section>
        <section>
          <h3>{t("admin.users.socialInformation")}</h3>
          <div className="managed-user-grid">
            <label>
              <span>{t("profile.gender")}</span>
              <select
                value={values.gender || ""}
                onChange={(event) => set("gender", event.target.value)}
              >
                <option value="">
                  {t("profile.genderOptions.unspecified")}
                </option>
                <option value="male">{t("profile.genderOptions.male")}</option>
                <option value="female">
                  {t("profile.genderOptions.female")}
                </option>
                <option value="other">
                  {t("profile.genderOptions.other")}
                </option>
              </select>
            </label>
            <label>
              <span>{t("profile.age")}</span>
              <input
                className="input-control"
                type="number"
                min="1"
                max="150"
                value={values.age ?? ""}
                onChange={(event) =>
                  set(
                    "age",
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              />
            </label>
          </div>
          <label>
            <span>{t("profile.descriptionLabel")}</span>
            <textarea
              rows="3"
              maxLength="500"
              value={values.description || ""}
              onChange={(event) => set("description", event.target.value)}
            />
          </label>
          <div className="managed-user-grid">
            {["github", "website", "twitter", "qq"].map((field) => (
              <label key={field}>
                <span>{t(`profile.${field}`)}</span>
                <input
                  className="input-control"
                  type={field === "qq" ? "text" : "url"}
                  value={values[field] || ""}
                  onChange={(event) => set(field, event.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
        {sensitive && (
          <section>
            <h3>{t("admin.users.identity")}</h3>
            <div className="managed-user-permissions">
              <label>
                <input
                  type="checkbox"
                  checked={values.is_staff}
                  onChange={(event) => set("is_staff", event.target.checked)}
                />
                <span>{t("admin.users.staff")}</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={values.is_superuser}
                  onChange={(event) =>
                    set("is_superuser", event.target.checked)
                  }
                />
                <span>{t("admin.users.superuser")}</span>
              </label>
              <label>
                <span>{t("admin.users.vipLevel")}</span>
                <input
                  className="input-control"
                  type="number"
                  min="0"
                  max={maxVipLevel}
                  value={values.vip_level || 0}
                  onChange={(event) => set("vip_level", event.target.value)}
                />
              </label>
            </div>
          </section>
        )}
        {sensitive && (
          <section>
            <h3>{t("admin.users.balances")}</h3>
            <label>
              <span>{t("admin.users.moneyBalance")}</span>
              <input
                className="input-control"
                type="number"
                min="0"
                value={values.money_balance ?? 0}
                onChange={(event) => set("money_balance", event.target.value)}
              />
            </label>
            <label>
              <span>{t("admin.users.pointsBalance")}</span>
              <input
                className="input-control"
                type="number"
                min="0"
                value={values.points_balance ?? 0}
                onChange={(event) => set("points_balance", event.target.value)}
              />
            </label>
            <label>
              <span>{t("admin.users.adjustReason")}</span>
              <input
                className="input-control"
                maxLength="255"
                value={values.reason || ""}
                onChange={(event) => set("reason", event.target.value)}
              />
            </label>
          </section>
        )}
        {sensitive && (
          <section>
            <h3>{t("admin.users.passwordReset")}</h3>
            <label>
              <span>{t("admin.users.newPassword")}</span>
              <input
                className="input-control"
                type="password"
                value={values.reset_password || ""}
                onChange={(event) => set("reset_password", event.target.value)}
                placeholder={t("admin.users.newPassword")}
              />
            </label>
          </section>
        )}
      </div>
    </Modal>
  );
}
