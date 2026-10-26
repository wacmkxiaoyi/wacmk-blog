import React from "react";
import {
  AddIcon,
  ImageIcon,
  LinkIcon,
  VideoIcon,
} from "../../packages/editor/react/icons/index.ts";
import { Modal } from "../../packages/modal";
import { Table, useTableController } from "../../packages/table";
import AccessTag from "../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../components/access-tag/resourceAccessTags";
import ArticleCard from "../../components/article-card/ArticleCard";
import AttachmentCard from "../../components/attachment-card/AttachmentCard";
import AttachmentAccessPolicy from "../../components/attachment-manager/AttachmentAccessPolicy";
import api from "../../api";
import { InvalidAttachmentBlock } from "../content-renderer/articleContentTemplate";
import "./contentEditorTools.css";

function tr(t, key, fallback) {
  const value = t?.(key);
  return value && value !== key ? value : fallback;
}
function uploadErrorMessage(error, fallback, t) {
  const data = error?.response?.data;
  if (data?.code === "storage_quota_exceeded") {
    return tr(
      t,
      "contentTemplate.editor.storageQuotaExceeded",
      "Personal storage capacity has been exceeded.",
    );
  }
  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  const fieldError = Object.values(data || {})
    .flat()
    .find((value) => typeof value === "string");
  return fieldError || error?.message || fallback;
}
function attachmentData(item) {
  return {
    attachmentId: String(item.id),
    assetId: String(item.assetId),
    title: item.title,
  };
}
function attachmentDirective(data) {
  return `::custom{kind="attachment" attachmentId="${data.attachmentId}" assetId="${data.assetId}" title="${data.title}"}`;
}

function canUpload(user, setting) {
  if (user?.is_staff || user?.is_superuser) return true;
  return Boolean(
    user &&
    setting?.allow_user_upload &&
    (!setting.vip_only || Number(user.vip_level) > 0),
  );
}

function AttachmentEditorBlock({ data, selected, attachments, t }) {
  const attachment = attachments?.[data.attachmentId];
  if (!attachment)
    return (
      <InvalidAttachmentBlock
        title={data.title}
        label={tr(t, "attachment.unavailable", "Attachment unavailable")}
        description={tr(
          t,
          "attachment.unavailableDescription",
          "This attachment is temporarily unavailable for download. It may have been deleted, or you may not have access to it.",
        )}
        untitledLabel={tr(t, "attachment.untitled", "Untitled attachment")}
      />
    );
  return (
    <AttachmentCard
      attachment={attachment}
      compact={selected}
      editable
      showEdit={false}
    />
  );
}

export function createContentEditorTools({
  t,
  openWorkflow,
  attachments,
  user,
  config,
} = {}) {
  const child = (key, label, icon, type) => ({
    key,
    name: tr(t, `contentTemplate.editor.${label}`, label),
    icon,
    group: 3,
    order: 1,
    onClick: (context) => openWorkflow?.(type, context),
  });
  const canUploadVideo = canUpload(user, config?.["upload.video"]);
  const canUploadAttachment = canUpload(user, config?.["upload.attachment"]);
  return [
    child("content-image-upload", "uploadImage", <ImageIcon />, "image"),
    ...(canUploadVideo
      ? [child("content-video-upload", "uploadVideo", <VideoIcon />, "video")]
      : []),
    child(
      "content-article-reference",
      "referenceArticle",
      <LinkIcon />,
      "article",
    ),
    child(
      "content-attachment-library",
      "myAttachments",
      <AddIcon />,
      "attachment-library",
    ),
    ...(canUploadAttachment
      ? [
          {
            key: "content-attachment",
            name: tr(t, "contentTemplate.editor.attachment", "Attachment"),
            icon: <AddIcon />,
            group: 3,
            order: 4.5,
            subTools: ["content-attachment-library"],
            executeVisual: (context) =>
              openWorkflow?.("attachment-upload", context),
            executeMarkdown: (context) =>
              openWorkflow?.("attachment-upload", context),
            customBlock: {
              kind: "attachment",
              render: (props) => (
                <AttachmentEditorBlock
                  {...props}
                  attachments={attachments}
                  t={t}
                />
              ),
            },
          },
        ]
      : []),
  ];
}

export function extendContentEditorTools(baseTools, extraTools) {
  return [
    ...baseTools.map((tool) => {
      if (tool.key === "image")
        return {
          ...tool,
          subTools: ["content-image-upload", ...(tool.subTools || [])],
        };
      if (tool.key === "video")
        return {
          ...tool,
          subTools: extraTools.some(
            (extraTool) => extraTool.key === "content-video-upload",
          )
            ? ["content-video-upload", ...(tool.subTools || [])]
            : tool.subTools,
        };
      if (tool.key === "link")
        return {
          ...tool,
          subTools: [...(tool.subTools || []), "content-article-reference"],
        };
      if (tool.key === "html") return tool;
      return tool;
    }),
    ...extraTools,
  ];
}

function AttachmentLibrary({ t, client, select, showAccess = false }) {
  const table = useTableController({
    initialPageSize: 8,
    fetchData: ({ query, page, pageSize }) =>
      client.listAttachments({ query, page, page_size: pageSize }),
  });
  const columns = [
    {
      key: "title",
      title: tr(t, "contentTemplate.editor.file", "File"),
      minWidth: 280,
      wrap: true,
      render: (item) => (
        <div className="resource-modal__attachment-file">
          <strong>{item.title}</strong>
          <span>{item.original_filename}</span>
          <small>
            {String(item.file_ext || "file").toUpperCase()} ·{" "}
            {item.fileSizeLabel || "-"} ·{" "}
            {tr(
              t,
              "contentTemplate.editor.downloadCount",
              "{count} downloads",
            ).replace("{count}", String(item.download_count || 0))}
          </small>
        </div>
      ),
    },
    ...(showAccess
      ? [
          {
            key: "access",
            title: tr(t, "contentTemplate.editor.access", "Access"),
            minWidth: 160,
            align: "center",
            render: (item) => (
              <div className="resource-modal__access-tags">
                {getResourceAccessChannels(item).map((access, index) => (
                  <AccessTag
                    key={`${access.isVIP ? "vip" : "common"}-${index}`}
                    {...access}
                  />
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      key: "updated",
      title: tr(t, "contentTemplate.editor.updated", "Updated"),
      minWidth: 160,
      render: (item) =>
        item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
    },
    {
      key: "action",
      title: tr(t, "contentTemplate.editor.action", "Action"),
      minWidth: 104,
      align: "right",
      render: (item) => (
        <button
          type="button"
          className="resource-modal__insert-row"
          onClick={() => select(item)}
        >
          {tr(t, "contentTemplate.editor.insert", "Insert")}
        </button>
      ),
    },
  ];
  return (
    <Table
      columns={columns}
      rows={table.rows}
      rowKey={(item) => item.id}
      translate={(key, fallback) => tr(t, key, fallback)}
      loading={table.loading}
      error={table.error?.message}
      empty={tr(
        t,
        "contentTemplate.editor.emptyAttachments",
        "No attachments found.",
      )}
      searchText={table.searchText}
      onSearchTextChange={table.setSearchText}
      onSearchEnter={table.submitSearch}
      searchPlaceholderText={tr(
        t,
        "contentTemplate.editor.searchAttachments",
        "Search attachments",
      )}
      page={table.page}
      pageSize={table.pageSize}
      total={table.total}
      onPageChange={table.changePage}
      onPageSizeChange={table.changePageSize}
    />
  );
}

export function ContentResourceModals({
  t,
  client = api.resources,
  workflow,
  onOpenChange,
  onMediaUploaded,
  onMediaUploadFailed,
  onAttachmentSelected,
  onMediaUploading,
}) {
  const [file, setFile] = React.useState(null);
  const [attachmentSource, setAttachmentSource] = React.useState("upload");
  const [selectedAttachment, setSelectedAttachment] = React.useState(null);
  const [attachmentLibraryOpen, setAttachmentLibraryOpen] =
    React.useState(false);
  const [title, setTitle] = React.useState("");
  const [visibility, setVisibility] = React.useState("public");
  const [scope, setScope] = React.useState("unified");
  const [rules, setRules] = React.useState([]);
  const [vipVisibility, setVipVisibility] = React.useState("public");
  const [vipRules, setVipRules] = React.useState([]);
  const [articles, setArticles] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const type = workflow.type;
  const open = workflow.open;
  React.useEffect(() => {
    setFile(null);
    setAttachmentSource("upload");
    setSelectedAttachment(null);
    setAttachmentLibraryOpen(false);
    setTitle("");
    setVisibility("public");
    setScope("unified");
    setRules([]);
    setVipVisibility("public");
    setVipRules([]);
    setArticles([]);
    setQuery("");
    setError("");
    setUploading(false);
  }, [open, type]);
  React.useEffect(() => {
    if (!open || type !== "article") return;
    const timer = setTimeout(
      () =>
        client
          .listReferenceCandidates({ query })
          .then((value) => setArticles(value.items || []))
          .catch((e) => setError(e.message)),
      180,
    );
    return () => clearTimeout(timer);
  }, [open, type, query]);
  const close = () => onOpenChange(false);
  const fileDetails = file
    ? `${file.name} · ${String(file.name.split(".").pop() || "file").toUpperCase()} · ${(file.size / 1024).toFixed(1)} KB`
    : null;
  const selectAttachment = (item) => {
    onAttachmentSelected?.(item);
    workflow.context?.insertMarkdown(attachmentDirective(attachmentData(item)));
    close();
  };
  async function uploadAttachment() {
    try {
      if (attachmentSource === "upload" && !file)
        throw new Error(
          tr(t, "contentTemplate.editor.fileRequired", "Choose a file first."),
        );
      if (attachmentSource === "existing" && !selectedAttachment)
        throw new Error(
          tr(t, "contentTemplate.editor.fileRequired", "Choose a file first."),
        );
      if (
        rules.some((rule) => rule.type === "encrypted" && !rule.value) ||
        vipRules.some((rule) => rule.type === "encrypted" && !rule.value)
      )
        throw new Error(
          tr(
            t,
            "contentTemplate.editor.passwordRequired",
            "Password is required.",
          ),
        );
      if (
        (visibility === "conditional" && !rules.length) ||
        (scope === "standalone" &&
          vipVisibility === "conditional" &&
          !vipRules.length)
      )
        throw new Error(
          tr(
            t,
            "contentTemplate.editor.conditionRequired",
            "Add at least one condition for each conditional access setting.",
          ),
        );
      setUploading(true);
      const form = new FormData();
      [
        ["title", title || file?.name || selectedAttachment?.title],
        ["visibility", visibility],
        ["access_scope", scope],
        ["condition_rules", JSON.stringify(rules)],
        ["vip_access_permission", vipVisibility],
        ["vip_condition_rules", JSON.stringify(vipRules)],
      ].forEach(([key, value]) => form.append(key, value));
      if (attachmentSource === "upload") form.append("file", file);
      else form.append("reused_asset_id", selectedAttachment.assetId);
      selectAttachment(await client.uploadAttachment(form));
    } catch (uploadError) {
      setError(
        uploadErrorMessage(
          uploadError,
          tr(
            t,
            "contentTemplate.editor.operationFailed",
            "The operation failed. Please try again.",
          ),
          t,
        ),
      );
    } finally {
      setUploading(false);
    }
  }
  async function uploadMedia() {
    let temporaryAssetId;
    try {
      if (!file)
        throw new Error(
          tr(t, "contentTemplate.editor.fileRequired", "Choose a file first."),
        );
      setUploading(true);
      temporaryAssetId = crypto.randomUUID();
      const label = (title || file.name).replace(/"/g, "'");
      workflow.context?.insertMarkdown(
        type === "image"
          ? `::image{assetId="${temporaryAssetId}" alt="${label}"}`
          : `::video{assetId="${temporaryAssetId}" title="${label}"}`,
      );
      onMediaUploading?.({
        assetId: temporaryAssetId,
        type,
        file,
        title: label,
      });
      const media = await client.uploadMedia(type, file);
      workflow.context?.replaceAssetId?.(temporaryAssetId, media.assetId);
      onMediaUploaded?.(media, temporaryAssetId);
      close();
    } catch (uploadError) {
      const message = uploadErrorMessage(
        uploadError,
        tr(
          t,
          "contentTemplate.editor.operationFailed",
          "The operation failed. Please try again.",
        ),
        t,
      );
      if (temporaryAssetId) onMediaUploadFailed?.(temporaryAssetId, message);
      setError(message);
    } finally {
      setUploading(false);
    }
  }
  if (!open) return null;
  if (attachmentLibraryOpen)
    return (
      <Modal
        open
        onOpenChange={setAttachmentLibraryOpen}
        size="attachmentBrowser"
        kicker={tr(t, "contentTemplate.editor.attachment", "Attachment")}
        title={tr(
          t,
          "contentTemplate.editor.myAttachments",
          "Choose uploaded attachment",
        )}
        actions={[
          {
            key: "cancel",
            variant: "secondary",
            onClick: ({ close: closeModal }) => closeModal(),
          },
        ]}
      >
        <AttachmentLibrary
          t={t}
          client={client}
          select={(item) => {
            setSelectedAttachment(item);
            setFile(null);
            setError("");
            setAttachmentLibraryOpen(false);
          }}
        />
      </Modal>
    );
  if (type === "article")
    return (
      <Modal
        open
        onOpenChange={onOpenChange}
        size="wide"
        kicker={tr(t, "contentTemplate.editor.articles", "Articles")}
        title={tr(
          t,
          "contentTemplate.editor.referenceArticle",
          "Reference internal article",
        )}
        actions={[
          {
            key: "cancel",
            variant: "secondary",
            onClick: ({ close: closeModal }) => closeModal(),
          },
        ]}
      >
        <div className="resource-modal">
          <label>
            {tr(t, "contentTemplate.editor.searchArticles", "Search articles")}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="resource-modal__article-grid">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                showTags
                onClick={(item) => {
                  workflow.context?.insertMarkdown(
                    `[${item.title}](/articles/${item.slug}/)`,
                  );
                  close();
                }}
              />
            ))}
          </div>
        </div>
      </Modal>
    );
  if (type === "attachment-library")
    return (
      <Modal
        open
        onOpenChange={onOpenChange}
        size="attachmentBrowser"
        kicker={tr(t, "contentTemplate.editor.attachment", "Attachment")}
        title={tr(
          t,
          "contentTemplate.editor.myAttachments",
          "Insert uploaded attachment",
        )}
        actions={[
          {
            key: "cancel",
            variant: "secondary",
            onClick: ({ close: closeModal }) => closeModal(),
          },
        ]}
      >
        <AttachmentLibrary
          t={t}
          client={client}
          select={selectAttachment}
          showAccess
        />
      </Modal>
    );
  const media = type === "image" || type === "video";
  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      size={media ? "md" : "wide"}
      kicker={
        media
          ? tr(t, "contentTemplate.editor.media", "Media")
          : tr(t, "contentTemplate.editor.attachment", "Attachment")
      }
      title={
        media
          ? type === "image"
            ? tr(t, "contentTemplate.editor.uploadImage", "Upload image")
            : tr(t, "contentTemplate.editor.uploadVideo", "Upload video")
          : tr(
              t,
              "contentTemplate.editor.uploadAttachment",
              "Upload attachment",
            )
      }
      actions={[
        {
          key: "cancel",
          variant: "secondary",
          onClick: ({ close: closeModal }) => closeModal(),
        },
        {
          key: "insert",
          label: uploading
            ? tr(t, "contentTemplate.editor.uploading", "Uploading...")
            : tr(t, "contentTemplate.editor.insert", "Insert"),
          variant: "primary",
          disabled: uploading,
          onClick: media ? uploadMedia : uploadAttachment,
          keepOpen: true,
        },
      ]}
    >
      <div className="resource-modal">
        {error ? <p className="resource-modal__error">{error}</p> : null}
        <div className="resource-modal__two-columns">
          <label>
            {tr(t, "contentTemplate.editor.title", "Title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {media ? (
            <label>
              {tr(t, "contentTemplate.editor.file", "File")}
              <input
                type="file"
                accept={type === "image" ? "image/*" : "video/*"}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          ) : null}
        </div>
        {!media ? (
          <section className="resource-modal__attachment-panel">
            <div className="resource-modal__attachment-panel-head">
              <div>
                <strong>
                  {tr(
                    t,
                    "contentTemplate.editor.attachmentSource",
                    "Attachment source",
                  )}
                </strong>
                <span>
                  {tr(
                    t,
                    "contentTemplate.editor.attachmentSourceHint",
                    "Upload a new file or reuse an uploaded file with new access settings.",
                  )}
                </span>
              </div>
              <select
                aria-label={tr(
                  t,
                  "contentTemplate.editor.attachmentSource",
                  "Attachment source",
                )}
                value={attachmentSource}
                onChange={(e) => {
                  setAttachmentSource(e.target.value);
                  setFile(null);
                  setSelectedAttachment(null);
                  setError("");
                }}
              >
                <option value="upload">
                  {tr(
                    t,
                    "contentTemplate.editor.uploadNewAttachment",
                    "Upload new attachment",
                  )}
                </option>
                <option value="existing">
                  {tr(
                    t,
                    "contentTemplate.editor.chooseUploadedAttachment",
                    "Choose uploaded attachment",
                  )}
                </option>
              </select>
            </div>
            <label>
              {tr(t, "contentTemplate.editor.file", "File")}
              {attachmentSource === "upload" ? (
                <div className="resource-modal__selected-attachment">
                  <div>
                    <strong>
                      {file?.name ||
                        tr(
                          t,
                          "contentTemplate.editor.noFileSelected",
                          "No file selected",
                        )}
                    </strong>
                    <span>
                      {fileDetails ||
                        tr(
                          t,
                          "contentTemplate.editor.uploadAttachmentHint",
                          "Choose a file from your device.",
                        )}
                    </span>
                  </div>
                  <label className="resource-modal__choose-attachment">
                    {file
                      ? tr(t, "contentTemplate.editor.changeFile", "Change")
                      : tr(
                          t,
                          "contentTemplate.editor.chooseFile",
                          "Choose file",
                        )}
                    <input
                      type="file"
                      accept="*"
                      onChange={(e) => {
                        setFile(e.target.files?.[0] || null);
                        setError("");
                      }}
                    />
                  </label>
                </div>
              ) : (
                <div className="resource-modal__selected-attachment">
                  <div>
                    <strong>
                      {selectedAttachment?.title ||
                        tr(
                          t,
                          "contentTemplate.editor.noFileSelected",
                          "No file selected",
                        )}
                    </strong>
                    <span>
                      {selectedAttachment
                        ? `${selectedAttachment.original_filename} · ${String(selectedAttachment.file_ext || "file").toUpperCase()} · ${selectedAttachment.fileSizeLabel || "-"}`
                        : tr(
                            t,
                            "contentTemplate.editor.selectUploadedAttachmentHint",
                            "Choose an uploaded file to reuse.",
                          )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="resource-modal__choose-attachment"
                    onClick={() => setAttachmentLibraryOpen(true)}
                  >
                    {selectedAttachment
                      ? tr(t, "contentTemplate.editor.changeFile", "Change")
                      : tr(
                          t,
                          "contentTemplate.editor.chooseFile",
                          "Choose file",
                        )}
                  </button>
                </div>
              )}
            </label>
          </section>
        ) : null}
        {!media ? (
          <>
            <AttachmentAccessPolicy
              t={t}
              value={{
                visibility,
                condition_rules: rules,
                access_scope: scope,
                vip_access_permission: vipVisibility,
                vip_condition_rules: vipRules,
              }}
              onChange={(policy) => {
                setVisibility(policy.visibility);
                setRules(policy.condition_rules);
                setScope(policy.access_scope);
                setVipVisibility(policy.vip_access_permission);
                setVipRules(policy.vip_condition_rules);
              }}
              allowBookOnly
            />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
