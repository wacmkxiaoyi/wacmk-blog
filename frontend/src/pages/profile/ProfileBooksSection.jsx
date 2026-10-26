import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import AccessTag from "../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../components/access-tag/resourceAccessTags";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import useAuth from "../../hooks/useAuth";
import useI18n from "../../hooks/useI18n";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import { Modal } from "../../packages/modal";
import { Table, useTableController } from "../../packages/table";
import { getBookWritePermission } from "../../utils/bookWritePermission";
import ArticleExternalLinkEditor from "../../components/article-external-link/ArticleExternalLinkEditor";
import { externalLinkUrl } from "../../utils/externalLinkUrl";
import { formatContentQuota, getContentQuota } from "../../utils/contentQuota";
import "../manage/Articles/ArticleManagementPage.css";
import "../manage/Books/BookManagementPage.css";

function formatDate(value, language) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export default function ProfileBooksSection() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { config } = useSiteRuntime();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [activeTab, setActiveTab] = useState("published");
  const [externalLink, setExternalLink] = useState(null);
  const [externalLinkExpiry, setExternalLinkExpiry] = useState("7d");
  const [externalLinkPassword, setExternalLinkPassword] = useState("");
  const [externalLinkPending, setExternalLinkPending] = useState(false);
  const translate = (key, fallback) => (t(key) === key ? fallback : t(key));
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: api.resources.listMyBooks,
  });
  const permission = getBookWritePermission(user, config, controller.total);
  const quota = getContentQuota(user, config?.["content.book"]);
  const externalLinkController = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: api.resources.listMyBookExternalLinks,
  });
  const columns = [
    {
      key: "name",
      title: t("profile.books.columns.name"),
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
      title: t("profile.books.columns.articles"),
      canOrder: true,
      minWidth: 110,
      render: (row) => row.articleCount,
    },
    {
      key: "visibility",
      title: t("profile.books.columns.access"),
      canOrder: true,
      minWidth: 180,
      wrap: true,
      render: (row) => (
        <div className="managed-book-access">
          {getResourceAccessChannels(row).map((channel, index) => (
            <AccessTag
              key={`${channel.isVIP ? "vip" : "common"}-${index}`}
              {...channel}
            />
          ))}
        </div>
      ),
    },
    {
      key: "updated_at",
      title: t("profile.books.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  const externalLinkColumns = [
    {
      key: "title",
      title: t("profile.books.columns.name"),
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
      key: "expires_at",
      title: t("profile.books.externalLinkExpiry"),
      canOrder: true,
      minWidth: 175,
      render: (row) =>
        row.expiresAt
          ? formatDate(row.expiresAt, lang)
          : t("profile.books.neverExpires"),
    },
    {
      key: "status",
      title: t("profile.books.externalLinkStatus"),
      minWidth: 110,
      render: (row) => (
        <span
          className={`managed-book-link-status managed-book-link-status--${row.status}`}
        >
          {t(`profile.books.externalLinkStates.${row.status}`)}
        </span>
      ),
    },
    {
      key: "updated_at",
      title: t("profile.books.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  function defaultExternalLinkExpiry(link) {
    return link?.url && !link.expiresAt ? "never" : "7d";
  }
  function selectTab(tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === "external-links") void externalLinkController.refresh();
  }
  async function openExternalLink(book) {
    try {
      const link = await api.resources.getMyBookExternalLink(book.id);
      setExternalLink(link);
      setExternalLinkExpiry(defaultExternalLinkExpiry(link));
      setExternalLinkPassword(link.externalLinkPassword || "");
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("profile.books.externalLinkLoadFailed")),
      });
    }
  }
  async function saveExternalLink(mode) {
    if (!externalLink) return;
    setExternalLinkPending(true);
    try {
      const link =
        mode === "remove"
          ? await api.resources.deleteMyBookExternalLink(externalLink.id)
          : externalLink.token
            ? await api.resources.updateMyBookExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              })
            : await api.resources.createMyBookExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              });
      if (mode === "remove") {
        externalLinkController.removeRow((row) => row.id === externalLink.id);
        setExternalLink(null);
      } else {
        void externalLinkController.refresh();
        setExternalLink(link);
        setExternalLinkExpiry(defaultExternalLinkExpiry(link));
        setExternalLinkPassword(link.externalLinkPassword || "");
      }
      setNotice({
        type: "success",
        message: t(
          mode === "remove"
            ? "profile.books.externalLinkRemoved"
            : "profile.books.externalLinkSaved",
        ),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("profile.books.externalLinkSaveFailed")),
      });
    } finally {
      setExternalLinkPending(false);
    }
  }
  async function copyExternalLink() {
    try {
      await navigator.clipboard.writeText(externalLinkUrl(externalLink.url));
      setNotice({
        type: "success",
        message: t("profile.books.externalLinkCopied"),
      });
    } catch {
      setNotice({
        type: "error",
        message: t("profile.books.externalLinkCopyFailed"),
      });
    }
  }
  async function deleteBook() {
    if (!deleting) return;
    setDeletingPending(true);
    try {
      await api.resources.deleteBook(deleting.slug);
      controller.removeRow((row) => row.id === deleting.id);
      setDeleting(null);
      setNotice({ type: "success", message: t("profile.books.deleted") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("profile.books.deleteFailed")),
      });
    } finally {
      setDeletingPending(false);
    }
  }
  return (
    <section className="profile-shell profile-articles-shell">
      <header className="profile-heading managed-articles-heading">
        <div>
          <span>{t("profile.workspace")}</span>
          <h1>{t("profile.books.title")}</h1>
          <p>{t("profile.books.description")}</p>
        </div>
        {permission.allowed ? (
          <Button onClick={() => navigate("/profile/books/new")}>
            {t("profile.books.create")}
          </Button>
        ) : null}
      </header>
      <div className="profile-content-tabbar">
        <div
          className="managed-books-tabs"
          role="tablist"
          aria-label={t("profile.books.tabsLabel")}
        >
          {[
            ["published", "profile.books.tabs.published"],
            ["external-links", "profile.books.tabs.externalLinks"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : ""}
              onClick={() => selectTab(tab)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="profile-content-quota">
          {t("profile.bookQuota", {
            current: controller.total,
            maximum: formatContentQuota(quota),
          })}
        </div>
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
                {errorMessage(controller.error, t("profile.books.loadFailed"))}
              </span>
            ) : null
          }
          empty={<span>{t("profile.books.empty")}</span>}
          searchText={controller.searchText}
          onSearchTextChange={controller.setSearchText}
          onSearchEnter={controller.submitSearch}
          searchPlaceholderText={t("profile.books.searchPlaceholder")}
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
                  label: t("profile.books.browse"),
                  onClick: () =>
                    navigate(`/books/${encodeURIComponent(row.slug)}`),
                },
                ...(permission.allowed
                  ? [
                      {
                        key: "edit",
                        label: t("profile.books.edit"),
                        onClick: () =>
                          navigate(
                            `/profile/books/${encodeURIComponent(row.slug)}/edit`,
                          ),
                      },
                      ...(row.visibility === "public"
                        ? [
                            {
                              key: "share",
                              label: t("profile.books.share"),
                              onClick: () => void openExternalLink(row),
                            },
                          ]
                        : []),
                    ]
                  : []),
              ],
            },
            {
              group: 2,
              children: [
                {
                  key: "delete",
                  label: t("profile.books.delete"),
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
                  t("profile.books.externalLinkLoadFailed"),
                )}
              </span>
            ) : null
          }
          empty={<span>{t("profile.books.emptyExternalLinks")}</span>}
          searchText={externalLinkController.searchText}
          onSearchTextChange={externalLinkController.setSearchText}
          onSearchEnter={externalLinkController.submitSearch}
          searchPlaceholderText={t(
            "profile.books.externalLinkSearchPlaceholder",
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
          getRowContextActions={(row) =>
            permission.allowed
              ? [
                  {
                    group: 1,
                    children: [
                      {
                        key: "edit",
                        label: t("profile.books.editExternalLink"),
                        onClick: () => {
                          setExternalLink(row);
                          setExternalLinkExpiry(defaultExternalLinkExpiry(row));
                        },
                      },
                    ],
                  },
                  {
                    group: 2,
                    children: [
                      {
                        key: "remove",
                        label: t("profile.books.removeExternalLink"),
                        danger: true,
                        onClick: () =>
                          setExternalLink({ ...row, remove: true }),
                      },
                    ],
                  },
                ]
              : []
          }
        />
      )}
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        kicker={t("profile.books.danger")}
        title={t("profile.books.deleteTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("profile.books.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t("profile.books.delete"),
            variant: "danger",
            loading: deletingPending,
            onClick: deleteBook,
          },
        ]}
      >
        <p>
          {t("profile.books.deleteDescription", {
            title: deleting?.name || "",
          })}
        </p>
      </Modal>
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
      <ArticleExternalLinkEditor
        link={externalLink}
        expiry={externalLinkExpiry}
        password={externalLinkPassword}
        pending={externalLinkPending}
        t={t}
        prefix="profile.books"
        onExpiryChange={setExternalLinkExpiry}
        onPasswordChange={setExternalLinkPassword}
        onSave={() => saveExternalLink("save")}
        onRemove={() => saveExternalLink("remove")}
        onCopy={copyExternalLink}
        onOpenChange={(open) =>
          !open && (setExternalLink(null), setExternalLinkPassword(""))
        }
      />
    </section>
  );
}
