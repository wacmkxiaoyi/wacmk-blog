import React, { useContext, useEffect, useState } from "react";
import { ContextActionsMenu } from "../../../../context-actions/index.ts";
import {
  canManageComment,
  createCommentTarget,
  getCommentText,
  getNextCommentVote,
  getNextShownCount,
  getVisibleComments,
} from "../../../core/index.ts";
import { resolveCommentLabel } from "../../../core/index.ts";
import type {
  Comment,
  CommentComposerRenderProps,
  CommentTarget,
  CommentThreadProps,
} from "../../../core/index.ts";
import styles from "./CommentThread.module.css";

type CommentThreadLabels = Record<
  | "title"
  | "reply"
  | "cancel"
  | "publish"
  | "save"
  | "edit"
  | "delete"
  | "upvote"
  | "downvote"
  | "more"
  | "loading"
  | "showMore"
  | "showReplies"
  | "hideReplies"
  | "noComments"
  | "writeComment"
  | "replyPlaceholder"
  | "editPlaceholder",
  string
>;

type ActiveComposer<TAuthor> = {
  mode: "create" | "reply" | "edit";
  target: CommentTarget<TAuthor> | null;
};

function Icon({ name }: { name: "more" | "up" | "down" | "reply" }) {
  const paths = {
    more: (
      <>
        <circle cx="5" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="19" cy="12" r="1.4" />
      </>
    ),
    up: (
      <path d="M7.5 10.25v8.25H4.75v-8.25H7.5Zm1.75 8.25V10.25l2.7-5.05a1.3 1.3 0 0 1 2.4.92L13.3 10.25h4.35c1.05 0 1.82.99 1.53 2l-1.72 5.5a1.3 1.3 0 0 1-1.24.92H9.25Z" />
    ),
    down: (
      <path d="M7.5 5.5v8.25H4.75V5.5H7.5Zm1.75 0h6.97c.57 0 1.08.37 1.24.92l1.72 5.5c.3 1.01-.48 2-1.53 2H13.3l1.05 4.13a1.3 1.3 0 0 1-2.4.92l-2.7-5.05V5.5Z" />
    ),
    reply: (
      <path d="M9 8 4 12l5 4v-3h4.5a5.5 5.5 0 0 1 5.5 5.5V19A8 8 0 0 0 11 10H9V8Z" />
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

function getDateLabel(value: string | number | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function CommentComposer<TAuthor>({
  composer,
  renderComposer,
  labels,
  onClose,
  onSubmit,
}: {
  composer: ActiveComposer<TAuthor>;
  renderComposer: CommentThreadProps<TAuthor>["renderComposer"];
  labels: CommentThreadLabels;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState(
    composer.mode === "edit" && composer.target
      ? getCommentText(composer.target.comment.content)
      : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const placeholder =
    composer.mode === "edit"
      ? labels.editPlaceholder
      : composer.mode === "reply"
        ? labels.replyPlaceholder
        : labels.writeComment;

  useEffect(() => {
    setContent(
      composer.mode === "edit" && composer.target
        ? getCommentText(composer.target.comment.content)
        : "",
    );
  }, [composer]);

  async function submit(nextContent: string) {
    if (!nextContent.trim() || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(nextContent);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const customProps: CommentComposerRenderProps<TAuthor> = {
    mode: composer.mode,
    target: composer.target,
    initialValue: content,
    value: content,
    placeholder,
    submitting,
    classes: {
      composer: styles.composer,
      composerActions: styles.composerActions,
      primaryButton: styles.primaryButton,
      secondaryButton: styles.secondaryButton,
    },
    onChange: setContent,
    onSubmit: submit,
    onCancel: onClose,
  };
  if (renderComposer) {
    return <>{renderComposer(customProps)}</>;
  }

  return (
    <div className={styles.composer}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={placeholder}
        rows={6}
      />
      <div className={styles.composerActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
          disabled={submitting}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void submit(content)}
          disabled={submitting || !content.trim()}
        >
          {submitting
            ? labels.loading
            : composer.mode === "edit"
              ? labels.save
              : labels.publish}
        </button>
      </div>
    </div>
  );
}

function CommentItem<TAuthor>({
  comment,
  parentComment,
  depth,
  props,
  labels,
  onOpenComposer,
  replyCount = 0,
  repliesExpanded = false,
  onToggleReplies,
}: {
  comment: Comment<TAuthor>;
  parentComment: Comment<TAuthor> | null;
  depth: 0 | 1;
  props: CommentThreadProps<TAuthor>;
  labels: CommentThreadLabels;
  onOpenComposer: (composer: ActiveComposer<TAuthor>) => void;
  replyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPoint, setMenuPoint] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState<"up" | "down" | "delete" | null>(null);
  const target = createCommentTarget(comment, parentComment, depth);
  const readonly = Boolean(props.readonly);
  const canManage = canManageComment(
    comment,
    props.currentUserId,
    Boolean(props.isAdmin),
    props.getAuthorId,
  );
  const replyToAuthor = comment.replyTo
    ? (props.renderReplyToAuthor?.(comment.replyTo.author, comment) ??
      props.renderAuthor(comment.replyTo.author, {
        author: comment.replyTo.author,
        comment,
        depth,
        isOwner: false,
        isAdmin: false,
      }))
    : null;
  const menuGroups =
    !readonly && canManage
      ? [
          {
            group: 1,
            children: [
              {
                key: "edit",
                label: labels.edit,
                onClick: () => onOpenComposer({ mode: "edit", target }),
              },
              {
                key: "delete",
                label: labels.delete,
                danger: true,
                onClick: async () => {
                  if (!props.onDelete || pending) return;
                  setPending("delete");
                  try {
                    await props.onDelete(target);
                  } finally {
                    setPending(null);
                  }
                },
              },
            ],
          },
        ]
      : [];

  async function vote(vote: "up" | "down") {
    if (readonly || !props.onVote || pending) return;
    setPending(vote);
    try {
      await props.onVote(target, getNextCommentVote(comment.viewerVote, vote));
    } finally {
      setPending(null);
    }
  }

  return (
    <article
      className={[styles.comment, depth === 1 ? styles.reply : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.identity}>
        <div className={styles.authorLine}>
          <div className={styles.author}>
            {props.renderAuthor(comment.author, {
              author: comment.author,
              comment,
              depth,
              isOwner: canManageComment(
                comment,
                props.currentUserId,
                false,
                props.getAuthorId,
              ),
              isAdmin: Boolean(props.isAdmin || comment.isAdmin),
            })}
          </div>
          {replyToAuthor ? (
            <span className={styles.replyTo}>
              <span aria-hidden="true">›</span>
              {replyToAuthor}
            </span>
          ) : null}
        </div>
        {!readonly && canManage ? (
          <button
            type="button"
            className={styles.moreButton}
            aria-label={labels.more}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setMenuPoint({ x: rect.right, y: rect.bottom + 6 });
              setMenuOpen(true);
            }}
          >
            <Icon name="more" />
          </button>
        ) : null}
      </header>
      <div className={styles.content}>
        {props.renderContent ? props.renderContent(comment) : comment.content}
      </div>
      <footer className={styles.meta}>
        <div className={styles.metaStart}>
          <time>
            {props.formatDate?.(comment.createdAt, comment) ??
              getDateLabel(comment.createdAt)}
          </time>
          {depth === 0 && replyCount ? (
            <button
              type="button"
              className={styles.repliesToggle}
              onClick={onToggleReplies}
            >
              {repliesExpanded
                ? labels.hideReplies
                : labels.showReplies.replace("{count}", String(replyCount))}
            </button>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={[
              styles.actionButton,
              comment.viewerVote === "up" ? styles.activeVote : "",
            ].join(" ")}
            aria-label={labels.upvote}
            disabled={readonly || pending !== null}
            onClick={() => void vote("up")}
          >
            <Icon name="up" />
            <span>{comment.upvoteCount || 0}</span>
          </button>
          <button
            type="button"
            className={[
              styles.actionButton,
              comment.viewerVote === "down" ? styles.activeVoteDown : "",
            ].join(" ")}
            aria-label={labels.downvote}
            disabled={readonly || pending !== null}
            onClick={() => void vote("down")}
          >
            <Icon name="down" />
            <span>{comment.downvoteCount || 0}</span>
          </button>
          {!readonly && props.onSubmit ? (
            <button
              type="button"
              className={styles.replyButton}
              onClick={() => onOpenComposer({ mode: "reply", target })}
            >
              <Icon name="reply" />
              {labels.reply}
            </button>
          ) : null}
        </div>
      </footer>
      {menuOpen ? (
        <ContextActionsMenu
          open
          point={menuPoint}
          groups={menuGroups}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </article>
  );
}

export function CommentThread<TAuthor>({
  comments,
  pageSize = 5,
  hasMore,
  loadingMore,
  onLoadMore,
  translate,
  className,
  ...props
}: CommentThreadProps<TAuthor>) {
  const labels = {
    title: resolveCommentLabel(translate, "comments.title", "Comments"),
    reply: resolveCommentLabel(translate, "comments.reply", "Reply"),
    cancel: resolveCommentLabel(translate, "comments.cancel", "Cancel"),
    publish: resolveCommentLabel(translate, "comments.publish", "Publish"),
    save: resolveCommentLabel(translate, "comments.save", "Save changes"),
    edit: resolveCommentLabel(translate, "comments.edit", "Edit"),
    delete: resolveCommentLabel(translate, "comments.delete", "Delete"),
    upvote: resolveCommentLabel(translate, "comments.upvote", "Upvote"),
    downvote: resolveCommentLabel(translate, "comments.downvote", "Downvote"),
    more: resolveCommentLabel(translate, "comments.more", "More actions"),
    loading: resolveCommentLabel(translate, "comments.loading", "Working..."),
    showMore: resolveCommentLabel(
      translate,
      "comments.showMore",
      "Show more comments",
    ),
    showReplies: resolveCommentLabel(
      translate,
      "comments.showReplies",
      "Show {count} replies",
    ),
    hideReplies: resolveCommentLabel(
      translate,
      "comments.hideReplies",
      "Hide replies",
    ),
    noComments: resolveCommentLabel(
      translate,
      "comments.noComments",
      "No comments yet. Start the conversation.",
    ),
    writeComment: resolveCommentLabel(
      translate,
      "comments.writeComment",
      "Write a comment...",
    ),
    replyPlaceholder: resolveCommentLabel(
      translate,
      "comments.replyPlaceholder",
      "Write a reply...",
    ),
    editPlaceholder: resolveCommentLabel(
      translate,
      "comments.editPlaceholder",
      "Edit your comment...",
    ),
  };
  const [shownCount, setShownCount] = useState(Math.max(1, pageSize));
  const [composer, setComposer] = useState<ActiveComposer<TAuthor> | null>(
    null,
  );
  const [expandedReplyIds, setExpandedReplyIds] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleComments = getVisibleComments(comments, pageSize, shownCount);
  const hasClientMore = shownCount < comments.length;
  const showMore = hasMore ?? hasClientMore;

  useEffect(() => {
    setShownCount((current) =>
      Math.min(
        Math.max(current, pageSize),
        Math.max(comments.length, pageSize),
      ),
    );
  }, [comments.length, pageSize]);

  async function submit(content: string) {
    if (!composer) return;
    if (composer.mode === "edit" && composer.target) {
      await props.onEdit?.(composer.target, content);
      return;
    }
    await props.onSubmit?.({
      content,
      parentComment:
        composer.mode === "reply"
          ? (composer.target?.parentComment ?? composer.target?.comment ?? null)
          : null,
      replyTo:
        composer.mode === "reply" ? (composer.target?.comment ?? null) : null,
    });
  }

  async function loadMore() {
    if (loadingMore) return;
    if (onLoadMore) await onLoadMore();
    setShownCount((current) =>
      getNextShownCount(current, pageSize, comments.length),
    );
  }

  return (
    <section
      className={[styles.thread, className || ""].filter(Boolean).join(" ")}
    >
      <div className={styles.threadHeader}>
        <div className={styles.titleGroup}>
          <h2>{labels.title}</h2>
          <span>{comments.length}</span>
        </div>
        {!props.readonly && props.onSubmit && composer?.mode !== "create" ? (
          <button
            type="button"
            className={styles.startButton}
            onClick={() => setComposer({ mode: "create", target: null })}
          >
            {labels.writeComment}
          </button>
        ) : null}
      </div>
      {!props.readonly && props.onSubmit && composer?.mode === "create" ? (
        <div className={styles.createArea}>
          <CommentComposer
            composer={composer}
            renderComposer={props.renderComposer}
            labels={labels}
            onClose={() => setComposer(null)}
            onSubmit={submit}
          />
        </div>
      ) : null}
      <div className={styles.list}>
        {visibleComments.length ? (
          visibleComments.map((comment) => {
            const replies = comment.replies || [];
            const repliesExpanded = expandedReplyIds.has(comment.id);
            const toggleReplies = () =>
              setExpandedReplyIds((current) => {
                const next = new Set(current);
                if (next.has(comment.id)) next.delete(comment.id);
                else next.add(comment.id);
                return next;
              });
            return (
              <React.Fragment key={comment.id}>
                <CommentItem
                  comment={comment}
                  parentComment={null}
                  depth={0}
                  props={props}
                  labels={labels}
                  onOpenComposer={setComposer}
                  replyCount={replies.length}
                  repliesExpanded={repliesExpanded}
                  onToggleReplies={toggleReplies}
                />
                {composer?.target?.comment.id === comment.id &&
                composer.mode !== "create" ? (
                  <CommentComposer
                    composer={composer}
                    renderComposer={props.renderComposer}
                    labels={labels}
                    onClose={() => setComposer(null)}
                    onSubmit={submit}
                  />
                ) : null}
                {repliesExpanded ? (
                  <div className={styles.replies}>
                    {replies.map((reply) => (
                      <React.Fragment key={reply.id}>
                        <CommentItem
                          comment={reply}
                          parentComment={comment}
                          depth={1}
                          props={props}
                          labels={labels}
                          onOpenComposer={setComposer}
                        />
                        {composer?.target?.comment.id === reply.id &&
                        composer.mode !== "create" ? (
                          <CommentComposer
                            composer={composer}
                            renderComposer={props.renderComposer}
                            labels={labels}
                            onClose={() => setComposer(null)}
                            onSubmit={submit}
                          />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
              </React.Fragment>
            );
          })
        ) : (
          <p className={styles.empty}>{labels.noComments}</p>
        )}
      </div>
      {showMore ? (
        <button
          type="button"
          className={styles.loadMoreButton}
          disabled={Boolean(loadingMore)}
          onClick={() => void loadMore()}
        >
          {loadingMore ? labels.loading : labels.showMore}
        </button>
      ) : null}
    </section>
  );
}
