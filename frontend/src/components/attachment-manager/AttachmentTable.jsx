import { useState } from "react";
import useI18n from "../../hooks/useI18n";
import AccessTag from "../access-tag/AccessTag";
import { getResourceAccessChannels } from "../access-tag/resourceAccessTags";
import Toast from "../ui/Toast";
import { Modal } from "../../packages/modal";
import { Table, useTableController } from "../../packages/table";
import AttachmentEditor from "./AttachmentEditor";
import { hasValidAccessPolicy } from "./AttachmentAccessPolicy";
import "./AttachmentEditor.css";
import "./AttachmentTable.css";

function formatDate(value, lang) {
  return value
    ? new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";
}

function errorMessage(error, fallback) {
  return error.response?.data?.detail || error.message || fallback;
}

export default function AttachmentTable({
  fetchData,
  updateAttachment,
  deleteAttachment,
  requestDownload,
  includeUploader = false,
}) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(null);
  const [validPolicy, setValidPolicy] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const translate = (key, fallback) => (t(key) === key ? fallback : t(key));
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData,
  });
  const columns = [
    {
      key: "title",
      title: t("attachment.columns.attachment"),
      canOrder: true,
      minWidth: 250,
      render: (row) => (
        <div className="attachment-table-title">
          <strong>{row.title}</strong>
          <small>{row.original_filename}</small>
        </div>
      ),
    },
    {
      key: "visibility",
      title: t("attachment.columns.access"),
      minWidth: 180,
      wrap: true,
      render: (row) => (
        <div className="attachment-table-access">
          {getResourceAccessChannels(row).map((channel, index) => (
            <AccessTag
              key={`${channel.isVIP ? "vip" : "common"}-${index}`}
              type={channel.type}
              value={channel.value}
              isVIP={channel.isVIP}
            />
          ))}
        </div>
      ),
    },
    ...(includeUploader
      ? [
          {
            key: "author",
            title: t("attachment.columns.uploader"),
            canOrder: true,
            minWidth: 145,
            render: (row) =>
              row.uploadedBy?.displayName || row.uploadedBy?.username || "-",
          },
        ]
      : []),
    {
      key: "file_size",
      title: t("attachment.columns.size"),
      canOrder: true,
      minWidth: 105,
      render: (row) => row.fileSizeLabel || "-",
    },
    {
      key: "usage_count",
      title: t("attachment.columns.used"),
      canOrder: true,
      minWidth: 100,
      render: (row) => row.usage_count || 0,
    },
    {
      key: "download_count",
      title: t("attachment.columns.downloads"),
      canOrder: true,
      minWidth: 105,
      render: (row) => row.download_count || 0,
    },
    {
      key: "updated_at",
      title: t("attachment.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];

  async function save() {
    if (!editing || !values?.title?.trim() || !validPolicy) return;
    setSaving(true);
    try {
      const updatedAttachment = await updateAttachment(editing.id, values);
      controller.replaceRow(
        (row) => row.id === updatedAttachment.id,
        updatedAttachment,
      );
      setEditing(null);
      setNotice({ type: "success", message: t("attachment.updated") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("attachment.updateFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteAttachment(deleting.id);
      controller.removeRow((row) => row.id === deleting.id);
      setDeleting(null);
      setNotice({ type: "success", message: t("attachment.deleted") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("attachment.deleteFailed")),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Table
        columns={columns}
        rows={controller.rows}
        rowKey={(row) => row.id}
        translate={translate}
        loading={controller.loading}
        error={
          controller.error ? (
            <span>
              {errorMessage(controller.error, t("attachment.loadFailed"))}
            </span>
          ) : null
        }
        empty={<span>{t("attachment.empty")}</span>}
        searchText={controller.searchText}
        onSearchTextChange={controller.setSearchText}
        onSearchEnter={controller.submitSearch}
        searchPlaceholderText={t(
          includeUploader
            ? "attachment.searchManagement"
            : "attachment.searchMine",
        )}
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
              ...(requestDownload
                ? [
                    {
                      key: "download",
                      label: t("attachment.download"),
                      onClick: async () => {
                        try {
                          const { url } = await requestDownload(row.id);
                          window.location.assign(url);
                        } catch (error) {
                          setNotice({
                            type: "error",
                            message: errorMessage(
                              error,
                              t("attachment.downloadFailed"),
                            ),
                          });
                        }
                      },
                    },
                  ]
                : []),
              {
                key: "edit",
                label: t("attachment.edit"),
                onClick: () => {
                  setEditing(row);
                  setValidPolicy(hasValidAccessPolicy(row));
                },
              },
              {
                key: "delete",
                label: t("attachment.delete"),
                danger: true,
                onClick: () => setDeleting(row),
              },
            ],
          },
        ]}
      />
      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        size="wide"
        kicker={t("attachment.kicker")}
        title={t("attachment.editTitle")}
        actions={[
          {
            key: "cancel",
            label: t("attachment.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "save",
            label: t("attachment.save"),
            loading: saving,
            disabled: !values?.title?.trim() || !validPolicy,
            onClick: save,
          },
        ]}
      >
        <AttachmentEditor
          attachment={editing}
          onChange={setValues}
          onValidityChange={setValidPolicy}
        />
      </Modal>
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        kicker={t("attachment.danger")}
        title={t("attachment.deleteTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("attachment.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t("attachment.delete"),
            variant: "danger",
            loading: saving,
            onClick: remove,
          },
        ]}
      >
        <p>
          {t("attachment.deleteDescription", { title: deleting?.title || "" })}
        </p>
      </Modal>
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </>
  );
}
