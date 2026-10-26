import React from "react";
import AccessTag from "../access-tag/AccessTag";
import { getResourceAccessChannels } from "../access-tag/resourceAccessTags";
import ResourceAccessAuthorizer from "../resource-access-authorizer/ResourceAccessAuthorizer";
import api from "../../api";
import useI18n from "../../hooks/useI18n";
import "./AttachmentCard.css";

function fileIcon(extension) {
  const ext = String(extension || "").toLowerCase();
  if (["pdf"].includes(ext)) return "PDF";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "ZIP";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  if (["mp3", "wav", "ogg"].includes(ext)) return "AUD";
  if (["mp4", "webm", "mov"].includes(ext)) return "VID";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "IMG";
  return "FILE";
}

export default function AttachmentCard({
  attachment,
  compact = false,
  editable = false,
  showEdit = true,
  onEdit,
  onDownload,
  accessClient = api.resourceAccess,
  accessDecision,
  requestDownload,
  resourceContext,
}) {
  const { t } = useI18n();
  const [resolvedDecision, setResolvedDecision] = React.useState(null);
  const resource = {
    type: "attachment",
    id: attachment.id,
    name: attachment.title,
    context: resourceContext,
  };
  const accessChannels = getResourceAccessChannels(attachment);
  React.useEffect(() => {
    if (editable || accessDecision || !attachment.id) return undefined;
    let active = true;
    accessClient
      .check(resource)
      .then((value) => active && setResolvedDecision(value))
      .catch(() => active && setResolvedDecision(null));
    return () => {
      active = false;
    };
  }, [attachment.id, accessClient, accessDecision, editable, resourceContext]);
  const [downloadError, setDownloadError] = React.useState("");
  const download = ({ authorize }) => (
    <button
      type="button"
      className="attachment-card__download"
      disabled={!requestDownload}
      onClick={async () => {
        if (!requestDownload || !(await authorize())) return;
        try {
          setDownloadError("");
          const { url, expiresAt } = await requestDownload(attachment.assetId);
          onDownload?.({ attachment, url, expiresAt });
          window.location.assign(url);
        } catch (error) {
          setDownloadError(error?.message || t("attachment.downloadFailed"));
        }
      }}
    >
      {t("attachment.download")}
    </button>
  );
  return (
    <article
      className={`attachment-card${compact ? " attachment-card--compact" : ""}${editable ? " attachment-card--editable" : ""}`}
      onClick={editable ? onEdit : undefined}
    >
      <div className="attachment-card__icon">
        {fileIcon(attachment.file_ext)}
      </div>
      <div className="attachment-card__body">
        <div className="attachment-card__title-row">
          <strong>{attachment.title || t("attachment.untitled")}</strong>
          {accessChannels.map((access, index) => (
            <AccessTag
              key={`${access.isVIP ? "vip" : "common"}-${index}`}
              {...access}
            />
          ))}
        </div>
        <div className="attachment-card__meta">
          <span>
            {attachment.original_filename ||
              attachment.filename ||
              t("attachment.file")}
          </span>
          <span>{String(attachment.file_ext || "file").toUpperCase()}</span>
          <span>{attachment.fileSizeLabel || attachment.sizeLabel || "-"}</span>
          <span>
            {t("attachment.downloadCount", {
              count: attachment.download_count || 0,
            })}
          </span>
        </div>
      </div>
      {editable ? (
        showEdit ? (
          <button
            type="button"
            className="attachment-card__edit"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.();
            }}
          >
            {t("attachment.edit")}
          </button>
        ) : null
      ) : (
        <div className="attachment-card__actions">
          <ResourceAccessAuthorizer
            resource={resource}
            decision={accessDecision || resolvedDecision}
            onRejected={() => setDownloadError(t("attachment.downloadDenied"))}
            onPasswordVerifying={({ password }) =>
              accessClient.verifyPassword(resource, password)
            }
            onFinalizing={() => accessClient.finalize(resource)}
          >
            {download}
          </ResourceAccessAuthorizer>
          {downloadError ? (
            <small className="attachment-card__error">{downloadError}</small>
          ) : null}
        </div>
      )}
    </article>
  );
}
