import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../../api";
import ArticleCard from "../../../components/article-card/ArticleCard";
import AttachmentAccessPolicy, {
  hasValidAccessPolicy,
} from "../../../components/attachment-manager/AttachmentAccessPolicy";
import AccessTag from "../../../components/access-tag/AccessTag";
import { getResourceAccessChannels } from "../../../components/access-tag/resourceAccessTags";
import ArticleCoverField from "../../../features/article-editor/ArticleCoverField";
import useI18n from "../../../hooks/useI18n";
import useAuth from "../../../hooks/useAuth";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import { Modal } from "../../../packages/modal";
import { CatalogManager } from "../../../packages/catalog-manager";
import {
  bookStructureToCatalog,
  catalogToBookStructure,
} from "../../../utils/bookStructure";
import { getBookWritePermission } from "../../../utils/bookWritePermission";
import ManageSidebar from "../ManageSidebar";
import ProfileSidebar from "../../profile/ProfileSidebar";
import "../Basic/BasicSettingsPage.css";
import "./BookEditorPage.css";

const emptyPolicy = {
  visibility: "public",
  condition_rules: [],
  access_scope: "unified",
  vip_access_permission: "public",
  vip_condition_rules: [],
};

function errorMessage(error, fallback) {
  const data = error.response?.data;
  if (data && typeof data === "object")
    return data.detail || Object.values(data).flat().join(" ") || fallback;
  return error.message || fallback;
}

async function loadSavedChapterArticles(articleIds) {
  if (!articleIds.length) return [];

  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await api.resources.listArticles({
      ids: articleIds.join(","),
      page,
      pageSize: 50,
    });
    items.push(...(result.items || []));
    totalPages = result.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return items;
}

function AddArticleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M12 12v5M9.5 14.5h5" />
    </svg>
  );
}

export default function BookEditorPage({ profile = false }) {
  const { slug } = useParams();
  const editing = Boolean(slug);
  const { t } = useI18n();
  const { user } = useAuth();
  const { config } = useSiteRuntime();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: "",
    slug: "",
    abstract: "",
    structure: [],
    ...emptyPolicy,
  });
  const [catalog, setCatalog] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picker, setPicker] = useState({
    items: [],
    total: 0,
    page: 1,
    loading: false,
    error: "",
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [ownedBookCount, setOwnedBookCount] = useState(null);

  useEffect(() => {
    if (!profile) return undefined;
    const controller = new AbortController();
    api.resources
      .listMyBooks({ page: 1, pageSize: 1 }, { signal: controller.signal })
      .then(
        (result) =>
          !controller.signal.aborted && setOwnedBookCount(result.total || 0),
      )
      .catch(() => !controller.signal.aborted && setOwnedBookCount(0));
    return () => controller.abort();
  }, [profile]);

  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    (profile ? api.resources.getBook(slug) : api.manage.getBook(slug))
      .then(async (book) => {
        if (cancelled) return;
        const articleIds = [];
        const collectIds = (nodes) =>
          (nodes || []).forEach((node) => {
            if (node?.type === "article") articleIds.push(node.article_id);
            if (node?.type === "group") collectIds(node.children);
          });
        collectIds(book.structure);
        const articles = await loadSavedChapterArticles(articleIds);
        if (cancelled) return;
        setValues({
          name: book.name || "",
          slug: book.slug || "",
          abstract: book.abstract || "",
          structure: book.structure || [],
          visibility: book.visibility || "public",
          condition_rules: book.condition_rules || [],
          access_scope: book.access_scope || "unified",
          vip_access_permission: book.vip_access_permission || "public",
          vip_condition_rules: book.vip_condition_rules || [],
          coverUrl: book.coverUrl || "",
        });
        setCatalog(bookStructureToCatalog(book.structure || [], articles));
      })
      .catch(
        (requestError) =>
          !cancelled &&
          setError(errorMessage(requestError, t("admin.books.loadFailed"))),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [editing, slug, t]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPicker((current) => ({ ...current, loading: true, error: "" }));
      try {
        const result = await (
          profile
            ? api.resources.listReferenceCandidates
            : api.manage.listArticles
        )(
          {
            query,
            page: picker.page,
            pageSize: 24,
            sortKey: "updated_at",
            sortDirection: "desc",
            status: "published",
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted)
          setPicker((current) => ({
            ...current,
            items: result.items || [],
            total: result.total || 0,
            loading: false,
            error: "",
          }));
      } catch (requestError) {
        if (!controller.signal.aborted)
          setPicker((current) => ({
            ...current,
            loading: false,
            error: errorMessage(
              requestError,
              t("admin.books.articlePickerLoadFailed"),
            ),
          }));
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pickerOpen, query, picker.page, t]);

  const existingIds = new Set(
    catalogToBookStructure(catalog).flatMap(function collect(node) {
      return node.type === "article"
        ? [node.article_id]
        : node.children.flatMap(collect);
    }),
  );
  const addArticleTool = [
    {
      key: "book.add-articles",
      name: t("admin.books.addArticles"),
      icon: <AddArticleIcon />,
      group: 1,
      order: 1,
      onClick: () => {
        setSelectedIds(new Set());
        setQuery("");
        setPickerOpen(true);
      },
    },
  ];
  const catalogTranslate = (key, fallback) => {
    const translated = t(
      key === "catalog.rename" ? "catalog.renameAction" : key,
    );
    return translated ===
      (key === "catalog.rename" ? "catalog.renameAction" : key)
      ? fallback
      : translated;
  };

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  function renderCatalogArticle(article) {
    return (
      <span className="book-editor__catalog-article">
        <strong>{article.title}</strong>
        <span>
          {getResourceAccessChannels(article).map((channel, index) => (
            <AccessTag
              key={`${channel.isVIP ? "vip" : "common"}-${index}`}
              {...channel}
              iconOnly
            />
          ))}
        </span>
      </span>
    );
  }
  function toggleArticle(article) {
    if (existingIds.has(article.id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(article.id) ? next.delete(article.id) : next.add(article.id);
      return next;
    });
  }
  function addSelectedArticles() {
    const selected = picker.items.filter(
      (article) => selectedIds.has(article.id) && !existingIds.has(article.id),
    );
    setCatalog((current) => [...current, ...selected]);
    setPickerOpen(false);
  }
  async function save(event) {
    event.preventDefault();
    if (!values.name.trim()) {
      setError(t("admin.books.nameRequired"));
      return;
    }
    if (!hasValidAccessPolicy(values)) {
      setError(t("contentTemplate.editor.conditionRequired"));
      return;
    }
    const structure = catalogToBookStructure(catalog);
    if (
      !structure.some(function hasArticle(node) {
        return node.type === "article" || node.children.some(hasArticle);
      })
    ) {
      setError(t("admin.books.articleRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...values,
        name: values.name.trim(),
        slug: values.slug.trim(),
        abstract: values.abstract.trim(),
        structure,
        remove_cover: removeCover,
      };
      const book = editing
        ? await (profile ? api.resources.updateBook : api.manage.updateBook)(
            slug,
            payload,
            coverFile,
          )
        : await (profile ? api.resources.createBook : api.manage.createBook)(
            payload,
            coverFile,
          );
      setNotice({
        type: "success",
        message: t(editing ? "admin.books.updated" : "admin.books.created"),
      });
      navigate(profile ? "/profile?section=books" : "/manage/books", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        errorMessage(
          requestError,
          t(editing ? "admin.books.updateFailed" : "admin.books.createFailed"),
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  const writePermission = getBookWritePermission(user, config, ownedBookCount);
  if (profile && (ownedBookCount === null || !writePermission.allowed))
    return (
      <section className="profile-shell">
        <p className="profile-articles-restricted">
          {ownedBookCount === null
            ? t("admin.books.loading")
            : t(`profile.books.restrictions.${writePermission.reason}`)}
        </p>
      </section>
    );
  const sidebar = profile ? (
    <ProfileSidebar
      activeSection="books"
      onSectionChange={(section) =>
        navigate(
          section === "basic"
            ? "/profile"
            : `/profile?section=${encodeURIComponent(section)}`,
        )
      }
    />
  ) : (
    <ManageSidebar active="books" />
  );
  if (loading)
    return (
      <main className={profile ? "profile-page" : "manage-page"}>
        {sidebar}
        <section className={profile ? "profile-content" : "manage-content"}>
          <div className="settings-shell">
            <p>{t("admin.books.loading")}</p>
          </div>
        </section>
      </main>
    );

  const totalPages = Math.max(1, Math.ceil(picker.total / 24));
  return (
    <main className={profile ? "profile-page" : "manage-page"}>
      {sidebar}
      <section className={profile ? "profile-content" : "manage-content"}>
        <form className="settings-shell book-editor" onSubmit={save}>
          <header className="book-editor__heading">
            <span>{t("admin.books.kicker")}</span>
            <h1>
              {t(editing ? "admin.books.editTitle" : "admin.books.createTitle")}
            </h1>
          </header>
          {error ? (
            <p className="book-editor__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="book-editor__field">
            <label>{t("admin.books.fields.name")}</label>
            <input
              value={values.name}
              maxLength="64"
              onChange={(event) => update("name", event.target.value)}
              required
            />
          </div>
          <div className="book-editor__split">
            <ArticleCoverField
              label={t("admin.books.fields.cover")}
              replaceLabel={t("admin.books.replaceCover")}
              removeLabel={t("admin.books.removeCover")}
              undoLabel={t("admin.books.undoRemoveCover")}
              emptyLabel={t("admin.books.emptyCover")}
              value={values.coverUrl}
              file={coverFile}
              remove={removeCover}
              disabled={saving}
              onFileChange={setCoverFile}
              onRemoveChange={setRemoveCover}
            />
            <div className="book-editor__details">
              <div className="book-editor__field">
                <label>
                  {t("admin.books.fields.slug")}{" "}
                  <small>({t("admin.books.slugHelp")})</small>
                </label>
                <input
                  value={values.slug}
                  maxLength="80"
                  placeholder={t("admin.books.slugPlaceholder")}
                  onChange={(event) => update("slug", event.target.value)}
                />
              </div>
              <div className="book-editor__field">
                <label>{t("admin.books.fields.abstract")}</label>
                <textarea
                  value={values.abstract}
                  rows="3"
                  onChange={(event) => update("abstract", event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="book-editor__divider" />
          <section className="book-editor__access">
            <h2>{t("admin.books.accessTitle")}</h2>
            <AttachmentAccessPolicy
              t={t}
              value={values}
              onChange={(policy) =>
                setValues((current) => ({ ...current, ...policy }))
              }
              vipPermissionLabel={t("admin.books.vipVisibility")}
            />
          </section>
          <div className="book-editor__divider" />
          <section className="book-editor__catalog">
            <div>
              <h2>{t("admin.books.catalogTitle")}</h2>
              <p>{t("admin.books.catalogDescription")}</p>
            </div>
            <CatalogManager
              value={catalog}
              onChange={setCatalog}
              tools={addArticleTool}
              renderItem={renderCatalogArticle}
              translate={catalogTranslate}
            />
          </section>
          <footer className="book-editor__footer">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() =>
                navigate(profile ? "/profile?section=books" : "/manage/books")
              }
            >
              {t("admin.books.back")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("admin.books.save")}
            </Button>
          </footer>
        </form>
      </section>
      <Modal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        size="wide"
        kicker={t("admin.books.catalogTitle")}
        title={t("admin.books.articlePickerTitle")}
        actions={[
          {
            key: "cancel",
            label: t("admin.books.cancel"),
            variant: "secondary",
            onClick: ({ close }) => close(),
          },
          {
            key: "add",
            label: t("admin.books.addSelected", { count: selectedIds.size }),
            disabled: !selectedIds.size,
            onClick: addSelectedArticles,
          },
        ]}
      >
        <div className="book-editor__picker">
          <label>
            {t("admin.books.articlePickerSearch")}
            <input
              autoFocus
              value={query}
              placeholder={t("admin.books.articlePickerPlaceholder")}
              onChange={(event) => {
                setQuery(event.target.value);
                setPicker((current) => ({ ...current, page: 1 }));
              }}
            />
          </label>
          {picker.error ? (
            <p className="book-editor__error">{picker.error}</p>
          ) : null}
          {picker.loading ? (
            <p>{t("admin.books.articlePickerLoading")}</p>
          ) : null}
          {!picker.loading && !picker.error && !picker.items.length ? (
            <p>{t("admin.books.articlePickerEmpty")}</p>
          ) : null}
          <div className="book-editor__picker-grid">
            {picker.items.map((article) => {
              const added = existingIds.has(article.id);
              const selected = selectedIds.has(article.id);
              return (
                <div
                  key={article.id}
                  className={[
                    "book-editor__picker-card",
                    selected && "is-selected",
                    added && "is-added",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {added || selected ? (
                    <span className="book-editor__picker-status">
                      {t(added ? "admin.books.added" : "admin.books.selected")}
                    </span>
                  ) : null}
                  <ArticleCard
                    article={article}
                    showTags
                    onClick={added ? undefined : () => toggleArticle(article)}
                  />
                </div>
              );
            })}
          </div>
          {picker.total > 24 ? (
            <div className="book-editor__picker-pagination">
              <Button
                variant="secondary"
                disabled={picker.page === 1 || picker.loading}
                onClick={() =>
                  setPicker((current) => ({
                    ...current,
                    page: current.page - 1,
                  }))
                }
              >
                {t("table.pagination.previous")}
              </Button>
              <span>
                {t("table.pagination.pageStatus", {
                  current: picker.page,
                  total: totalPages,
                })}
              </span>
              <Button
                variant="secondary"
                disabled={picker.page === totalPages || picker.loading}
                onClick={() =>
                  setPicker((current) => ({
                    ...current,
                    page: current.page + 1,
                  }))
                }
              >
                {t("table.pagination.next")}
              </Button>
            </div>
          ) : null}
        </div>
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
