import { Card } from "../../packages/card";
import useI18n from "../../hooks/useI18n";
import AccessTag from "../access-tag/AccessTag";
import { getResourceAccessChannels } from "../access-tag/resourceAccessTags";
import "./BookCard.css";

function formatDate(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(
    language.startsWith("zh") ? "zh-CN" : "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

function BookIcon() {
  return (
    <svg
      className="book-card__placeholder-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.8c2.45-.9 5.16-.45 8 1.45v12.1c-2.84-1.9-5.55-2.35-8-1.45V5.8Z" />
      <path d="M20 5.8c-2.45-.9-5.16-.45-8 1.45v12.1c2.84-1.9 5.55-2.35 8-1.45V5.8Z" />
    </svg>
  );
}

function StarIcon({ filled }) {
  return (
    <svg
      className="book-card__star-icon"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 2.8 2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.31l-5.69 2.98 1.09-6.33-4.6-4.48 6.36-.92L12 2.8Z" />
    </svg>
  );
}

function VoteIcon({ name, filled }) {
  const paths = {
    up: (
      <path d="M7.5 21H5.14a2 2 0 0 1-2-2v-7.02a2 2 0 0 1 2-2H7.5m0 11V9.98m0 11h8.43a2 2 0 0 0 1.94-1.5l1.73-6.98a2 2 0 0 0-1.94-2.5h-4.3l.5-3.31A3.2 3.2 0 0 0 10.7 3.02L7.5 9.98" />
    ),
    down: (
      <path d="M16.5 3H18.86a2 2 0 0 1 2 2v7.02a2 2 0 0 1-2 2H16.5m0-11v11M16.5 3H8.07a2 2 0 0 0-1.94 1.5L4.4 11.48a2 2 0 0 0 1.94 2.5h4.3l-.5 3.31a3.2 3.2 0 0 0 3.16 3.67l3.2-6.98" />
    ),
  };
  return (
    <svg
      className="book-card__vote-icon"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function BookCard({
  book,
  onClick,
  onStarChange,
  onVoteChange,
  showStar = true,
  className = "",
}) {
  const { t, lang } = useI18n();
  const coverUrl = book.coverUrl || "";
  const isStarred = Boolean(book.interaction?.isStarred);
  const currentVote = book.interaction?.currentVote || null;
  const dateLabel = formatDate(book.updatedAt, lang);
  const articleCount = Number.isFinite(Number(book.articleCount))
    ? Number(book.articleCount)
    : 0;
  const accessChannels = getResourceAccessChannels(book);
  const openLabel = t("bookCard.open", { name: book.name });
  const handleOpen = (event) => onClick?.(book, event);
  const handleStarChange = (event) => {
    event.stopPropagation();
    onStarChange?.(book, !isStarred);
  };
  const handleVoteChange = (nextVote) => (event) => {
    event.stopPropagation();
    onVoteChange?.(book, currentVote === nextVote ? null : nextVote);
  };

  const sideContent = onClick ? (
    <button
      type="button"
      className="book-card__cover-action"
      onClick={handleOpen}
      aria-label={openLabel}
    >
      {coverUrl ? (
        <img className="book-card__cover" src={coverUrl} alt={book.name} />
      ) : (
        <span
          className="book-card__cover book-card__cover--placeholder"
          role="img"
          aria-label={t("bookCard.coverPlaceholder", { name: book.name })}
        >
          <BookIcon />
        </span>
      )}
    </button>
  ) : (
    <div className="book-card__cover-action book-card__cover-action--static">
      {coverUrl ? (
        <img className="book-card__cover" src={coverUrl} alt={book.name} />
      ) : (
        <span
          className="book-card__cover book-card__cover--placeholder"
          role="img"
          aria-label={t("bookCard.coverPlaceholder", { name: book.name })}
        >
          <BookIcon />
        </span>
      )}
    </div>
  );

  const content = (
    <div className="book-card__body">
      <div className="book-card__heading-row">
        <div className="book-card__heading-main">
          {onClick ? (
            <button
              type="button"
              className="book-card__title-action"
              onClick={handleOpen}
              aria-label={openLabel}
            >
              <h2 className="book-card__title">{book.name}</h2>
            </button>
          ) : (
            <h2 className="book-card__title">{book.name}</h2>
          )}
          {accessChannels.map((access, index) => (
            <AccessTag
              key={`${access.isVIP ? "vip" : "common"}-${index}`}
              {...access}
            />
          ))}
          <span className="book-card__article-count">
            {t("bookCard.articleCount", { count: articleCount })}
          </span>
        </div>
        <div className="book-card__meta-side">
          {onVoteChange ? (
            <div
              className="book-card__feedback"
              aria-label={t("bookCard.feedback")}
            >
              <button
                type="button"
                className={[
                  "book-card__vote-button",
                  "book-card__vote-button--up",
                  currentVote === "up" && "book-card__vote-button--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={handleVoteChange("up")}
                aria-label={t(
                  currentVote === "up"
                    ? "bookCard.clearUpvote"
                    : "bookCard.upvote",
                )}
                aria-pressed={currentVote === "up"}
              >
                <VoteIcon name="up" filled={currentVote === "up"} />
                {book.interaction?.upCount != null ? (
                  <span>{book.interaction.upCount}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={[
                  "book-card__vote-button",
                  "book-card__vote-button--down",
                  currentVote === "down" && "book-card__vote-button--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={handleVoteChange("down")}
                aria-label={t(
                  currentVote === "down"
                    ? "bookCard.clearDownvote"
                    : "bookCard.downvote",
                )}
                aria-pressed={currentVote === "down"}
              >
                <VoteIcon name="down" filled={currentVote === "down"} />
                {book.interaction?.downCount != null ? (
                  <span>{book.interaction.downCount}</span>
                ) : null}
              </button>
            </div>
          ) : null}
          {dateLabel ? (
            <time className="book-card__date" dateTime={book.updatedAt}>
              {dateLabel}
            </time>
          ) : null}
          {showStar ? (
            <button
              type="button"
              className={[
                "book-card__star-button",
                isStarred && "book-card__star-button--active",
                !onStarChange && "book-card__star-button--static",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={onStarChange ? handleStarChange : undefined}
              aria-label={isStarred ? t("bookCard.unstar") : t("bookCard.star")}
              aria-pressed={isStarred}
              disabled={!onStarChange}
            >
              <StarIcon filled={isStarred} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="book-card__divider" aria-hidden="true" />
      <p
        className={[
          "book-card__summary",
          !book.abstract && "book-card__summary--empty",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {book.abstract || t("bookCard.noAbstract")}
      </p>
    </div>
  );

  return (
    <Card
      className={["book-card", className].filter(Boolean).join(" ")}
      content={content}
      sideContent={sideContent}
      sidePosition="left"
      sideWidth="clamp(132px, 18vw, 180px)"
      interactive={Boolean(onClick)}
    />
  );
}
