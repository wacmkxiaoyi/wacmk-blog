import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ArticleCard from "../../../components/article-card/ArticleCard";
import Button from "../../../components/ui/Button";
import useI18n from "../../../hooks/useI18n";
import useResourceAccess from "../../../hooks/useResourceAccess";
import api from "../../../api";
import ContentPagination from "../content-list/ContentPagination";
import "../content-list/ContentList.css";

const PAGE_SIZE = 12;

export default function ArticlesPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { authorizeResource } = useResourceAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
  const tag = searchParams.get("tag")?.trim() || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const cursor = Math.max(0, Number(searchParams.get("cursor")) || 0);
  const cursorHistory = useRef([0]);
  const previousQuery = useRef(query);
  const [state, setState] = useState({
    status: "loading",
    items: [],
    totalPages: 0,
    page,
    hasMore: false,
  });

  useEffect(() => {
    if (previousQuery.current !== query) {
      cursorHistory.current = [0];
      previousQuery.current = query;
    }
    const controller = new AbortController();
    setState((current) => ({ ...current, status: "loading" }));
    const params = query
      ? { query, tag, cursor, pageSize: PAGE_SIZE }
      : { tag, page, pageSize: PAGE_SIZE, sort: "starred" };
    api.resources
      .listArticles(params, { signal: controller.signal })
      .then(
        (data) =>
          !controller.signal.aborted &&
          setState({
            status: "ready",
            items: data.items || [],
            totalPages: data.totalPages || 0,
            page: query
              ? Math.max(1, cursorHistory.current.indexOf(cursor) + 1)
              : data.page || page,
            hasMore: Boolean(data.hasMore),
            nextCursor: data.nextCursor,
          }),
      )
      .catch(
        () =>
          !controller.signal.aborted &&
          setState({
            status: "error",
            items: [],
            totalPages: 0,
            page,
            hasMore: false,
          }),
      );
    return () => controller.abort();
  }, [page, query, tag, cursor]);

  function updatePage(nextPage) {
    const next = new URLSearchParams(searchParams);
    if (query) {
      const currentIndex = cursorHistory.current.indexOf(cursor);
      const nextCursor =
        nextPage > state.page
          ? state.nextCursor
          : cursorHistory.current[currentIndex - 1];
      if (nextCursor == null) return;
      if (nextPage > state.page)
        cursorHistory.current = [
          ...cursorHistory.current.slice(0, currentIndex + 1),
          nextCursor,
        ];
      next.set("cursor", String(nextCursor));
      next.delete("page");
      setSearchParams(next);
      return;
    }
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
  }
  function retry() {
    updatePage(page);
  }
  function selectTag(selectedTag) {
    cursorHistory.current = [0];
    setSearchParams({ tag: selectedTag.name });
  }
  function clearContext() {
    cursorHistory.current = [0];
    setSearchParams({});
  }
  async function openArticle(article) {
    if (
      await authorizeResource({
        type: "article",
        id: article.id,
        name: article.title,
        context: { inBook: false },
      })
    )
      navigate(`/articles/${article.slug}`);
  }
  async function updateInteraction(article, action, value) {
    try {
      const result =
        action === "star"
          ? await api.resources.setArticleStar(article.slug, value)
          : await api.resources.setArticleVote(article.slug, value);
      setState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === article.id
            ? { ...item, interaction: result.interaction }
            : item,
        ),
      }));
    } catch {
      /* The server remains the source of truth; a refresh restores stale card state. */
    }
  }
  const emptyTitle =
    query || tag ? t("articles.noResults") : t("articles.emptyTitle");
  const emptyDescription =
    query || tag
      ? t("articles.noResultsDescription")
      : t("articles.emptyDescription");
  const contextLabel = tag
    ? t("articles.tagResults", { tag })
    : query
      ? t("articles.searchResults", { query })
      : null;
  return (
    <main className="content-list">
      <section
        className="content-list__panel"
        aria-labelledby="articles-page-title"
      >
        <header>
          <h1 id="articles-page-title">{t("articles.title")}</h1>
        </header>
        {contextLabel ? (
          <div className="content-list__context">
            <strong>{contextLabel}</strong>
            <button
              type="button"
              className="content-list__clear-context"
              onClick={clearContext}
            >
              {t("articles.clearFilters")}
            </button>
          </div>
        ) : null}
        {state.status === "loading" ? (
          <div className="content-list__status" role="status">
            {t("articles.loading")}
          </div>
        ) : null}
        {state.status === "error" ? (
          <div
            className="content-list__status content-list__status--error"
            role="alert"
          >
            <strong>{t("articles.loadFailed")}</strong>
            <Button variant="secondary" onClick={retry}>
              {t("articles.retry")}
            </Button>
          </div>
        ) : null}
        {state.status === "ready" && !state.items.length ? (
          <div className="content-list__status">
            <strong>{emptyTitle}</strong>
            <p>{emptyDescription}</p>
          </div>
        ) : null}
        {state.status === "ready" && state.items.length ? (
          <>
            <div className="content-list__articles">
              {state.items.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={openArticle}
                  onTagClick={selectTag}
                  onStarChange={(item, starred) =>
                    updateInteraction(item, "star", starred)
                  }
                  onVoteChange={(item, vote) =>
                    updateInteraction(item, "vote", vote)
                  }
                />
              ))}
            </div>
            {!query ? (
              <ContentPagination
                page={state.page}
                totalPages={state.totalPages}
                onPageChange={updatePage}
                t={t}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
