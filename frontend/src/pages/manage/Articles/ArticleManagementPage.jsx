import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useI18n from "../../../hooks/useI18n";
import AccessTag from "../../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../../components/access-tag/resourceAccessTags";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import ArticleExternalLinkEditor from "../../../components/article-external-link/ArticleExternalLinkEditor";
import { Modal } from "../../../packages/modal";
import { Table, useTableController } from "../../../packages/table";
import api from "../../../api";
import ManageSidebar from "../ManageSidebar";
import "../Basic/BasicSettingsPage.css";
import "./ArticleManagementPage.css";
import { canShareArticle } from "./articleSharing";
import { parseMarkdownArticle } from "../../../features/article-editor/markdownArticleImport";
import ArticleCard from "../../../components/article-card/ArticleCard";
import { externalLinkUrl } from "../../../utils/externalLinkUrl";

const tabs = ["published", "drafts", "external-links"];

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

export default function ArticleManagementPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("published");
  const [deleting, setDeleting] = useState(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [externalLink, setExternalLink] = useState(null);
  const [externalLinkExpiry, setExternalLinkExpiry] = useState("7d");
  const [externalLinkPassword, setExternalLinkPassword] = useState("");
  const [externalLinkPending, setExternalLinkPending] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [tagCleanupOpen, setTagCleanupOpen] = useState(false);
  const [tagCleanupPending, setTagCleanupPending] = useState(false);
  const [markdownImportPending, setMarkdownImportPending] = useState(false);
  const [existingImportOpen, setExistingImportOpen] = useState(false);
  const [existingImportQuery, setExistingImportQuery] = useState("");
  const [existingImportArticles, setExistingImportArticles] = useState([]);
  const [existingImportPending, setExistingImportPending] = useState(false);
  const [existingImportLoading, setExistingImportLoading] = useState(false);
  const [existingImportError, setExistingImportError] = useState("");
  const markdownFileInputRef = useRef(null);
  const activeStatusRef = useRef("published");
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const deletingLabel =
    deleting?.kind === "revision"
      ? "Revision"
      : deleting?.kind === "draft"
        ? "Draft"
        : "";
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: (params, config) =>
      api.manage.listArticles(
        { ...params, status: activeStatusRef.current },
        config,
      ),
  });
  const externalLinkController = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: (params, config) =>
      api.manage.listArticleExternalLinks(params, config),
  });

  useEffect(() => {
    if (!existingImportOpen) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setExistingImportLoading(true);
      setExistingImportError("");
      try {
        const result = await api.resources.listImportCandidates(
          { query: existingImportQuery, pageSize: 24 },
          { signal: controller.signal },
        );
        setExistingImportArticles(result.items || []);
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError")
          setExistingImportError(
            errorMessage(error, t("admin.articles.importLoadFailed")),
          );
      } finally {
        if (!controller.signal.aborted) setExistingImportLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [existingImportOpen, existingImportQuery, t]);

  function openExistingImport() {
    setCreateMenuOpen(false);
    setExistingImportQuery("");
    setExistingImportArticles([]);
    setExistingImportError("");
    setExistingImportOpen(true);
  }

  async function importExistingArticle(article) {
    setExistingImportPending(true);
    setExistingImportError("");
    try {
      const draft = await api.resources.importArticle(article.id);
      if (!draft?.slug) throw new Error(t("articleEditor.invalidSlug"));
      setExistingImportOpen(false);
      navigate(
        `/manage/articles/drafts/${encodeURIComponent(draft.slug)}/edit`,
      );
    } catch (error) {
      setExistingImportError(
        errorMessage(error, t("admin.articles.importFailed")),
      );
    } finally {
      setExistingImportPending(false);
    }
  }

  function selectTab(tab) {
    if (tab === activeTab) return;
    activeStatusRef.current = tab === "drafts" ? "draft" : "published";
    setActiveTab(tab);
    void (tab === "external-links"
      ? externalLinkController.refresh()
      : controller.refresh());
  }

  async function saveExternalLink(mode) {
    if (!externalLink) return;
    setExternalLinkPending(true);
    try {
      const link =
        mode === "remove"
          ? await api.manage.deleteArticleExternalLink(externalLink.id)
          : externalLink.token
            ? await api.manage.updateArticleExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              })
            : await api.manage.createArticleExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              });
      if (mode === "remove") {
        externalLinkController.removeRow((row) => row.id === externalLink.id);
        setNotice({
          type: "success",
          message: t("admin.articles.externalLinkRemoved"),
        });
        setExternalLink(null);
      } else {
        externalLinkController.refresh();
        setNotice({
          type: "success",
          message: t("admin.articles.externalLinkSaved"),
        });
        setExternalLink(link);
        setExternalLinkExpiry(defaultExternalLinkExpiry(link));
        setExternalLinkPassword(link.externalLinkPassword || "");
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          t("admin.articles.externalLinkSaveFailed"),
        ),
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
        message: t("admin.articles.externalLinkCopied"),
      });
    } catch {
      setNotice({
        type: "error",
        message: t("admin.articles.externalLinkCopyFailed"),
      });
    }
  }

  async function deleteArticle() {
    if (!deleting) return;
    if (!deleting.slug) {
      setNotice({ type: "error", message: t("articleEditor.invalidSlug") });
      return;
    }
    setDeletingPending(true);
    try {
      await (deleting.kind === "published"
        ? api.resources.deleteArticle(deleting.slug)
        : api.resources.deleteDraft(deleting.slug));
      controller.removeRow((row) => row.id === deleting.id);
      setDeleting(null);
      setNotice({
        type: "success",
        message: t(
          `admin.articles.${deletingLabel ? `${deletingLabel[0].toLowerCase()}${deletingLabel.slice(1)}Deleted` : "deleted"}`,
        ),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          t(
            `admin.articles.${deletingLabel ? `${deletingLabel[0].toLowerCase()}${deletingLabel.slice(1)}DeleteFailed` : "deleteFailed"}`,
          ),
        ),
      });
    } finally {
      setDeletingPending(false);
    }
  }

  async function cleanupTags() {
    setTagCleanupPending(true);
    try {
      const { deleted_count: deletedCount } =
        await api.manage.cleanupArticleTags();
      setTagCleanupOpen(false);
      setNotice({
        type: "success",
        message: t("admin.articles.tagsCleaned", { count: deletedCount }),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.articles.tagsCleanupFailed")),
      });
    } finally {
      setTagCleanupPending(false);
    }
  }

  function chooseMarkdownFile() {
    setCreateMenuOpen(false);
    markdownFileInputRef.current?.click();
  }

  async function importMarkdownFile(event) {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) return;
    if (!/\.md$/i.test(file.name)) {
      setNotice({
        type: "error",
        message: t("admin.articles.markdownInvalidFile"),
      });
      return;
    }
    if (!file.size) {
      setNotice({
        type: "error",
        message: t("admin.articles.markdownEmptyFile"),
      });
      return;
    }

    setMarkdownImportPending(true);
    try {
      let content;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        setNotice({
          type: "error",
          message: t("admin.articles.markdownReadFailed"),
        });
        return;
      }
      const draft = await api.resources.createDraft(
        parseMarkdownArticle(
          content,
          file.name,
          t("admin.articles.markdownDefaultTitle"),
        ),
      );
      if (!draft?.slug) throw new Error(t("articleEditor.invalidSlug"));
      navigate(
        `/manage/articles/drafts/${encodeURIComponent(draft.slug)}/edit`,
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("admin.articles.markdownCreateFailed")),
      });
    } finally {
      setMarkdownImportPending(false);
    }
  }

  const columns = [
    {
      key: "title",
      title: t("admin.articles.columns.title"),
      canOrder: true,
      minWidth: 260,
      render: (row) => (
        <div className="managed-article-title">
          <strong>{row.title}</strong>
          <small>/{row.slug}</small>
        </div>
      ),
    },
    activeTab === "published"
      ? {
          key: "visibility",
          title: t("admin.articles.columns.access"),
          canOrder: true,
          minWidth: 180,
          wrap: true,
          render: (row) => (
            <div className="managed-article-access">
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
        }
      : {
          key: "kind",
          title: t("admin.articles.columns.type"),
          canOrder: true,
          minWidth: 130,
          render: (row) =>
            t(
              `admin.articles.${row.kind === "revision" ? "revision" : "draft"}`,
            ),
        },
    {
      key: "author",
      title: t("admin.articles.columns.author"),
      canOrder: true,
      minWidth: 150,
      render: (row) => row.author?.displayName || row.author?.username || "-",
    },
    {
      key: "updated_at",
      title: t("admin.articles.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  const externalLinkColumns = [
    {
      key: "title",
      title: t("admin.articles.columns.title"),
      canOrder: true,
      minWidth: 240,
      render: (row) => (
        <div className="managed-article-title">
          <strong>{row.title}</strong>
          <small>/{row.slug}</small>
        </div>
      ),
    },
    {
      key: "author",
      title: t("admin.articles.columns.author"),
      canOrder: true,
      minWidth: 140,
      render: (row) => row.author?.displayName || row.author?.username || "-",
    },
    {
      key: "expires_at",
      title: t("admin.articles.externalLinkExpiry"),
      canOrder: true,
      minWidth: 175,
      render: (row) =>
        row.expiresAt
          ? formatDate(row.expiresAt, lang)
          : t("admin.articles.neverExpires"),
    },
    {
      key: "status",
      title: t("admin.articles.externalLinkStatus"),
      minWidth: 110,
      render: (row) => (
        <span
          className={`managed-article-link-status managed-article-link-status--${row.status}`}
        >
          {t(`admin.articles.externalLinkStates.${row.status}`)}
        </span>
      ),
    },
    {
      key: "updated_at",
      title: t("admin.articles.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];

  return (
    <main className="manage-page">
      <ManageSidebar active="posts" />
      <section className="manage-content">
        <div className="settings-shell managed-articles-shell">
          <header className="settings-heading managed-articles-heading">
            <div>
              <span>{t("admin.articles.kicker")}</span>
              <h1>{t("admin.articles.title")}</h1>
              <p>{t("admin.articles.description")}</p>
            </div>
            <div className="managed-articles-heading-actions">
              <Button variant="danger" onClick={() => setTagCleanupOpen(true)}>
                {t("admin.articles.cleanupTags")}
              </Button>
              <div
                className="managed-article-create-menu"
                onMouseEnter={() => setCreateMenuOpen(true)}
                onMouseLeave={() => setCreateMenuOpen(false)}
                onFocus={() => setCreateMenuOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setCreateMenuOpen(false);
                  }
                }}
              >
                <Button onClick={() => navigate("/manage/articles/new")}>
                  {t("admin.articles.create")}
                </Button>
                <div
                  className="managed-article-create-menu__panel"
                  hidden={!createMenuOpen}
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={openExistingImport}
                  >
                    {t("admin.articles.importExisting")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={markdownImportPending}
                    onClick={chooseMarkdownFile}
                  >
                    {markdownImportPending
                      ? t("admin.articles.markdownImporting")
                      : t("admin.articles.importMarkdown")}
                  </button>
                </div>
                <input
                  ref={markdownFileInputRef}
                  className="managed-article-markdown-input"
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  onChange={importMarkdownFile}
                  tabIndex={-1}
                />
              </div>
            </div>
          </header>
          <div
            className="managed-articles-tabs"
            role="tablist"
            aria-label={t("admin.articles.tabsLabel")}
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "is-active" : ""}
                onClick={() => selectTab(tab)}
              >
                {t(`admin.articles.tabs.${tab}`)}
              </button>
            ))}
          </div>
          {activeTab === "external-links" ? (
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
                      t("admin.articles.externalLinkLoadFailed"),
                    )}
                  </span>
                ) : null
              }
              empty={<span>{t("admin.articles.emptyExternalLinks")}</span>}
              searchText={externalLinkController.searchText}
              onSearchTextChange={externalLinkController.setSearchText}
              onSearchEnter={externalLinkController.submitSearch}
              searchPlaceholderText={t(
                "admin.articles.externalLinkSearchPlaceholder",
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
                      label: t("admin.articles.editExternalLink"),
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
                      label: t("admin.articles.removeExternalLink"),
                      danger: true,
                      onClick: () => setExternalLink({ ...row, remove: true }),
                    },
                  ],
                },
              ]}
            />
          ) : (
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
                      t("admin.articles.loadFailed"),
                    )}
                  </span>
                ) : null
              }
              empty={
                <span>
                  {t(
                    activeTab === "published"
                      ? "admin.articles.emptyPublished"
                      : "admin.articles.emptyDrafts",
                  )}
                </span>
              }
              searchText={controller.searchText}
              onSearchTextChange={controller.setSearchText}
              onSearchEnter={controller.submitSearch}
              searchPlaceholderText={t("admin.articles.searchPlaceholder")}
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
                      label: t("admin.articles.browse"),
                      onClick: () =>
                        navigate(
                          row.kind === "published"
                            ? `/articles/${row.slug}`
                            : `/drafts/${row.slug}`,
                        ),
                    },
                    {
                      key: "edit",
                      label: t("admin.articles.edit"),
                      onClick: () =>
                        row.slug
                          ? navigate(
                              row.kind === "published"
                                ? `/manage/articles/${row.slug}/edit`
                                : `/manage/articles/drafts/${row.slug}/edit`,
                            )
                          : setNotice({
                              type: "error",
                              message: t("articleEditor.invalidSlug"),
                            }),
                    },
                    ...(canShareArticle(activeTab, row)
                      ? [
                          {
                            key: "share",
                            label: t("admin.articles.share"),
                            onClick: async () => {
                              try {
                                const link =
                                  await api.manage.getArticleExternalLink(
                                    row.id,
                                  );
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
                                    t("admin.articles.externalLinkLoadFailed"),
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
                      label: t(
                        `admin.articles.delete${row.kind === "revision" ? "Revision" : row.kind === "draft" ? "Draft" : ""}`,
                      ),
                      danger: true,
                      onClick: () => setDeleting(row),
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
        kicker={t("admin.articles.danger")}
        title={t(`admin.articles.delete${deletingLabel}Title`)}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("admin.articles.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t(`admin.articles.delete${deletingLabel}`),
            variant: "danger",
            loading: deletingPending,
            onClick: deleteArticle,
          },
        ]}
      >
        <p>
          {t(`admin.articles.delete${deletingLabel}Description`, {
            title: deleting?.title || "",
          })}
        </p>
      </Modal>
      <Modal
        open={tagCleanupOpen}
        onOpenChange={setTagCleanupOpen}
        kicker={t("admin.articles.danger")}
        title={t("admin.articles.cleanupTagsTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("admin.articles.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "cleanup",
            label: t("admin.articles.cleanupTags"),
            variant: "danger",
            loading: tagCleanupPending,
            onClick: cleanupTags,
          },
        ]}
      >
        <p>{t("admin.articles.cleanupTagsDescription")}</p>
      </Modal>
      <Modal
        open={existingImportOpen}
        onOpenChange={setExistingImportOpen}
        size="wide"
        kicker={t("admin.articles.importExisting")}
        title={t("admin.articles.importTitle")}
        actions={[
          {
            key: "cancel",
            label: t("admin.articles.cancel"),
            variant: "secondary",
            disabled: existingImportPending,
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="managed-article-import">
          <label>
            {t("admin.articles.importSearchLabel")}
            <input
              autoFocus
              value={existingImportQuery}
              placeholder={t("admin.articles.importSearchPlaceholder")}
              onChange={(event) => setExistingImportQuery(event.target.value)}
            />
          </label>
          {existingImportError ? (
            <p className="managed-article-import__error" role="alert">
              {existingImportError}
            </p>
          ) : null}
          {existingImportLoading ? (
            <p className="managed-article-import__state">
              {t("admin.articles.importLoading")}
            </p>
          ) : null}
          {!existingImportLoading &&
          !existingImportError &&
          !existingImportArticles.length ? (
            <p className="managed-article-import__state">
              {t("admin.articles.importEmpty")}
            </p>
          ) : null}
          <div className="managed-article-import__grid">
            {existingImportArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                showTags
                onClick={() => void importExistingArticle(article)}
                className={
                  existingImportPending
                    ? "managed-article-import__card--pending"
                    : ""
                }
              />
            ))}
          </div>
        </div>
      </Modal>
      <ArticleExternalLinkEditor
        link={externalLink}
        expiry={externalLinkExpiry}
        password={externalLinkPassword}
        pending={externalLinkPending}
        t={t}
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
