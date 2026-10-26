import { useEffect, useState } from "react";
import useI18n from "../../hooks/useI18n";
import AttachmentAccessPolicy, {
  hasValidAccessPolicy,
} from "./AttachmentAccessPolicy";

function valuesFor(attachment) {
  return {
    title: attachment?.title || "",
    visibility: attachment?.visibility || "public",
    access_scope: attachment?.access_scope || "unified",
    vip_access_permission: attachment?.vip_access_permission || "public",
    condition_rules: attachment?.condition_rules || [],
    vip_condition_rules: attachment?.vip_condition_rules || [],
  };
}

export default function AttachmentEditor({
  attachment,
  onChange,
  onValidityChange,
}) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => valuesFor(attachment));

  useEffect(() => setValues(valuesFor(attachment)), [attachment]);
  useEffect(() => onChange?.(values), [onChange, values]);
  useEffect(
    () => onValidityChange?.(hasValidAccessPolicy(values)),
    [onValidityChange, values],
  );

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="attachment-editor">
      <label>
        <span>{t("attachment.title")}</span>
        <input
          value={values.title || ""}
          maxLength="255"
          onChange={(event) => update("title", event.target.value)}
        />
      </label>
      <AttachmentAccessPolicy
        t={t}
        value={values}
        onChange={(policy) =>
          setValues((current) => ({ ...current, ...policy }))
        }
        allowBookOnly
      />
    </div>
  );
}
