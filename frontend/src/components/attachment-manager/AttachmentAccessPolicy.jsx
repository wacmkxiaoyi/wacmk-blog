import { Tooltip } from "../../packages/tooltip";
import "./AttachmentAccessPolicy.css";

function label(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}

export function hasValidAccessPolicy(policy) {
  if (policy.visibility === "conditional" && !policy.condition_rules?.length)
    return false;
  return (
    policy.access_scope !== "standalone" ||
    policy.vip_access_permission !== "conditional" ||
    Boolean(policy.vip_condition_rules?.length)
  );
}

function ConditionEditor({ t, title, rules, onChange, allowBookOnly }) {
  function set(type, value) {
    const next = rules.filter((rule) => rule.type !== type);
    if (value !== "") {
      const rule = { type };
      if (type !== "book_only")
        rule.value =
          type === "money" || type === "points" ? Number(value) : value;
      next.push(rule);
    }
    onChange(next);
  }
  const value = (type) => rules.find((rule) => rule.type === type)?.value || "";
  const hasStoredPassword = rules.some(
    (rule) => rule.type === "encrypted" && !rule.value,
  );
  const passwordHint = label(
    t,
    "contentTemplate.editor.passwordHint",
    "A password is already set. Leave this blank to keep it, or enter a new password to replace it.",
  );
  return (
    <fieldset className="attachment-policy__conditions">
      <legend>{title}</legend>
      <label>
        {label(t, "contentTemplate.editor.money", "Money")}
        <input
          type="number"
          min="1"
          value={value("money")}
          onChange={(event) => set("money", event.target.value)}
        />
      </label>
      <label>
        {label(t, "contentTemplate.editor.points", "Points")}
        <input
          type="number"
          min="1"
          value={value("points")}
          onChange={(event) => set("points", event.target.value)}
        />
      </label>
      <label>
        <span className="attachment-policy__password-label">
          {label(t, "contentTemplate.editor.password", "Password")}
          {hasStoredPassword ? (
            <Tooltip content={<span>{passwordHint}</span>}>
              <span
                className="attachment-policy__help-trigger"
                tabIndex={0}
                role="img"
                aria-label={passwordHint}
              >
                ?
              </span>
            </Tooltip>
          ) : null}
        </span>
        <input
          type="password"
          value={value("encrypted")}
          onChange={(event) => set("encrypted", event.target.value)}
        />
      </label>
      {allowBookOnly ? (
        <label className="attachment-policy__flag">
          <input
            type="checkbox"
            checked={rules.some((rule) => rule.type === "book_only")}
            onChange={(event) =>
              set("book_only", event.target.checked ? true : "")
            }
          />
          {label(t, "resourceAccess.conditions.book_only", "Book context only")}
        </label>
      ) : null}
    </fieldset>
  );
}

export default function AttachmentAccessPolicy({
  t,
  value,
  onChange,
  allowBookOnly = false,
  vipPermissionLabel,
}) {
  const policy = {
    visibility: value?.visibility || "public",
    condition_rules: Array.isArray(value?.condition_rules)
      ? value.condition_rules
      : [],
    access_scope: value?.access_scope || "unified",
    vip_access_permission: value?.vip_access_permission || "public",
    vip_condition_rules: Array.isArray(value?.vip_condition_rules)
      ? value.vip_condition_rules
      : [],
  };
  function update(field, nextValue) {
    onChange({ ...policy, [field]: nextValue });
  }
  function updateVisibility(nextVisibility) {
    onChange({
      ...policy,
      visibility: nextVisibility,
      ...(nextVisibility === "conditional" ? {} : { condition_rules: [] }),
      ...(nextVisibility === "public"
        ? {
            access_scope: "unified",
            vip_access_permission: "public",
            vip_condition_rules: [],
          }
        : {}),
    });
  }
  function updateScope(nextScope) {
    onChange({
      ...policy,
      access_scope: nextScope,
      ...(nextScope === "unified"
        ? { vip_access_permission: "public", vip_condition_rules: [] }
        : {}),
    });
  }
  function updateVipVisibility(nextVisibility) {
    onChange({
      ...policy,
      vip_access_permission: nextVisibility,
      ...(nextVisibility === "conditional" ? {} : { vip_condition_rules: [] }),
    });
  }
  // Public attachments always inherit their content context; standalone access is inapplicable.
  const showScope = policy.visibility !== "public";
  return (
    <div className="attachment-policy">
      <fieldset className="attachment-policy__access">
        <legend>
          {label(t, "contentTemplate.editor.accessSettings", "Access settings")}
        </legend>
        <label>
          {label(t, "contentTemplate.editor.visibility", "Visibility")}
          <select
            value={policy.visibility}
            onChange={(event) => updateVisibility(event.target.value)}
          >
            <option value="public">
              {label(t, "contentTemplate.editor.public", "Public")}
            </option>
            <option value="private">
              {label(t, "contentTemplate.editor.private", "Private")}
            </option>
            <option value="conditional">
              {label(t, "contentTemplate.editor.conditional", "Conditional")}
            </option>
          </select>
        </label>
        {showScope ? (
          <label className="attachment-policy__flag">
            <input
              type="checkbox"
              checked={policy.access_scope === "unified"}
              onChange={(event) =>
                updateScope(event.target.checked ? "unified" : "standalone")
              }
            />
            {label(
              t,
              "contentTemplate.editor.vipSameAuthorization",
              "VIP same authorization",
            )}
          </label>
        ) : null}
      </fieldset>
      {policy.visibility === "conditional" ? (
        <ConditionEditor
          t={t}
          title={label(t, "contentTemplate.editor.conditions", "Conditions")}
          rules={policy.condition_rules}
          onChange={(rules) => update("condition_rules", rules)}
          allowBookOnly={allowBookOnly}
        />
      ) : null}
      {showScope && policy.access_scope === "standalone" ? (
        <>
          <fieldset className="attachment-policy__access">
            <legend>
              {label(t, "contentTemplate.editor.vipAccess", "VIP access")}
            </legend>
            <label>
              {vipPermissionLabel ||
                label(t, "contentTemplate.editor.visibility", "Visibility")}
              <select
                value={policy.vip_access_permission}
                onChange={(event) => updateVipVisibility(event.target.value)}
              >
                <option value="public">
                  {label(t, "contentTemplate.editor.public", "Public")}
                </option>
                <option value="private">
                  {label(t, "contentTemplate.editor.private", "Private")}
                </option>
                <option value="conditional">
                  {label(
                    t,
                    "contentTemplate.editor.conditional",
                    "Conditional",
                  )}
                </option>
              </select>
            </label>
          </fieldset>
          {policy.vip_access_permission === "conditional" ? (
            <ConditionEditor
              t={t}
              title={label(
                t,
                "contentTemplate.editor.conditions",
                "Conditions",
              )}
              rules={policy.vip_condition_rules}
              onChange={(rules) => update("vip_condition_rules", rules)}
              allowBookOnly={allowBookOnly}
            />
          ) : null}
        </>
      ) : null}
      {!hasValidAccessPolicy(policy) ? (
        <p className="attachment-policy__error" role="alert">
          {label(
            t,
            "contentTemplate.editor.conditionRequired",
            "Add at least one condition for each conditional access setting.",
          )}
        </p>
      ) : null}
    </div>
  );
}
