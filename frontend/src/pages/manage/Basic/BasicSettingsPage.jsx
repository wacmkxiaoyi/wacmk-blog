import { useEffect, useId, useRef, useState } from "react";
import useI18n from "../../../hooks/useI18n";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import { Modal } from "../../../packages/modal";
import { Tooltip } from "../../../packages/tooltip";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import ManageSidebar from "../ManageSidebar";
import api from "../../../api";
import "./BasicSettingsPage.css";

const providers = [
  "openai",
  "anthropic",
  "gemini",
  "azure_openai",
  "deepseek",
  "qwen",
  "moonshot",
  "ollama",
  "host_vllm",
];
const vipFields = [
  "display_name",
  "money_discount",
  "points_discount",
  "money_reward",
  "points_reward",
  "daily_login_bonus_money",
  "daily_login_bonus_points",
  "first_comment_bonus_money",
  "first_comment_bonus_points",
  "storage_capacity_mb",
];
function defaultVipConfig(level) {
  return {
    display_name: `VIP ${level}`,
    money_discount: `${Math.min(level * 0.1, 1).toFixed(2)}`,
    points_discount: `${Math.min(level * 0.05, 1).toFixed(2)}`,
    money_reward: `${Math.min(level * 0.1, 1).toFixed(2)}`,
    points_reward: `${Math.min(level * 0.05, 1).toFixed(2)}`,
    daily_login_bonus_money: level * 5,
    daily_login_bonus_points: level * 5,
    first_comment_bonus_money: level * 2,
    first_comment_bonus_points: level * 2,
    storage_capacity_mb: level * 1024,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
function Section({ title, children }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}
function HelpTooltip({ content }) {
  if (!content) return null;
  return (
    <Tooltip content={<span>{content}</span>}>
      <span
        className="settings-help-trigger"
        tabIndex={0}
        role="img"
        aria-label={content}
      >
        ?
      </span>
    </Tooltip>
  );
}
function Field({ label, help, tooltip, children }) {
  return (
    <label className="settings-field">
      <span className="settings-field__label">
        {label}
        <HelpTooltip content={tooltip} />
        {help && <small>{help}</small>}
      </span>
      {children}
    </label>
  );
}
function Accordion({ title, open, onToggle, children }) {
  return (
    <section className="settings-accordion">
      <button type="button" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span aria-hidden="true">{open ? "-" : "+"}</span>
      </button>
      {open && <div className="settings-accordion__body">{children}</div>}
    </section>
  );
}
function Toggle({ label, tooltip, checked, onChange }) {
  const id = useId();
  return (
    <div className="settings-toggle">
      <label htmlFor={id}>
        {label}
        <HelpTooltip content={tooltip} />
      </label>
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function AssetField({ field, title, tooltip, assets, onChange, errorText, t }) {
  const [preview, setPreview] = useState(assets[field]);
  const [pending, setPending] = useState(false);
  const inputRef = useRef(null);
  const savedAssetRef = useRef(assets[field]);
  useEffect(() => setPreview(assets[field]), [assets, field]);
  useEffect(() => {
    if (assets[field]) savedAssetRef.current = assets[field];
  }, [assets, field]);
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setPending(true);
    try {
      onChange(await api.manage.uploadBasicAsset(field, file));
    } catch (error) {
      setPreview(assets[field]);
      errorText(error);
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPending(false);
    }
  }
  function remove() {
    setPreview("");
    onChange({ ...assets, [field]: "" });
    if (inputRef.current) inputRef.current.value = "";
  }
  function undo() {
    const restored = savedAssetRef.current;
    setPreview(restored);
    onChange({ ...assets, [field]: restored });
  }
  return (
    <div className="asset-field">
      <strong>
        {title}
        <HelpTooltip content={tooltip} />
      </strong>
      {preview ? (
        <div className="asset-field__preview">
          <img
            src={preview}
            alt=""
            className={
              field === "site_icon" ? "asset-field__icon" : "asset-field__image"
            }
          />
          <button
            type="button"
            className="text-button text-button--danger"
            disabled={pending}
            onClick={remove}
          >
            {t("admin.basic.remove")}
          </button>
        </div>
      ) : (
        <div className="asset-field__picker">
          <label className="asset-field__choose">
            <input
              ref={inputRef}
              type="file"
              disabled={pending}
              accept="image/png,image/jpeg,image/gif,image/webp,image/x-icon"
              onChange={upload}
            />
            <span>
              {pending
                ? t("admin.basic.uploading")
                : t("admin.basic.chooseFile")}
            </span>
          </label>
          {savedAssetRef.current && (
            <button type="button" className="text-button" onClick={undo}>
              {t("admin.basic.undoRemove")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BundleField({ field, tooltip, live2d, onChange, errorText, t }) {
  const [pending, setPending] = useState(false);
  const inputRef = useRef(null);
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setPending(true);
    try {
      onChange(await api.manage.uploadLive2DBundle(field, file));
    } catch (error) {
      errorText(error);
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    setPending(true);
    try {
      onChange(await api.manage.removeLive2DBundle(field));
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      errorText(error);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="asset-field">
      <strong>
        {t(`admin.basic.live2d.${field}`)}
        <HelpTooltip content={tooltip} />
      </strong>
      {live2d[field] && (
        <div className="asset-field__preview">
          <a href={live2d[field]} target="_blank" rel="noreferrer">
            {t("admin.basic.live2d.uploaded")}
          </a>
          <button
            type="button"
            className="text-button text-button--danger"
            disabled={pending}
            onClick={remove}
          >
            {t("admin.basic.remove")}
          </button>
        </div>
      )}
      <div className="asset-field__picker">
        <label className="asset-field__choose">
          <input
            ref={inputRef}
            type="file"
            disabled={pending}
            accept=".zip,application/zip"
            onChange={upload}
          />
          <span>
            {pending
              ? t("admin.basic.uploading")
              : live2d[field]
                ? t("admin.basic.replace")
                : t("admin.basic.chooseFile")}
          </span>
        </label>
      </div>
    </div>
  );
}

export default function BasicSettingsPage() {
  const { t } = useI18n();
  const { refresh: refreshRuntime } = useSiteRuntime();
  const [values, setValues] = useState(null);
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [open, setOpen] = useState({});
  const message = (error) =>
    error.response?.data?.detail ||
    Object.values(error.response?.data?.values || {})
      .flat(3)
      .join(" ") ||
    t("admin.basic.saveFailed");
  useEffect(() => {
    api.manage
      .getBasicSettings()
      .then((data) => {
        setValues(data);
        setInitial(clone(data));
      })
      .catch((error) => setNotice({ type: "error", message: message(error) }));
  }, []);
  useEffect(() => {
    if (
      !values ||
      !initial ||
      JSON.stringify(values) === JSON.stringify(initial)
    )
      return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [values, initial]);
  if (!values)
    return <main className="manage-loading">{t("admin.basic.loading")}</main>;
  const update = (key, patch) =>
    setValues((current) => ({
      ...current,
      [key]: typeof patch === "function" ? patch(current[key]) : patch,
    }));
  const field = (key, name, value) =>
    update(key, (current) => ({ ...current, [name]: value }));
  const help = (key) => t(`admin.basic.help.${key}`);
  const toggleAccordion = (key) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));
  const assets = values["basic.assets"];
  const live2d = values["basic.live2d"];
  const contentConfig = [
    [
      "article",
      "content.article",
      "allow_non_admin_create",
      "createPost",
      true,
    ],
    ["book", "content.book", "allow_non_admin_create", "createBook", false],
    [
      "attachment",
      "upload.attachment",
      "allow_user_upload",
      "uploadAttachment",
      false,
    ],
    ["video", "upload.video", "allow_user_upload", "uploadVideo", false],
    ["comment", "comment", "allow_user_comment", "createComment", false],
  ];
  async function save() {
    setSaving(true);
    try {
      const saved = await api.manage.saveBasicSettings(values);
      setValues(saved);
      setInitial(clone(saved));
      await refreshRuntime({ broadcast: true });
      setNotice({ type: "success", message: t("admin.basic.saved") });
    } catch (error) {
      setNotice({ type: "error", message: message(error) });
    } finally {
      setSaving(false);
    }
  }
  async function reset() {
    try {
      const saved = await api.manage.resetBasicSettings();
      setValues(saved);
      setInitial(clone(saved));
      await refreshRuntime({ broadcast: true });
      setResetOpen(false);
      setNotice({ type: "success", message: t("admin.basic.resetComplete") });
    } catch (error) {
      setNotice({ type: "error", message: message(error) });
    }
  }
  return (
    <main className="manage-page">
      <ManageSidebar active="basic" />
      <section className="manage-content">
        <div className="settings-shell">
          <header className="settings-heading">
            <span>{t("admin.basic.website")}</span>
            <h1>{t("admin.basic.title")}</h1>
            <p>{t("admin.basic.description")}</p>
          </header>
          <Section title={t("admin.basic.site.section")}>
            <div className="settings-grid">
              <Field
                label={t("admin.basic.site.name")}
                help={t("admin.basic.site.help")}
              >
                <Input
                  value={values["basic.site"].title}
                  maxLength="120"
                  onChange={(e) => field("basic.site", "title", e.target.value)}
                />
              </Field>
              <Field
                label={t("admin.basic.site.trendDays")}
                tooltip={help("site.trendDays")}
              >
                <Select
                  value={values["basic.site"].dashboard_visit_trend_days}
                  onChange={(v) =>
                    field("basic.site", "dashboard_visit_trend_days", Number(v))
                  }
                  options={[
                    [7, t("admin.basic.site.days", { days: 7 })],
                    [14, t("admin.basic.site.days", { days: 14 })],
                    [30, t("admin.basic.site.days", { days: 30 })],
                  ]}
                />
              </Field>
            </div>
          </Section>
          <Section title={t("admin.basic.assets.section")}>
            <AssetField
              field="site_icon"
              title={t("admin.basic.assets.icon")}
              tooltip={help("assets.icon")}
              assets={assets}
              onChange={(next) => update("basic.assets", next)}
              errorText={(error) =>
                setNotice({ type: "error", message: message(error) })
              }
              t={t}
            />
            <AssetField
              field="auth_background"
              title={t("admin.basic.assets.authBackground")}
              tooltip={help("assets.authBackground")}
              assets={assets}
              onChange={(next) => update("basic.assets", next)}
              errorText={(error) =>
                setNotice({ type: "error", message: message(error) })
              }
              t={t}
            />
            <AssetField
              field="app_background"
              title={t("admin.basic.assets.appBackground")}
              tooltip={help("assets.appBackground")}
              assets={assets}
              onChange={(next) => update("basic.assets", next)}
              errorText={(error) =>
                setNotice({ type: "error", message: message(error) })
              }
              t={t}
            />
            {/* Temporarily hidden until Live2D assistant support is needed again. */}
            <div hidden>
              <Toggle
                label={t("admin.basic.live2d.enabled")}
                tooltip={help("live2d.enabled")}
                checked={live2d.enabled}
                onChange={(enabled) => field("basic.live2d", "enabled", enabled)}
              />
              {live2d.enabled && (
                <div className="settings-subgroup">
                <Field
                  label={t("admin.basic.live2d.source")}
                  tooltip={help("live2d.source")}
                >
                  <Select
                    value={live2d.source_type}
                    onChange={(source_type) =>
                      field("basic.live2d", "source_type", source_type)
                    }
                    options={[
                      ["cdn", t("admin.basic.live2d.cdn")],
                      ["widget_bundle", t("admin.basic.live2d.widget_bundle")],
                      ["cubism_bundle", t("admin.basic.live2d.cubism_bundle")],
                    ]}
                  />
                </Field>
                {live2d.source_type !== "cdn" && (
                  <BundleField
                    field={live2d.source_type}
                    tooltip={help(`live2d.${live2d.source_type}`)}
                    live2d={live2d}
                    onChange={(next) => update("basic.live2d", next)}
                    errorText={(error) =>
                      setNotice({ type: "error", message: message(error) })
                    }
                    t={t}
                  />
                )}
                {live2d.source_type === "cdn" && (
                  <Accordion
                    title={t("admin.basic.live2d.cdnConfig")}
                    open={open.cdn}
                    onToggle={() => toggleAccordion("cdn")}
                  >
                    <Field
                      label={t("admin.basic.live2d.autoload")}
                      tooltip={help("live2d.autoload")}
                    >
                      <Input
                        value={live2d.cdn_autoload_url}
                        onChange={(e) =>
                          field(
                            "basic.live2d",
                            "cdn_autoload_url",
                            e.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field
                      label={t("admin.basic.live2d.assetBase")}
                      tooltip={help("live2d.assetBase")}
                    >
                      <Input
                        value={live2d.cdn_assets_base}
                        onChange={(e) =>
                          field(
                            "basic.live2d",
                            "cdn_assets_base",
                            e.target.value,
                          )
                        }
                      />
                    </Field>
                    <Field
                      label={t("admin.basic.live2d.tipsUrl")}
                      tooltip={help("live2d.tipsUrl")}
                    >
                      <Input
                        value={live2d.cdn_waifu_path}
                        onChange={(e) =>
                          field(
                            "basic.live2d",
                            "cdn_waifu_path",
                            e.target.value,
                          )
                        }
                      />
                    </Field>
                  </Accordion>
                )}
                <Toggle
                  label={t("admin.basic.live2d.random")}
                  tooltip={help("live2d.random")}
                  checked={live2d.random_model}
                  onChange={(random_model) =>
                    field("basic.live2d", "random_model", random_model)
                  }
                />
                {!live2d.random_model && (
                  <Field
                    label={t("admin.basic.live2d.modelId")}
                    tooltip={help("live2d.modelId")}
                  >
                    <Input
                      type="number"
                      min="0"
                      value={live2d.model_id}
                      onChange={(e) =>
                        field(
                          "basic.live2d",
                          "model_id",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                )}
                <Accordion
                  title={t("admin.basic.live2d.displayPages")}
                  open={open.pages}
                  onToggle={() => toggleAccordion("pages")}
                >
                  {Object.entries(live2d.show_on).map(([key, value]) => (
                    <Toggle
                      key={key}
                      label={t(`admin.basic.live2d.pages.${key}`)}
                      checked={value}
                      onChange={(checked) =>
                        update("basic.live2d", (v) => ({
                          ...v,
                          show_on: { ...v.show_on, [key]: checked },
                        }))
                      }
                    />
                  ))}
                </Accordion>
                <Accordion
                  title={t("admin.basic.live2d.tips")}
                  open={open.tips}
                  onToggle={() => toggleAccordion("tips")}
                >
                  <Toggle
                    label={t("admin.basic.live2d.tipsEnabled")}
                    tooltip={help("live2d.tipsEnabled")}
                    checked={live2d.tips.enabled}
                    onChange={(enabled) =>
                      update("basic.live2d", (v) => ({
                        ...v,
                        tips: { ...v.tips, enabled },
                      }))
                    }
                  />
                  {live2d.tips.enabled && (
                    <>
                      <Field
                        label={t("admin.basic.live2d.tipsMode")}
                        tooltip={help("live2d.tipsMode")}
                      >
                        <Select
                          value={live2d.tips.mode}
                          onChange={(mode) =>
                            update("basic.live2d", (v) => ({
                              ...v,
                              tips: { ...v.tips, mode },
                            }))
                          }
                          options={[
                            ["builtin", t("admin.basic.live2d.builtin")],
                            ["custom", t("admin.basic.live2d.custom")],
                            ["hybrid", t("admin.basic.live2d.hybrid")],
                          ]}
                        />
                      </Field>
                      {live2d.tips.mode !== "builtin" &&
                        [
                          "welcome_text",
                          "idle_text",
                          "touch_text",
                          "home_text",
                          "article_text",
                          "book_text",
                          "profile_text",
                          "rules_json",
                        ].map((name) => (
                          <Field
                            key={name}
                            label={t(`admin.basic.live2d.fields.${name}`)}
                            tooltip={help(`live2d.${name}`)}
                          >
                            <textarea
                              rows={name === "rules_json" ? 8 : 3}
                              value={live2d.tips[name]}
                              onChange={(e) =>
                                update("basic.live2d", (v) => ({
                                  ...v,
                                  tips: { ...v.tips, [name]: e.target.value },
                                }))
                              }
                            />
                          </Field>
                        ))}
                    </>
                  )}
                </Accordion>
                <Accordion
                  title={t("admin.basic.live2d.ai")}
                  open={open.ai}
                  onToggle={() => toggleAccordion("ai")}
                >
                  <Toggle
                    label={t("admin.basic.live2d.aiEnabled")}
                    tooltip={help("live2d.aiEnabled")}
                    checked={live2d.ai.enabled}
                    onChange={(enabled) =>
                      update("basic.live2d", (v) => ({
                        ...v,
                        ai: { ...v.ai, enabled },
                      }))
                    }
                  />
                  {live2d.ai.enabled && (
                    <>
                      <Toggle
                        label={t("admin.basic.live2d.aiVip")}
                        tooltip={help("live2d.aiVip")}
                        checked={live2d.ai.vip_only}
                        onChange={(vip_only) =>
                          update("basic.live2d", (v) => ({
                            ...v,
                            ai: {
                              ...v.ai,
                              vip_only,
                              allow_anonymous: vip_only
                                ? false
                                : v.ai.allow_anonymous,
                            },
                          }))
                        }
                      />
                      {!live2d.ai.vip_only && (
                        <Toggle
                          label={t("admin.basic.live2d.aiAnonymous")}
                          tooltip={help("live2d.aiAnonymous")}
                          checked={live2d.ai.allow_anonymous}
                          onChange={(allow_anonymous) =>
                            update("basic.live2d", (v) => ({
                              ...v,
                              ai: { ...v.ai, allow_anonymous },
                            }))
                          }
                        />
                      )}
                      <Field
                        label={t("admin.basic.live2d.provider")}
                        tooltip={help("live2d.provider")}
                      >
                        <Select
                          value={live2d.ai.provider}
                          onChange={(provider) =>
                            update("basic.live2d", (v) => ({
                              ...v,
                              ai: { ...v.ai, provider },
                            }))
                          }
                          options={providers.map((provider) => [
                            provider,
                            provider,
                          ])}
                        />
                      </Field>
                      {["endpoint", "api_key", "model", "system_prompt"].map(
                        (name) => (
                          <Field
                            key={name}
                            label={t(`admin.basic.live2d.fields.${name}`)}
                            tooltip={help(`live2d.${name}`)}
                          >
                            {name === "system_prompt" ? (
                              <textarea
                                rows="4"
                                value={live2d.ai[name]}
                                onChange={(e) =>
                                  update("basic.live2d", (v) => ({
                                    ...v,
                                    ai: { ...v.ai, [name]: e.target.value },
                                  }))
                                }
                              />
                            ) : (
                              <Input
                                type={name === "api_key" ? "password" : "text"}
                                value={live2d.ai[name]}
                                onChange={(e) =>
                                  update("basic.live2d", (v) => ({
                                    ...v,
                                    ai: { ...v.ai, [name]: e.target.value },
                                  }))
                                }
                              />
                            )}
                          </Field>
                        ),
                      )}
                    </>
                  )}
                </Accordion>
                </div>
              )}
            </div>
          </Section>
          <Section title={t("admin.basic.user.section")}>
            <Toggle
              label={t("admin.basic.user.registration")}
              tooltip={help("user.registration")}
              checked={values.registration.enable_register}
              onChange={(value) =>
                field("registration", "enable_register", value)
              }
            />
            <div className="settings-grid">
              {[
                ["code_expire_seconds", 60, 3600],
                ["code_resend_seconds", 10, 600],
              ].map(([name, min, max]) => (
                <Field
                  key={name}
                  label={t(`admin.basic.user.${name}`)}
                  tooltip={help(`user.${name}`)}
                >
                  <Input
                    type="number"
                    min={min}
                    max={max}
                    value={values.registration[name]}
                    onChange={(e) =>
                      field("registration", name, Number(e.target.value))
                    }
                  />
                </Field>
              ))}
              {[
                "daily_login_reward_money",
                "daily_login_reward_points",
                "storage_capacity_mb",
              ].map((name) => (
                <Field
                  key={name}
                  label={t(`admin.basic.user.${name}`)}
                  tooltip={help(`user.${name}`)}
                >
                  <Input
                    type="number"
                    min="0"
                    value={values["user.rewards"][name]}
                    onChange={(e) =>
                      field("user.rewards", name, Number(e.target.value))
                    }
                  />
                </Field>
              ))}
            </div>
          </Section>
          <Section title={t("admin.basic.vip.section")}>
            <Field
              label={t("admin.basic.vip.maxLevel")}
              tooltip={help("vip.maxLevel")}
            >
              <Input
                type="number"
                min="0"
                max="20"
                value={values.vip.vip_max_level}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  update("vip", (v) => ({
                    vip_max_level: count,
                    vip_configs: Array.from(
                      { length: count },
                      (_, index) =>
                        v.vip_configs[index] || defaultVipConfig(index + 1),
                    ),
                  }));
                }}
              />
            </Field>
            {values.vip.vip_configs.map((config, index) => (
              <Accordion
                key={index}
                title={config.display_name || `VIP ${index + 1}`}
                open={open[`vip${index}`]}
                onToggle={() => toggleAccordion(`vip${index}`)}
              >
                {vipFields.map((name) => (
                  <Field
                    key={name}
                    label={t(`admin.basic.vip.fields.${name}`)}
                    tooltip={help(`vip.${name}`)}
                  >
                    <Input
                      type={
                        typeof config[name] === "number" ? "number" : "text"
                      }
                      min="0"
                      value={config[name]}
                      onChange={(e) =>
                        update("vip", (v) => ({
                          ...v,
                          vip_configs: v.vip_configs.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  [name]:
                                    typeof config[name] === "number"
                                      ? Number(e.target.value)
                                      : e.target.value,
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                  </Field>
                ))}
              </Accordion>
            ))}
          </Section>
          {contentConfig.map(([title, key, enabledKey, action, autosave]) => {
            const value = values[key];
            return (
              <Section key={key} title={t(`admin.basic.content.${title}`)}>
                <Toggle
                  label={t(
                    `admin.basic.content.allow${action[0].toUpperCase()}${action.slice(1)}`,
                  )}
                  tooltip={help(
                    `content.allow${action[0].toUpperCase()}${action.slice(1)}`,
                  )}
                  checked={value[enabledKey]}
                  onChange={(enabled) => field(key, enabledKey, enabled)}
                />
                {value[enabledKey] && (
                  <div className="settings-subgroup">
                    {value.non_admin_max_count !== undefined && (
                      <Field
                        label={t("admin.basic.content.maxCount")}
                        tooltip={help("content.maxCount")}
                      >
                        <Input
                          type="number"
                          min="0"
                          value={value.non_admin_max_count}
                          onChange={(e) =>
                            field(
                              key,
                              "non_admin_max_count",
                              Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                    )}
                    <Toggle
                      label={t(
                        `admin.basic.content.vip${action[0].toUpperCase()}${action.slice(1)}`,
                      )}
                      tooltip={help(
                        `content.vip${action[0].toUpperCase()}${action.slice(1)}`,
                      )}
                      checked={value.vip_only}
                      onChange={(enabled) => field(key, "vip_only", enabled)}
                    />
                    {autosave && (
                      <>
                        <Toggle
                          label={t("admin.basic.content.autosave")}
                          tooltip={help("content.autosave")}
                          checked={value.editor_autosave_enabled}
                          onChange={(enabled) =>
                            field(key, "editor_autosave_enabled", enabled)
                          }
                        />
                        {value.editor_autosave_enabled && (
                          <Field
                            label={t("admin.basic.content.autosaveInterval")}
                            tooltip={help("content.autosaveInterval")}
                          >
                            <Input
                              type="number"
                              min="1"
                              max="60"
                              value={value.editor_autosave_interval_minutes}
                              onChange={(e) =>
                                field(
                                  key,
                                  "editor_autosave_interval_minutes",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </Field>
                        )}
                      </>
                    )}
                    {value.max_size_mb !== undefined && (
                      <Field
                        label={t("admin.basic.content.maxSize")}
                        tooltip={help("content.maxSize")}
                      >
                        <Input
                          type="number"
                          min="1"
                          value={value.max_size_mb}
                          onChange={(e) =>
                            field(key, "max_size_mb", Number(e.target.value))
                          }
                        />
                      </Field>
                    )}
                    {value.author_reward_money_ratio !== undefined && (
                      <div className="settings-grid">
                        <Field
                          label={t("admin.basic.content.moneyRatio")}
                          tooltip={help("content.moneyRatio")}
                        >
                          <Input
                            value={value.author_reward_money_ratio}
                            onChange={(e) =>
                              field(
                                key,
                                "author_reward_money_ratio",
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field
                          label={t("admin.basic.content.pointsRatio")}
                          tooltip={help("content.pointsRatio")}
                        >
                          <Input
                            value={value.author_reward_points_ratio}
                            onChange={(e) =>
                              field(
                                key,
                                "author_reward_points_ratio",
                                e.target.value,
                              )
                            }
                          />
                        </Field>
                      </div>
                    )}
                    {value.first_reward_money !== undefined && (
                      <div className="settings-grid">
                        <Field
                          label={t("admin.basic.content.firstMoney")}
                          tooltip={help("content.firstMoney")}
                        >
                          <Input
                            type="number"
                            min="0"
                            value={value.first_reward_money}
                            onChange={(e) =>
                              field(
                                key,
                                "first_reward_money",
                                Number(e.target.value),
                              )
                            }
                          />
                        </Field>
                        <Field
                          label={t("admin.basic.content.firstPoints")}
                          tooltip={help("content.firstPoints")}
                        >
                          <Input
                            type="number"
                            min="0"
                            value={value.first_reward_points}
                            onChange={(e) =>
                              field(
                                key,
                                "first_reward_points",
                                Number(e.target.value),
                              )
                            }
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </Section>
            );
          })}
          <Section title={t("admin.basic.audit.section")}>
            <Toggle
              label={t("admin.basic.audit.enabled")}
              tooltip={help("audit.enabled")}
              checked={values["system.audit_cleanup"].enabled}
              onChange={(enabled) =>
                field("system.audit_cleanup", "enabled", enabled)
              }
            />
            {values["system.audit_cleanup"].enabled && (
              <Field
                label={t("admin.basic.audit.retention")}
                tooltip={help("audit.retention")}
              >
                <Input
                  type="number"
                  min="1"
                  max="3650"
                  value={values["system.audit_cleanup"].retention_days}
                  onChange={(e) =>
                    field(
                      "system.audit_cleanup",
                      "retention_days",
                      Number(e.target.value),
                    )
                  }
                />
              </Field>
            )}
          </Section>
          <footer className="settings-actions">
            <Button variant="secondary" onClick={() => setResetOpen(true)}>
              {t("admin.basic.restore")}
            </Button>
            <Button
              loading={saving}
              onClick={save}
              disabled={JSON.stringify(values) === JSON.stringify(initial)}
            >
              {t("admin.basic.save")}
            </Button>
          </footer>
        </div>
      </section>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("admin.basic.resetTitle")}
        kicker={t("admin.basic.resetKicker")}
        tone="danger"
        labels={{
          cancel: t("admin.basic.cancel"),
          confirm: t("admin.basic.restore"),
        }}
        actions={[
          {
            key: "cancel",
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          { key: "reset", variant: "danger", onClick: reset },
        ]}
      >
        <p>{t("admin.basic.resetDescription")}</p>
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
