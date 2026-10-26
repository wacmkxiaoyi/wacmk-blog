import { Card } from "../../packages/card";
import useI18n from "../../hooks/useI18n";
import AccessTag from "../access-tag/AccessTag";
import { getResourceAccessChannels } from "../access-tag/resourceAccessTags";
import ArticleTag from "../article-tag/ArticleTag";
import "./ArticleCard.css";

const FALLBACK_BACKGROUND =
  "linear-gradient(135deg, #efe5ff 0%, #fce6ef 52%, #e2edff 100%)";

function getExcerpt(article) {
  const value = article.excerpt || article.abstract || article.content || "";
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/[`*_>#\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAuthorName(author) {
  return author?.displayName || author?.username || "";
}

function getBackground(background) {
  if (background?.type === "color" || background?.type === "gradient")
    return background.value;
  return FALLBACK_BACKGROUND;
}

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

function Icon({ name, filled = false }) {
  const paths = {
    star: (
      <path d="m12 2.8 2.84 5.76 6.36.92-4.6 4.48 1.09 6.33L12 17.31l-5.69 2.98 1.09-6.33-4.6-4.48 6.36-.92L12 2.8Z" />
    ),
    up: (
      <path d="M7.5 21H5.14a2 2 0 0 1-2-2v-7.02a2 2 0 0 1 2-2H7.5m0 11V9.98m0 11h8.43a2 2 0 0 0 1.94-1.5l1.73-6.98a2 2 0 0 0-1.94-2.5h-4.3l.5-3.31A3.2 3.2 0 0 0 10.7 3.02L7.5 9.98" />
    ),
    down: (
      <path d="M16.5 3H18.86a2 2 0 0 1 2 2v7.02a2 2 0 0 1-2 2H16.5m0-11v11M16.5 3H8.07a2 2 0 0 0-1.94 1.5L4.4 11.48a2 2 0 0 0 1.94 2.5h4.3l-.5 3.31a3.2 3.2 0 0 0 3.16 3.67l3.2-6.98" />
    ),
    views: (
      <>
        <path d="M2.5 12s3.35-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.35 5.5-9.5 5.5S2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  };
  return (
    <svg
      className="article-card__icon"
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

function FeedbackButton({ icon, count, label, active, onClick }) {
  const content = (
    <>
      <Icon name={icon} filled={active} />
      {count != null ? <span>{count}</span> : null}
    </>
  );
  const className = [
    "article-card__feedback-button",
    `article-card__feedback-button--${icon}`,
    active && "article-card__feedback-button--active",
    !onClick && "article-card__feedback-button--static",
  ]
    .filter(Boolean)
    .join(" ");
  if (!onClick)
    return (
      <span className={className} aria-label={label}>
        {content}
      </span>
    );
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

export default function ArticleCard({
  article,
  onClick,
  onTagClick,
  onStarChange,
  onVoteChange,
  showTags = true,
  className = "",
}) {
  const { t, lang } = useI18n();
  const excerpt = getExcerpt(article);
  const authorName = getAuthorName(article.author);
  const dateValue = article.publishedAt || article.updatedAt;
  const dateLabel = formatDate(dateValue, lang);
  const interaction = article.interaction || {};
  const currentVote = interaction.currentVote || null;
  const tags = Array.isArray(article.tags) ? article.tags : [];
  const accessChannels = getResourceAccessChannels(article);
  const coverUrl = article.coverUrl || "";
  const handleOpen = (event) => {
    onClick?.(article, event);
  };
  const stopAnd = (handler) => (event) => {
    event.stopPropagation();
    handler?.(event);
  };

  const contentPanelStyle = coverUrl
    ? { backgroundImage: `url("${coverUrl.replace(/"/g, '\\"')}")` }
    : { background: getBackground(article.background) };
  const content = (
    <div
      className={[
        "article-card__content-panel",
        coverUrl && "article-card__content-panel--cover",
      ]
        .filter(Boolean)
        .join(" ")}
      style={contentPanelStyle}
    >
      {onClick ? (
        <button
          type="button"
          className="article-card__main-action"
          onClick={handleOpen}
          aria-label={t("articleCard.open", { title: article.title })}
        >
          <div className="article-card__meta">
            {authorName ? <span>{authorName}</span> : null}
            {authorName && dateLabel ? <span aria-hidden="true">/</span> : null}
            {dateLabel ? <time dateTime={dateValue}>{dateLabel}</time> : null}
          </div>
          <h2 className="article-card__title">{article.title}</h2>
          {excerpt ? <p className="article-card__excerpt">{excerpt}</p> : null}
        </button>
      ) : (
        <div className="article-card__main-action article-card__main-action--static">
          <div className="article-card__meta">
            {authorName ? <span>{authorName}</span> : null}
            {authorName && dateLabel ? <span aria-hidden="true">/</span> : null}
            {dateLabel ? <time dateTime={dateValue}>{dateLabel}</time> : null}
          </div>
          <h2 className="article-card__title">{article.title}</h2>
          {excerpt ? <p className="article-card__excerpt">{excerpt}</p> : null}
        </div>
      )}
    </div>
  );

  const bottomContent = showTags ? (
    <div className="article-card__bottom">
      <div className="article-card__footer-row">
        <div className="article-card__access">
          {accessChannels.map((access, index) => (
            <AccessTag
              key={`${access.isVIP ? "vip" : "common"}-${index}`}
              {...access}
            />
          ))}
        </div>
        <div
          className="article-card__feedback"
          aria-label={t("articleCard.feedback")}
        >
          <FeedbackButton
            icon="star"
            count={null}
            label={
              interaction.isStarred
                ? t("articleCard.unstar")
                : t("articleCard.star")
            }
            active={Boolean(interaction.isStarred)}
            onClick={
              onStarChange
                ? stopAnd(() => onStarChange(article, !interaction.isStarred))
                : undefined
            }
          />
          {article.viewCount != null ? (
            <span
              className="article-card__metric"
              aria-label={t("articleCard.views", { count: article.viewCount })}
            >
              <Icon name="views" />
              {article.viewCount}
            </span>
          ) : null}
        </div>
      </div>
      <div className="article-card__footer-row">
        <div className="article-card__tags">
          {tags.length ? (
            tags.map((tag) => (
              <ArticleTag
                key={tag.id || tag.name}
                tag={tag}
                onClick={
                  onTagClick
                    ? stopAnd((event) => onTagClick(tag, article, event))
                    : undefined
                }
              />
            ))
          ) : (
            <span className="article-card__no-tags">
              {t("articleCard.noTags")}
            </span>
          )}
        </div>
        <div
          className="article-card__feedback"
          aria-label={t("articleCard.feedback")}
        >
          <FeedbackButton
            icon="up"
            count={interaction.upCount}
            label={t(
              currentVote === "up"
                ? "articleCard.clearUpvote"
                : "articleCard.upvote",
            )}
            active={currentVote === "up"}
            onClick={
              onVoteChange
                ? stopAnd(() =>
                    onVoteChange(article, currentVote === "up" ? null : "up"),
                  )
                : undefined
            }
          />
          <FeedbackButton
            icon="down"
            count={interaction.downCount}
            label={t(
              currentVote === "down"
                ? "articleCard.clearDownvote"
                : "articleCard.downvote",
            )}
            active={currentVote === "down"}
            onClick={
              onVoteChange
                ? stopAnd(() =>
                    onVoteChange(
                      article,
                      currentVote === "down" ? null : "down",
                    ),
                  )
                : undefined
            }
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <Card
      className={["article-card", className].filter(Boolean).join(" ")}
      content={content}
      bottomContent={bottomContent}
      contentHeight={showTags ? 220 : 200}
      bottomHeight={showTags ? 90 : undefined}
      interactive={Boolean(onClick)}
    />
  );
}
