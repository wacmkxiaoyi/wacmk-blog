import { Modal } from "../../packages/modal";
import { externalLinkUrl } from "../../utils/externalLinkUrl";
import PasswordInput from "../ui/PasswordInput";

export default function ArticleExternalLinkEditor({
  link,
  expiry,
  password,
  pending,
  t,
  prefix = "admin.articles",
  onExpiryChange,
  onPasswordChange,
  onSave,
  onRemove,
  onCopy,
  onOpenChange,
}) {
  const removing = link?.remove;
  const editing = Boolean(link?.url);

  return (
    <Modal
      open={Boolean(link)}
      onOpenChange={onOpenChange}
      kicker={t(`${prefix}.externalLinksTitle`)}
      title={
        removing ? t(`${prefix}.removeExternalLinkTitle`) : t(`${prefix}.share`)
      }
      actions={
        removing
          ? [
              {
                key: "cancel",
                label: t(`${prefix}.cancel`),
                variant: "secondary",
                onClick: ({ close }) => close(),
              },
              {
                key: "remove",
                label: t(`${prefix}.removeExternalLink`),
                variant: "danger",
                loading: pending,
                onClick: onRemove,
              },
            ]
          : [
              {
                key: "cancel",
                label: t(`${prefix}.cancel`),
                variant: "secondary",
                onClick: ({ close }) => close(),
              },
              {
                key: "save",
                label: t(
                  `${prefix}.${editing ? "updateExternalLink" : "createExternalLink"}`,
                ),
                loading: pending,
                keepOpen: true,
                onClick: onSave,
              },
            ]
      }
    >
      {removing ? (
        <p>
          {t(`${prefix}.removeExternalLinkDescription`, { title: link.title })}
        </p>
      ) : (
        <div className="managed-article-link-editor">
          <label className="managed-article-link-expiry">
            <span>{t(`${prefix}.externalLinkExpiry`)}</span>
            <select
              value={expiry}
              onChange={(event) => onExpiryChange(event.target.value)}
            >
              <option value="1d">{t(`${prefix}.expiry.oneDay`)}</option>
              <option value="7d">{t(`${prefix}.expiry.sevenDays`)}</option>
              <option value="30d">{t(`${prefix}.expiry.thirtyDays`)}</option>
              <option value="never">{t(`${prefix}.neverExpires`)}</option>
            </select>
          </label>
          <PasswordInput
            label={t(`${prefix}.externalLinkPassword`)}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="new-password"
          />
          {link?.url ? (
            <label className="managed-article-link-url">
              <span>{t(`${prefix}.externalLinkUrl`)}</span>
              <div>
                <input
                  value={externalLinkUrl(link.url)}
                  readOnly
                  aria-label={t(`${prefix}.externalLinkUrl`)}
                />
                <button type="button" onClick={onCopy}>
                  {t(`${prefix}.copyExternalLink`)}
                </button>
              </div>
            </label>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
