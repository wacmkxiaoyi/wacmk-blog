import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ArticleTag from "../../../components/article-tag/ArticleTag";
import Button from "../../../components/ui/Button";
import useI18n from "../../../hooks/useI18n";
import api from "../../../api";
import "./TagsPage.css";

export default function TagsPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("query")?.trim() || "";
  const [state, setState] = useState({ status: "loading", items: [] });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", items: [] });
    api.tags
      .list({ query }, { signal: controller.signal })
      .then(
        (data) =>
          !controller.signal.aborted &&
          setState({ status: "ready", items: data.items || [] }),
      )
      .catch(
        () =>
          !controller.signal.aborted &&
          setState({ status: "error", items: [] }),
      );
    return () => controller.abort();
  }, [query]);

  function retry() {
    setState({ status: "loading", items: [] });
    api.tags
      .list({ query })
      .then((data) => setState({ status: "ready", items: data.items || [] }))
      .catch(() => setState({ status: "error", items: [] }));
  }

  const emptyTitle = query ? t("tags.noSearchResults") : t("tags.emptyTitle");

  return (
    <main className="tags-page">
      <section className="tags-page__panel" aria-labelledby="tags-page-title">
        <h1 id="tags-page-title">{t("tags.title")}</h1>

        {state.status === "loading" ? (
          <div className="tags-page__status" role="status">
            {t("tags.loading")}
          </div>
        ) : null}
        {state.status === "error" ? (
          <div
            className="tags-page__status tags-page__status--error"
            role="alert"
          >
            <strong>{t("tags.loadFailed")}</strong>
            <Button variant="secondary" onClick={retry}>
              {t("tags.retry")}
            </Button>
          </div>
        ) : null}
        {state.status === "ready" && state.items.length === 0 ? (
          <div className="tags-page__status tags-page__status--empty">
            <strong>{emptyTitle}</strong>
            <p>{query ? t("tags.noSearchResultsTip") : t("tags.emptyTip")}</p>
          </div>
        ) : null}
        {state.status === "ready" && state.items.length > 0 ? (
          <div
            className="tags-page__directory"
            aria-label={t("tags.directoryLabel")}
          >
            {state.items.map((tag) => (
              <ArticleTag
                key={tag.id || tag.name}
                tag={tag}
                onClick={() =>
                  navigate(`/articles?tag=${encodeURIComponent(tag.name)}`)
                }
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
