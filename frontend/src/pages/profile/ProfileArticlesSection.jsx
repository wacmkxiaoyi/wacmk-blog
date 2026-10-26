import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useI18n from "../../hooks/useI18n";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import AccessTag from "../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../components/access-tag/resourceAccessTags";
import ArticleCard from "../../components/article-card/ArticleCard";
import ArticleExternalLinkEditor from "../../components/article-external-link/ArticleExternalLinkEditor";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { Modal } from "../../packages/modal";
import { Table, useTableController } from "../../packages/table";
import api from "../../api";
import { parseMarkdownArticle } from "../../features/article-editor/markdownArticleImport";
import { getArticleWritePermission } from "../../utils/articleWritePermission";
import { externalLinkUrl } from "../../utils/externalLinkUrl";
import { formatContentQuota, getContentQuota } from "../../utils/contentQuota";
import "../manage/Articles/ArticleManagementPage.css";

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

export default function ProfileArticlesSection() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { config } = useSiteRuntime();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("published");
  const [notice, setNotice] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [markdownImportPending, setMarkdownImportPending] = useState(false);
  const [existingImportOpen, setExistingImportOpen] = useState(false);
  const [existingImportQuery, setExistingImportQuery] = useState("");
  const [existingImportArticles, setExistingImportArticles] = useState([]);
  const [existingImportPending, setExistingImportPending] = useState(false);
  const [existingImportLoading, setExistingImportLoading] = useState(false);
  const [existingImportError, setExistingImportError] = useState("");
  const [externalLink, setExternalLink] = useState(null);
  const [externalLinkExpiry, setExternalLinkExpiry] = useState("7d");
  const [externalLinkPassword, setExternalLinkPassword] = useState("");
  const [externalLinkPending, setExternalLinkPending] = useState(false);
  const [quotaCount, setQuotaCount] = useState(null);
  const markdownFileInputRef = useRef(null);
  const activeStatusRef = useRef("published");
  const writePermission = getArticleWritePermission(user, config);
  const translate = (key, fallback) => (t(key) === key ? fallback : t(key));
  const controller = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: (params, requestConfig) =>
      api.resources.listMyArticles(
        { ...params, status: activeStatusRef.current },
        requestConfig,
      ),
  });
  const externalLinkController = useTableController({
    initialPageSize: 20,
    initialSort: { key: "updated_at", direction: "desc" },
    fetchData: (params, requestConfig) =>
      api.resources.listMyArticleExternalLinks(params, requestConfig),
  });

  useEffect(() => {
    const requestController = new AbortController();
    Promise.all([
      api.resources.listMyArticles(
        { status: "published", page: 1, pageSize: 1 },
        { signal: requestController.signal },
      ),
      api.resources.listMyArticles(
        { status: "draft", page: 1, pageSize: 1 },
        { signal: requestController.signal },
      ),
    ])
      .then(([published, drafts]) => {
        if (!requestController.signal.aborted)
          setQuotaCount((published.total || 0) + (drafts.total || 0));
      })
      .catch(() => !requestController.signal.aborted && setQuotaCount(0));
    return () => requestController.abort();
  }, []);

  useEffect(() => {
    if (!existingImportOpen) return undefined;
    const requestController = new AbortController();
    const timer = setTimeout(async () => {
      setExistingImportLoading(true);
      setExistingImportError("");
      try {
        const result = await api.resources.listImportCandidates(
          { query: existingImportQuery, pageSize: 24 },
          { signal: requestController.signal },
        );
        setExistingImportArticles(result.items || []);
      } catch (error) {
        if (error.name !== "CanceledError" && error.name !== "AbortError")
          setExistingImportError(
            errorMessage(error, t("profile.articles.importLoadFailed")),
          );
      } finally {
        if (!requestController.signal.aborted) setExistingImportLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      requestController.abort();
    };
  }, [existingImportOpen, existingImportQuery, t]);

  function selectTab(tab) {
    if (tab === activeTab) return;
    activeStatusRef.current = tab === "drafts" ? "draft" : "published";
    setActiveTab(tab);
    void (tab === "external-links"
      ? externalLinkController.refresh()
      : controller.refresh());
  }

  async function openExternalLink(article) {
    try {
      const link = await api.resources.getMyArticleExternalLink(article.id);
      setExternalLink(link);
      setExternalLinkExpiry(link.url && !link.expiresAt ? "never" : "7d");
      setExternalLinkPassword(link.externalLinkPassword || "");
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          t("profile.articles.externalLinkLoadFailed"),
        ),
      });
    }
  }

  async function saveExternalLink(mode) {
    if (!externalLink) return;
    setExternalLinkPending(true);
    try {
      const link =
        mode === "remove"
          ? await api.resources.deleteMyArticleExternalLink(externalLink.id)
          : externalLink.token
            ? await api.resources.updateMyArticleExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              })
            : await api.resources.createMyArticleExternalLink(externalLink.id, {
                expiry: externalLinkExpiry,
                external_link_password: externalLinkPassword || null,
              });
      if (mode === "remove") {
        externalLinkController.removeRow((row) => row.id === externalLink.id);
        setExternalLink(null);
      } else {
        void externalLinkController.refresh();
        setExternalLink(link);
        setExternalLinkExpiry(link.url && !link.expiresAt ? "never" : "7d");
        setExternalLinkPassword(link.externalLinkPassword || "");
      }
      setNotice({
        type: "success",
        message: t(
          mode === "remove"
            ? "profile.articles.externalLinkRemoved"
            : "profile.articles.externalLinkSaved",
        ),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          t("profile.articles.externalLinkSaveFailed"),
        ),
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
        message: t("profile.articles.externalLinkCopied"),
      });
    } catch {
      setNotice({
        type: "error",
        message: t("profile.articles.externalLinkCopyFailed"),
      });
    }
  }

  async function deleteArticle() {
    if (!deleting?.slug) return;
    setDeletingPending(true);
    try {
      await (deleting.kind === "published"
        ? api.resources.deleteArticle(deleting.slug)
        : api.resources.deleteDraft(deleting.slug));
      controller.removeRow((row) => row.id === deleting.id);
      setQuotaCount((current) =>
        current === null ? current : Math.max(0, current - 1),
      );
      setDeleting(null);
      setNotice({ type: "success", message: t("profile.articles.deleted") });
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(error, t("profile.articles.deleteFailed")),
      });
    } finally {
      setDeletingPending(false);
    }
  }

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
      navigate(
        `/profile/articles/drafts/${encodeURIComponent(draft.slug)}/edit`,
      );
    } catch (error) {
      setExistingImportError(
        errorMessage(error, t("profile.articles.importFailed")),
      );
    } finally {
      setExistingImportPending(false);
    }
  }

  async function importMarkdownFile(event) {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) return;
    if (!/\.md$/i.test(file.name)) {
      setNotice({
        type: "error",
        message: t("profile.articles.markdownInvalidFile"),
      });
      return;
    }
    if (!file.size) {
      setNotice({
        type: "error",
        message: t("profile.articles.markdownEmptyFile"),
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
          message: t("profile.articles.markdownReadFailed"),
        });
        return;
      }
      const draft = await api.resources.createDraft(
        parseMarkdownArticle(
          content,
          file.name,
          t("profile.articles.markdownDefaultTitle"),
        ),
      );
      if (!draft?.slug) throw new Error(t("articleEditor.invalidSlug"));
      navigate(
        `/profile/articles/drafts/${encodeURIComponent(draft.slug)}/edit`,
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: errorMessage(
          error,
          t("profile.articles.markdownCreateFailed"),
        ),
      });
    } finally {
      setMarkdownImportPending(false);
    }
  }

  const columns = [
    {
      key: "title",
      title: t("profile.articles.columns.title"),
      canOrder: true,
      minWidth: 260,
      render: (row) => (
        <div className="managed-article-title">
          <strong>{row.title || t("profile.articles.untitled")}</strong>
          <small>/{row.slug}</small>
        </div>
      ),
    },
    activeTab === "published"
      ? {
          key: "visibility",
          title: t("profile.articles.columns.access"),
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
          title: t("profile.articles.columns.type"),
          canOrder: true,
          minWidth: 130,
          render: (row) => t(`profile.articles.${row.kind}`),
        },
    {
      key: "updated_at",
      title: t("profile.articles.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  const externalLinkColumns = [
    {
      key: "title",
      title: t("profile.articles.columns.title"),
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
      key: "expires_at",
      title: t("profile.articles.externalLinkExpiry"),
      canOrder: true,
      minWidth: 175,
      render: (row) =>
        row.expiresAt
          ? formatDate(row.expiresAt, lang)
          : t("profile.articles.neverExpires"),
    },
    {
      key: "status",
      title: t("profile.articles.externalLinkStatus"),
      minWidth: 110,
      render: (row) => (
        <span
          className={`managed-article-link-status managed-article-link-status--${row.status}`}
        >
          {t(`profile.articles.externalLinkStates.${row.status}`)}
        </span>
      ),
    },
    {
      key: "updated_at",
      title: t("profile.articles.columns.updated"),
      canOrder: true,
      minWidth: 175,
      render: (row) => formatDate(row.updatedAt, lang),
    },
  ];
  const quota = getContentQuota(user, config?.["content.article"]);
  return (
    <section className="profile-shell profile-articles-shell">
      <header className="profile-heading managed-articles-heading">
        <div>
          <span>{t("profile.workspace")}</span>
          <h1>{t("profile.articles.title")}</h1>
          <p>{t("profile.articles.description")}</p>
        </div>
        {writePermission.allowed ? (
          <div
            className="managed-article-create-menu"
            onMouseEnter={() => setCreateMenuOpen(true)}
            onMouseLeave={() => setCreateMenuOpen(false)}
            onFocus={() => setCreateMenuOpen(true)}
            onBlur={(event) =>
              !event.currentTarget.contains(event.relatedTarget) &&
              setCreateMenuOpen(false)
            }
          >
            <Button onClick={() => navigate("/profile/articles/new")}>
              {t("profile.articles.create")}
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
                {t("profile.articles.importExisting")}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={markdownImportPending}
                onClick={() => {
                  setCreateMenuOpen(false);
                  markdownFileInputRef.current?.click();
                }}
              >
                {markdownImportPending
                  ? t("profile.articles.markdownImporting")
                  : t("profile.articles.importMarkdown")}
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
        ) : null}
      </header>
      <div className="profile-content-tabbar">
        <div
          className="managed-articles-tabs"
          role="tablist"
          aria-label={t("profile.articles.tabsLabel")}
        >
          {["published", "drafts", "external-links"].map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : ""}
              onClick={() => selectTab(tab)}
            >
              {t(`profile.articles.tabs.${tab}`)}
            </button>
          ))}
        </div>
        <div className="profile-content-quota">
          {t("profile.articleQuota", {
            current: quotaCount ?? "-",
            maximum: formatContentQuota(quota),
          })}
        </div>
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
                  t("profile.articles.externalLinkLoadFailed"),
                )}
              </span>
            ) : null
          }
          empty={<span>{t("profile.articles.emptyExternalLinks")}</span>}
          searchText={externalLinkController.searchText}
          onSearchTextChange={externalLinkController.setSearchText}
          onSearchEnter={externalLinkController.submitSearch}
          searchPlaceholderText={t(
            "profile.articles.externalLinkSearchPlaceholder",
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
                  label: t("profile.articles.editExternalLink"),
                  onClick: () => {
                    setExternalLink(row);
                    setExternalLinkExpiry(
                      row.url && !row.expiresAt ? "never" : "7d",
                    );
                  },
                },
              ],
            },
            {
              group: 2,
              children: [
                {
                  key: "remove",
                  label: t("profile.articles.removeExternalLink"),
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
                  t("profile.articles.loadFailed"),
                )}
              </span>
            ) : null
          }
          empty={
            <span>
              {t(
                activeTab === "published"
                  ? "profile.articles.emptyPublished"
                  : "profile.articles.emptyDrafts",
              )}
            </span>
          }
          searchText={controller.searchText}
          onSearchTextChange={controller.setSearchText}
          onSearchEnter={controller.submitSearch}
          searchPlaceholderText={t("profile.articles.searchPlaceholder")}
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
                  label: t("profile.articles.browse"),
                  onClick: () =>
                    navigate(
                      row.kind === "published"
                        ? `/articles/${row.slug}`
                        : `/drafts/${row.slug}`,
                    ),
                },
                ...(writePermission.allowed
                  ? [
                      {
                        key: "edit",
                        label: t("profile.articles.edit"),
                        onClick: () =>
                          navigate(
                            row.kind === "published"
                              ? `/profile/articles/${row.slug}/edit`
                              : `/profile/articles/drafts/${row.slug}/edit`,
                          ),
                      },
                    ]
                  : []),
                ...(row.kind === "published" && row.visibility === "public"
                  ? [
                      {
                        key: "share",
                        label: t("profile.articles.share"),
                        onClick: () => void openExternalLink(row),
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
                  label: t("profile.articles.delete"),
                  danger: true,
                  onClick: () => setDeleting(row),
                },
              ],
            },
          ]}
        />
      )}
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        kicker={t("profile.articles.danger")}
        title={t("profile.articles.deleteTitle")}
        tone="danger"
        actions={[
          {
            key: "cancel",
            label: t("profile.articles.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "delete",
            label: t("profile.articles.delete"),
            variant: "danger",
            loading: deletingPending,
            onClick: deleteArticle,
          },
        ]}
      >
        <p>
          {t("profile.articles.deleteDescription", {
            title: deleting?.title || "",
          })}
        </p>
      </Modal>
      <Modal
        open={existingImportOpen}
        onOpenChange={setExistingImportOpen}
        size="wide"
        kicker={t("profile.articles.importExisting")}
        title={t("profile.articles.importTitle")}
        actions={[
          {
            key: "cancel",
            label: t("profile.articles.cancel"),
            variant: "secondary",
            disabled: existingImportPending,
            onClick: ({ close }) => close(),
          },
        ]}
      >
        <div className="managed-article-import">
          <label>
            {t("profile.articles.importSearchLabel")}
            <input
              autoFocus
              value={existingImportQuery}
              placeholder={t("profile.articles.importSearchPlaceholder")}
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
              {t("profile.articles.importLoading")}
            </p>
          ) : null}
          {!existingImportLoading &&
          !existingImportError &&
          !existingImportArticles.length ? (
            <p className="managed-article-import__state">
              {t("profile.articles.importEmpty")}
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
        prefix="profile.articles"
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
