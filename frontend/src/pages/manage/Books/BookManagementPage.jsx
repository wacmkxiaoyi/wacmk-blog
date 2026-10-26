import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useI18n from "../../../hooks/useI18n";
import AccessTag from "../../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../../components/access-tag/resourceAccessTags";
import Toast from "../../../components/ui/Toast";
import ArticleExternalLinkEditor from "../../../components/article-external-link/ArticleExternalLinkEditor";
import Button from "../../../components/ui/Button";
import { Modal } from "../../../packages/modal";
import { Table, useTableController } from "../../../packages/table";
import api from "../../../api";
import ManageSidebar from "../ManageSidebar";
import "../Basic/BasicSettingsPage.css";
import "./BookManagementPage.css";
import { externalLinkUrl } from "../../../utils/externalLinkUrl";

function formatDate(value, language) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error, fallback) {
  return error.response?.data?.detail || error.message || fallback;
}

function defaultExternalLinkExpiry(link) {
  return link?.url && !link.expiresAt ? "never" : "7d";
}

export default function BookManagementPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [activeTab, setActiveTab] = useState("published");
  const [externalLink, setExternalLink] = useState(null);
  const [externalLinkExpiry, setExternalLinkExpiry] = useState("7d");
  const [externalLinkPassword, setExternalLinkPassword] = useState("");
  const [externalLinkPending, setExternalLinkPending] = useState(false);
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: api.manage.listBooks,
  });
  const externalLinkController = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: api.manage.listBookExternalLinks,
  });

  function selectTab(tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === "external-links") void externalLinkController.refresh();
  }

  async function saveExternalLink(mode) {
    if (!externalLink) return;
    setExternalLinkPending(true);
    try {
      const link =
        mode === "remove"
          ? await api.manage.deleteBookExternalLink(externalLink.id)
          : externalLink.token
            ? await api.manage.updateBookExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              })
            : await api.manage.createBookExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              });
      if (mode === "remove") {
        externalLinkController.removeRow((row) => row.id === externalLink.id);
        setExternalLink(null);
        setNotice({
          type: "success",
          message: t("admin.books.externalLinkRemoved"),
        });
      } else {
        void externalLinkController.refresh();
        setExternalLink(link);
        setExternalLinkExpiry(defaultExternalLinkExpiry(link));
        setExternalLinkPassword(link.externalLinkPassword || "");
        setNotice({
          type: "success",
          message: t("admin.books.externalLinkSaved"),
        });
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.books.externalLinkSaveFailed")),
      });
    } finally {
      setExternalLinkPending(false);
    }
  }

  async function copyExternalLink() {
    if (!externalLink?.url) return;
    try {
      await navigator.clipboard.writeText(externalLinkUrl(externalLink.url));
      setNotice({
        type: "success",
        message: t("admin.books.externalLinkCopied"),
      });
    } catch {
      setNotice({
        type: "error",
        message: t("admin.books.externalLinkCopyFailed"),
      });
    }
  }

  async function deleteBook() {
    if (!deleting?.slug) return;
    setDeletingPending(true);
    try {
      await api.manage.deleteBook(deleting.slug);
      controller.removeRow((row) => row.id === deleting.id);
      setDeleting(null);
      setNotice({ type: "success", message: t("admin.books.deleted") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.books.deleteFailed")),
      });
    } finally {
      setDeletingPending(false);
    }
  }

  const columns = [
    {
      key: "name",
      title: t("admin.books.columns.name"),
      canOrder: true,
      minWidth: 260,
      render: (row) => (
        <div className="managed-book-name">
          <strong>{row.name}</strong>
          <small>/{row.slug}</small>
        </div>
      ),
    },
    {
      key: "article_count",
      title: t("admin.books.columns.articles"),
      canOrder: true,
      minWidth: 110,
      render: (row) => row.articleCount,
    },
    {
      key: "visibility",
      title: t("admin.books.columns.access"),
      canOrder: true,
      minWidth: 180,
      wrap: true,
      render: (row) => (
        <div className="managed-book-access">
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
    {
      key: "author",
      title: t("admin.books.columns.author"),
      canOrder: true,
      minWidth: 150,
      render: (row) => row.author?.displayName || row.author?.username || "-",
    },
    {
      key: "updated_at",
      title: t("admin.books.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  const externalLinkColumns = [
    {
      key: "title",
      title: t("admin.books.columns.name"),
      canOrder: true,
      minWidth: 240,
      render: (row) => (
        <div className="managed-book-name">
          <strong>{row.title}</strong>
          <small>/{row.slug}</small>
        </div>
      ),
    },
    {
      key: "author",
      title: t("admin.books.columns.author"),
      canOrder: true,
      minWidth: 140,
      render: (row) => row.author?.displayName || row.author?.username || "-",
    },
    {
      key: "expires_at",
      title: t("admin.books.externalLinkExpiry"),
      canOrder: true,
      minWidth: 175,
      render: (row) =>
        row.expiresAt
          ? formatDate(row.expiresAt, lang)
          : t("admin.books.neverExpires"),
    },
    {
      key: "status",
      title: t("admin.books.externalLinkStatus"),
      minWidth: 110,
      render: (row) => (
        <span
          className={`managed-book-link-status managed-book-link-status--${row.status}`}
        >
          {t(`admin.books.externalLinkStates.${row.status}`)}
        </span>
      ),
    },
    {
      key: "updated_at",
      title: t("admin.books.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];

  return (
    <main className="manage-page">
      <ManageSidebar active="books" />
      <section className="manage-content">
        <div className="settings-shell managed-books-shell">
          <header className="settings-heading managed-books-heading">
            <div>
              <span>{t("admin.books.kicker")}</span>
              <h1>{t("admin.books.title")}</h1>
              <p>{t("admin.books.description")}</p>
            </div>
            {activeTab === "published" ? (
              <Button onClick={() => navigate("/manage/books/new")}>
                {t("admin.books.create")}
              </Button>
            ) : null}
          </header>
          <div
            className="managed-books-tabs"
            role="tablist"
            aria-label={t("admin.books.tabsLabel")}
          >
            {[
              ["published", "admin.books.tabs.published"],
              ["external-links", "admin.books.tabs.externalLinks"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                className={activeTab === key ? "is-active" : ""}
                onClick={() => selectTab(key)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          {activeTab === "published" ? (
            <Table
              columns={columns}
              rows={controller.rows}
              rowKey={(row) => row.id}
              translate={translate}
              loading={controller.loading}
              error={
                controller.error ? (
                  <span>
                    {errorMessage(
                      controller.error,
                      t("admin.books.loadFailed"),
                    )}
                  </span>
                ) : null
              }
              empty={<span>{t("admin.books.empty")}</span>}
              searchText={controller.searchText}
              onSearchTextChange={controller.setSearchText}
              onSearchEnter={controller.submitSearch}
              searchPlaceholderText={t("admin.books.searchPlaceholder")}
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
                      key: "browse",
                      label: t("admin.books.browse"),
                      onClick: () =>
                        navigate(`/books/${encodeURIComponent(row.slug)}`),
                    },
                    {
                      key: "edit",
                      label: t("admin.books.edit"),
                      onClick: () =>
                        navigate(
                          `/manage/books/${encodeURIComponent(row.slug)}/edit`,
                        ),
                    },
                    ...(row.visibility === "public"
                      ? [
                          {
                            key: "share",
                            label: t("admin.books.share"),
                            onClick: async () => {
                              try {
                                const link =
                                  await api.manage.getBookExternalLink(row.id);
                                setExternalLink(link);
                                setExternalLinkExpiry(
                                  defaultExternalLinkExpiry(link),
                                );
                                setExternalLinkPassword(
                                  link.externalLinkPassword || "",
                                );
                              } catch (error) {
                                setNotice({
                                  type: "error",
                                  message: errorMessage(
                                    error,
                                    t("admin.books.externalLinkLoadFailed"),
                                  ),
                                });
                              }
                            },
                          },
                        ]
                      : []),
                  ],
                },
                {
                  group: 2,
                  children: [
                    {
                      key: "delete",
                      label: t("admin.books.delete"),
                      danger: true,
                      onClick: () => setDeleting(row),
                    },
                  ],
                },
              ]}
            />
          ) : (
            <Table
              columns={externalLinkColumns}
              rows={externalLinkController.rows}
              rowKey={(row) => row.id}
              translate={translate}
              loading={externalLinkController.loading}
              error={
                externalLinkController.error ? (
                  <span>
                    {errorMessage(
                      externalLinkController.error,
                      t("admin.books.externalLinkLoadFailed"),
                    )}
                  </span>
                ) : null
              }
              empty={<span>{t("admin.books.emptyExternalLinks")}</span>}
              searchText={externalLinkController.searchText}
              onSearchTextChange={externalLinkController.setSearchText}
              onSearchEnter={externalLinkController.submitSearch}
              searchPlaceholderText={t(
                "admin.books.externalLinkSearchPlaceholder",
              )}
              sortKey={externalLinkController.sortKey}
              sortDirection={externalLinkController.sortDirection}
              onSortChange={externalLinkController.changeSort}
              page={externalLinkController.page}
              pageSize={externalLinkController.pageSize}
              total={externalLinkController.total}
              pageSizeOptions={[20, 50, 100]}
              onPageChange={externalLinkController.changePage}
              onPageSizeChange={externalLinkController.changePageSize}
              getRowContextActions={(row) => [
                {
                  group: 1,
                  children: [
                    {
                      key: "edit",
                      label: t("admin.books.editExternalLink"),
                      onClick: () => {
                        setExternalLink(row);
                        setExternalLinkExpiry(defaultExternalLinkExpiry(row));
                        setExternalLinkPassword(row.externalLinkPassword || "");
                      },
                    },
                  ],
                },
                {
                  group: 2,
                  children: [
                    {
                      key: "remove",
                      label: t("admin.books.removeExternalLink"),
                      danger: true,
                      onClick: () => setExternalLink({ ...row, remove: true }),
                    },
                  ],
                },
              ]}
            />
          )}
        </div>
      </section>
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        kicker={t("admin.books.danger")}
        title={t("admin.books.deleteTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("admin.books.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t("admin.books.delete"),
            variant: "danger",
            loading: deletingPending,
            onClick: deleteBook,
          },
        ]}
      >
        <p>
          {t("admin.books.deleteDescription", { title: deleting?.name || "" })}
        </p>
      </Modal>
      <ArticleExternalLinkEditor
        link={externalLink}
        expiry={externalLinkExpiry}
        password={externalLinkPassword}
        pending={externalLinkPending}
        t={t}
        prefix="admin.books"
        onExpiryChange={setExternalLinkExpiry}
        onPasswordChange={setExternalLinkPassword}
        onSave={() => saveExternalLink("save")}
        onRemove={() => saveExternalLink("remove")}
        onCopy={copyExternalLink}
        onOpenChange={(open) =>
          !open && (setExternalLink(null), setExternalLinkPassword(""))
        }
      />
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}
