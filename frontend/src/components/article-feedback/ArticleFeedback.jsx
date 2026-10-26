import useI18n from "../../hooks/useI18n";
import "./ArticleFeedback.css";

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
  };
  return (
    <svg
      className="article-feedback__icon"
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

function FeedbackButton({ icon, count, label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      className={`article-feedback__button article-feedback__button--${icon}${active ? " article-feedback__button--active" : ""}`}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} filled={active} />
      {count != null && <span>{count}</span>}
    </button>
  );
}

export function ArticleHeroFeedback({
  article,
  disabled = false,
  onStarChange,
}) {
  const { t } = useI18n();
  const interaction = article.interaction || {};
  return (
    <div
      className="article-hero-feedback"
      aria-label={t("articleCard.feedback")}
    >
      <FeedbackButton
        icon="star"
        label={t(
          interaction.isStarred ? "articleCard.unstar" : "articleCard.star",
        )}
        active={Boolean(interaction.isStarred)}
        disabled={disabled}
        onClick={() => onStarChange?.(!interaction.isStarred)}
      />
      <span
        className="article-hero-feedback__metric"
        aria-label={t("articleCard.views", { count: article.viewCount || 0 })}
      >
        <svg
          className="article-feedback__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 12s3.35-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.35 5.5-9.5 5.5S2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
        {article.viewCount || 0}
      </span>
    </div>
  );
}

export default function ArticleFeedback({
  article,
  disabled = false,
  onVoteChange,
}) {
  const { t } = useI18n();
  const interaction = article.interaction || {};
  const currentVote = interaction.currentVote || null;
  return (
    <footer className="article-feedback" aria-label={t("articleCard.feedback")}>
      <div className="article-feedback__actions">
        <FeedbackButton
          icon="up"
          count={interaction.upCount || 0}
          label={t(
            currentVote === "up"
              ? "articleCard.clearUpvote"
              : "articleCard.upvote",
          )}
          active={currentVote === "up"}
          disabled={disabled}
          onClick={() => onVoteChange?.(currentVote === "up" ? null : "up")}
        />
        <FeedbackButton
          icon="down"
          count={interaction.downCount || 0}
          label={t(
            currentVote === "down"
              ? "articleCard.clearDownvote"
              : "articleCard.downvote",
          )}
          active={currentVote === "down"}
          disabled={disabled}
          onClick={() => onVoteChange?.(currentVote === "down" ? null : "down")}
        />
      </div>
    </footer>
  );
}
