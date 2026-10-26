import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArticleCard from "../../../components/article-card/ArticleCard";
import BookCard from "../../../components/book-card/BookCard";
import Button from "../../../components/ui/Button";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import useResourceAccess from "../../../hooks/useResourceAccess";
import api from "../../../api";
import "./HomePage.css";

const ARTICLE_LIMIT = 6;
const BOOK_LIMIT = 4;

function HomeIcon({ name }) {
  const paths = {
    articles: (
      <>
        <path d="M6 3.5h9.5A2.5 2.5 0 0 1 18 6v14H8A2 2 0 0 1 6 18V3.5Z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    tags: (
      <>
        <path d="M3.5 12.5V5.8c0-1.27 1.03-2.3 2.3-2.3h6.7l8 8-7.9 8a2.3 2.3 0 0 1-3.25 0l-5.18-5.18a2.3 2.3 0 0 1-.67-1.82Z" />
        <circle cx="8.2" cy="8.2" r="1" />
      </>
    ),
    books: (
      <>
        <path d="M4 5.8c2.45-.9 5.16-.45 8 1.45v12.1c-2.84-1.9-5.55-2.35-8-1.45V5.8Z" />
        <path d="M20 5.8c-2.45-.9-5.16-.45-8 1.45v12.1c2.84-1.9 5.55-2.35 8-1.45V5.8Z" />
      </>
    ),
    attachments: (
      <>
        <path d="m15.5 6.5-7.8 7.8a3.5 3.5 0 1 0 4.95 4.95l8.15-8.15a5 5 0 0 0-7.07-7.07L5.2 12.55" />
      </>
    ),
    authors: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.7 20a7.3 7.3 0 0 1 14.6 0" />
      </>
    ),
  };
  return (
    <svg
      className="home-stat__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function TrendChart({ trend, lang, t }) {
  const maximum = Math.max(
    1,
    ...trend.flatMap((item) => [item.articles, item.books]),
  );
  const formatter = new Intl.DateTimeFormat(
    lang.startsWith("zh") ? "zh-CN" : "en-US",
    { month: "numeric", day: "numeric" },
  );
  const description = trend
    .map((item) =>
      t("home.trendSummary", {
        date: formatter.format(new Date(`${item.date}T00:00:00`)),
        articles: item.articles,
        books: item.books,
      }),
    )
    .join("; ");
  return (
    <div
      className="home-trend"
      role="img"
      aria-label={t("home.trendAria", { summary: description })}
    >
      <div className="home-trend__plot">
        {trend.map((item) => (
          <div className="home-trend__day" key={item.date}>
            <div className="home-trend__bars">
              <span
                className="home-trend__bar home-trend__bar--articles"
                style={{
                  height: `${item.articles ? Math.max(8, (item.articles / maximum) * 100) : 0}%`,
                }}
                title={t("home.articleVisitsOn", {
                  date: formatter.format(new Date(`${item.date}T00:00:00`)),
                  count: item.articles,
                })}
              />
              <span
                className="home-trend__bar home-trend__bar--books"
                style={{
                  height: `${item.books ? Math.max(8, (item.books / maximum) * 100) : 0}%`,
                }}
                title={t("home.bookVisitsOn", {
                  date: formatter.format(new Date(`${item.date}T00:00:00`)),
                  count: item.books,
                })}
              />
            </div>
            <time dateTime={item.date}>
              {formatter.format(new Date(`${item.date}T00:00:00`))}
            </time>
          </div>
        ))}
      </div>
      <div className="home-trend__legend" aria-hidden="true">
        <span>
          <i className="home-trend__key home-trend__key--articles" />
          {t("home.articleVisits")}
        </span>
        <span>
          <i className="home-trend__key home-trend__key--books" />
          {t("home.bookVisits")}
        </span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { authorizeResource } = useResourceAccess();
  const [state, setState] = useState({
    status: "loading",
    dashboard: null,
    articles: [],
    books: [],
  });
  const displayName =
    user?.display_name || user?.first_name || user?.username || "";

  const load = useCallback(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: "loading" }));
    const config = { signal: controller.signal };
    Promise.all([
      api.dashboard.getHome(config),
      api.resources.listArticles(
        { page: 1, pageSize: ARTICLE_LIMIT, sort: "starred" },
        config,
      ),
      api.resources.listBooks(
        { page: 1, pageSize: BOOK_LIMIT, sort: "starred" },
        config,
      ),
    ])
      .then(
        ([dashboard, articles, books]) =>
          !controller.signal.aborted &&
          setState({
            status: "ready",
            dashboard,
            articles: articles.items || [],
            books: books.items || [],
          }),
      )
      .catch(
        () =>
          !controller.signal.aborted &&
          setState({
            status: "error",
            dashboard: null,
            articles: [],
            books: [],
          }),
      );
    return () => controller.abort();
  }, []);

  useEffect(load, [load]);

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
  async function updateInteraction(item, action, value) {
    try {
      const result =
        action === "article-star"
          ? await api.resources.setArticleStar(item.slug, value)
          : action === "article-vote"
            ? await api.resources.setArticleVote(item.slug, value)
            : action === "book-star"
              ? await api.resources.setBookStar(item.slug, value)
              : await api.resources.setBookVote(item.slug, value);
      const collection = action.startsWith("article") ? "articles" : "books";
      setState((current) => ({
        ...current,
        [collection]: current[collection].map((entry) =>
          entry.id === item.id
            ? { ...entry, interaction: result.interaction }
            : entry,
        ),
      }));
    } catch {
      /* A later reload restores the server-authoritative interaction state. */
    }
  }

  const statItems = state.dashboard
    ? [
        ["articles", "articles", state.dashboard.stats.articles],
        ["tags", "tags", state.dashboard.stats.tags],
        ["books", "books", state.dashboard.stats.books],
        ["attachments", "attachments", state.dashboard.stats.attachments],
        ["authors", "authors", state.dashboard.stats.authors],
      ]
    : [];
  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <h1 id="home-title">
            {t("home.welcome", { username: displayName })}
          </h1>
          <a className="home-hero__link" href="#latest-published-posts">
            {t("home.exploreArticles")}
          </a>
        </div>
        {state.status === "ready" ? (
          <div className="home-visit-stack">
            <div>
              <strong>{state.dashboard.visits.articles}</strong>
              <span>
                {t("home.articleVisits", { days: state.dashboard.visits.days })}
              </span>
            </div>
            <div>
              <strong>{state.dashboard.visits.books}</strong>
              <span>
                {t("home.bookVisits", { days: state.dashboard.visits.days })}
              </span>
            </div>
          </div>
        ) : null}
      </section>
      {state.status === "loading" ? (
        <section className="home-status" role="status">
          {t("home.loading")}
        </section>
      ) : null}
      {state.status === "error" ? (
        <section className="home-status home-status--error" role="alert">
          <strong>{t("home.loadFailed")}</strong>
          <Button variant="secondary" onClick={() => load()}>
            {t("home.retry")}
          </Button>
        </section>
      ) : null}
      {state.status === "ready" ? (
        <>
          <section className="home-stats" aria-label={t("home.statsLabel")}>
            {statItems.map(([key, icon, value]) => (
              <div className="home-stat" key={key}>
                <HomeIcon name={icon} />
                <span>{t(`home.stats.${key}`)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <section className="home-panel">
            <header className="home-section-heading">
              <div>
                <h2>
                  {t("home.trendTitle", { days: state.dashboard.visits.days })}
                </h2>
              </div>
            </header>
            <TrendChart trend={state.dashboard.trend} lang={lang} t={t} />
          </section>
          <section
            className="home-content"
            id="latest-published-posts"
            tabIndex="-1"
            aria-labelledby="latest-articles-title"
          >
            <header className="home-section-heading">
              <div>
                <h2 id="latest-articles-title">{t("home.latestArticles")}</h2>
              </div>
              <Button variant="secondary" onClick={() => navigate("/articles")}>
                {t("home.viewAllArticles")}
              </Button>
            </header>
            {state.articles.length ? (
              <div className="home-articles">
                {state.articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={openArticle}
                    onTagClick={(tag) =>
                      navigate(`/articles?tag=${encodeURIComponent(tag.name)}`)
                    }
                    onStarChange={(item, value) =>
                      updateInteraction(item, "article-star", value)
                    }
                    onVoteChange={(item, value) =>
                      updateInteraction(item, "article-vote", value)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="home-empty">{t("home.articlesEmpty")}</p>
            )}
          </section>
          <section
            className="home-content"
            aria-labelledby="latest-books-title"
          >
            <header className="home-section-heading">
              <div>
                <h2 id="latest-books-title">{t("home.latestBooks")}</h2>
              </div>
              <Button variant="secondary" onClick={() => navigate("/books")}>
                {t("home.viewAllBooks")}
              </Button>
            </header>
            {state.books.length ? (
              <div className="home-books">
                {state.books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onClick={openBook}
                    onStarChange={(item, value) =>
                      updateInteraction(item, "book-star", value)
                    }
                    onVoteChange={(item, value) =>
                      updateInteraction(item, "book-vote", value)
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="home-empty">{t("home.booksEmpty")}</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
