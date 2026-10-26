import { useState } from "react";
import useI18n from "../../../hooks/useI18n";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import { Modal } from "../../../packages/modal";
import { Table, useTableController } from "../../../packages/table";
import ManageSidebar from "../ManageSidebar";
import api from "../../../api";
import "../Basic/BasicSettingsPage.css";
import "./AuditLogPage.css";

function formatDate(value, language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export default function AuditLogPage() {
  const { t, language } = useI18n();
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [detail, setDetail] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState(null);
  const controller = useTableController({
    initialPageSize: 30,
    initialSort: { key: "created_at", direction: "desc" },
    fetchData: api.manage.listAuditLogs,
  });

  async function openDetail(row) {
    try {
      setDetail(await api.manage.getAuditLog(row.id));
    } catch {
      setNotice({ type: "error", message: t("admin.audit.loadFailed") });
    }
  }

  async function clear() {
    setClearing(true);
    try {
      const { deleted_count: deletedCount } = await api.manage.clearAuditLogs();
      setClearOpen(false);
      setNotice({
        type: "success",
        message: t("admin.audit.cleared", { count: deletedCount }),
      });
      await controller.refresh();
    } catch {
      setNotice({ type: "error", message: t("admin.audit.clearFailed") });
    } finally {
      setClearing(false);
    }
  }

  const columns = [
    {
      key: "action",
      title: t("admin.audit.columns.action"),
      canOrder: true,
      minWidth: 200,
      render: (row) => (
        <span className="audit-action">
          {t(`admin.audit.actions.${row.action}`)}
        </span>
      ),
    },
    {
      key: "actor",
      title: t("admin.audit.columns.actor"),
      canOrder: true,
      minWidth: 170,
      render: (row) => row.actor?.username || t("admin.audit.system"),
    },
    {
      key: "created_at",
      title: t("admin.audit.columns.time"),
      canOrder: true,
      minWidth: 190,
      render: (row) => formatDate(row.created_at, language),
    },
    {
      key: "summary",
      title: t("admin.audit.columns.summary"),
      minWidth: 300,
      ellipsis: true,
      render: (row) => row.summary,
    },
    {
      key: "ip_address",
      title: t("admin.audit.columns.ip"),
      minWidth: 140,
      render: (row) => row.ip_address || "-",
    },
  ];

  return (
    <main className="manage-page">
      <ManageSidebar active="audit" />
      <section className="manage-content">
        <div className="settings-shell audit-shell">
          <header className="settings-heading audit-heading">
            <div>
              <span>{t("admin.basic.website")}</span>
              <h1>{t("admin.audit.title")}</h1>
              <p>{t("admin.audit.description")}</p>
            </div>
            <Button variant="danger" onClick={() => setClearOpen(true)}>
              {t("admin.audit.clear")}
            </Button>
          </header>
          <Table
            columns={columns}
            rows={controller.rows}
            rowKey={(row) => row.id}
            translate={translate}
            getRowContextActions={(row) => [
              {
                group: 1,
                children: [
                  {
                    key: "view-detail",
                    label: t("admin.audit.view"),
                    onClick: () => openDetail(row),
                  },
                ],
              },
            ]}
            loading={controller.loading}
            error={
              controller.error ? (
                <span>{t("admin.audit.loadFailed")}</span>
              ) : null
            }
            empty={<span>{t("admin.audit.empty")}</span>}
            searchText={controller.searchText}
            onSearchTextChange={controller.setSearchText}
            onSearchEnter={controller.submitSearch}
            searchPlaceholderText={t("admin.audit.searchPlaceholder")}
            sortKey={controller.sortKey}
            sortDirection={controller.sortDirection}
            onSortChange={controller.changeSort}
            page={controller.page}
            pageSize={controller.pageSize}
            total={controller.total}
            pageSizeOptions={[15, 30, 50, 100]}
            onPageChange={controller.changePage}
            onPageSizeChange={controller.changePageSize}
          />
        </div>
      </section>
      <Modal
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        kicker={detail ? t(`admin.audit.actions.${detail.action}`) : ""}
        title={detail?.summary || t("admin.audit.detailTitle")}
        size="table"
        actions={[
          {
            key: "close",
            label: t("admin.audit.close"),
            variant: "primary",
            onClick: ({ close }) => close(),
          },
        ]}
      >
        {detail && (
          <div className="audit-detail">
            <dl>
              <dt>{t("admin.audit.columns.actor")}</dt>
              <dd>{detail.actor?.username || t("admin.audit.system")}</dd>
              <dt>{t("admin.audit.columns.ip")}</dt>
              <dd>{detail.ip_address || "-"}</dd>
              <dt>{t("admin.audit.columns.time")}</dt>
              <dd>{formatDate(detail.created_at, language)}</dd>
              <dt>{t("admin.audit.metadata")}</dt>
              <dd>
                <pre>{JSON.stringify(detail.metadata, null, 2)}</pre>
              </dd>
            </dl>
          </div>
        )}
      </Modal>
      <Modal
        open={clearOpen}
        onOpenChange={setClearOpen}
        kicker={t("admin.audit.clearKicker")}
        title={t("admin.audit.clearTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("admin.audit.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "clear",
            label: t("admin.audit.clear"),
            variant: "danger",
            loading: clearing,
            onClick: clear,
          },
        ]}
      >
        <p>{t("admin.audit.clearDescription")}</p>
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
