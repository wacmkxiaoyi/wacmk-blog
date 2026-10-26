import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BookCard from "../../../components/book-card/BookCard";
import Button from "../../../components/ui/Button";
import useI18n from "../../../hooks/useI18n";
import useResourceAccess from "../../../hooks/useResourceAccess";
import api from "../../../api";
import ContentPagination from "../content-list/ContentPagination";
import "../content-list/ContentList.css";

const PAGE_SIZE = 12;

export default function BooksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { authorizeResource } = useResourceAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query")?.trim() || "";
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
      ? { query, cursor, pageSize: PAGE_SIZE }
      : { page, pageSize: PAGE_SIZE, sort: "starred" };
    api.resources
      .listBooks(params, { signal: controller.signal })
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
  }, [page, query, cursor]);
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
  function clearContext() {
    cursorHistory.current = [0];
    setSearchParams({});
  }
  async function openBook(book) {
    if (
      await authorizeResource({
        type: "book",
        id: book.id,
        name: book.name,
        context: { inBook: false },
      })
    )
      navigate(`/books/${book.slug}`);
  }
  async function updateInteraction(book, action, value) {
    try {
      const result =
        action === "star"
          ? await api.resources.setBookStar(book.slug, value)
          : await api.resources.setBookVote(book.slug, value);
      setState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === book.id
            ? { ...item, interaction: result.interaction }
            : item,
        ),
      }));
    } catch {}
  }
  return (
    <main className="content-list">
      <section
        className="content-list__panel"
        aria-labelledby="books-page-title"
      >
        <header>
          <h1 id="books-page-title">{t("books.title")}</h1>
        </header>
        {query ? (
          <div className="content-list__context">
            <strong>{t("books.searchResults", { query })}</strong>
            <button
              type="button"
              className="content-list__clear-context"
              onClick={clearContext}
            >
              {t("books.clearFilters")}
            </button>
          </div>
        ) : null}
        {state.status === "loading" ? (
          <div className="content-list__status" role="status">
            {t("books.loading")}
          </div>
        ) : null}
        {state.status === "error" ? (
          <div
            className="content-list__status content-list__status--error"
            role="alert"
          >
            <strong>{t("books.loadFailed")}</strong>
            <Button variant="secondary" onClick={() => updatePage(page)}>
              {t("books.retry")}
            </Button>
          </div>
        ) : null}
        {state.status === "ready" && !state.items.length ? (
          <div className="content-list__status">
            <strong>
              {query ? t("books.noResults") : t("books.emptyTitle")}
            </strong>
            <p>
              {query
                ? t("books.noResultsDescription")
                : t("books.emptyDescription")}
            </p>
          </div>
        ) : null}
        {state.status === "ready" && state.items.length ? (
          <>
            <div className="content-list__books">
              {state.items.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onClick={openBook}
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
