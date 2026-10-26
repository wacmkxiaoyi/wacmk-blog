import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button.jsx";
import useI18n from "../../../../hooks/useI18n.js";
import { CommentThread } from "../../../../packages/comments/index.ts";
import { getVoteCountsAfterChange } from "../../../../packages/comments/core/index.ts";
import "./CommentsTestPage.css";

const AUTHORS = {
  iris: {
    id: "iris",
    name: "Iris Chen",
    role: "Product designer",
    tone: "violet",
  },
  noah: {
    id: "noah",
    name: "Noah Lin",
    role: "Platform engineer",
    tone: "blue",
  },
  mina: {
    id: "mina",
    name: "Mina Zhou",
    role: "Community moderator",
    tone: "coral",
  },
};

const INITIAL_COMMENTS = [
  {
    id: "c-1",
    author: AUTHORS.iris,
    content:
      "The split between the identity, content, and action areas makes long discussions much easier to scan.\n\nI also like that **direct replies** remain visually grouped.",
    createdAt: "2026-08-21T08:20:00",
    upvoteCount: 18,
    downvoteCount: 1,
    viewerVote: "up",
    replies: [
      {
        id: "c-1-r-1",
        author: AUTHORS.noah,
        content:
          "Agreed. I would keep nested responses flat and use the `Replying to` marker instead of adding another indentation level.",
        createdAt: "2026-08-21T08:35:00",
        upvoteCount: 5,
        downvoteCount: 0,
      },
      {
        id: "c-1-r-2",
        author: AUTHORS.mina,
        content:
          "That also prevents the layout from collapsing on smaller screens.",
        createdAt: "2026-08-21T08:48:00",
        upvoteCount: 3,
        downvoteCount: 0,
        replyTo: { commentId: "c-1-r-1", author: AUTHORS.noah },
      },
    ],
  },
  {
    id: "c-2",
    author: AUTHORS.noah,
    content:
      "Markdown content uses the existing renderer, while integrations can supply a React node or a custom content renderer.",
    createdAt: "2026-08-21T09:15:00",
    upvoteCount: 9,
    downvoteCount: 0,
  },
  {
    id: "c-3",
    author: AUTHORS.mina,
    content: (
      <div className="comments-demo-callout">
        <strong>Custom React content</strong>
        <span>This comment bypasses Markdown intentionally.</span>
      </div>
    ),
    createdAt: "2026-08-21T10:02:00",
    upvoteCount: 12,
    downvoteCount: 2,
    isAdmin: true,
  },
  {
    id: "c-4",
    author: AUTHORS.iris,
    content:
      "The host owns persistence. This playground only updates its local simulated data after each asynchronous callback resolves.",
    createdAt: "2026-08-21T11:45:00",
    upvoteCount: 4,
    downvoteCount: 0,
  },
  {
    id: "c-5",
    author: AUTHORS.noah,
    content:
      "The more button should be reachable with keyboard focus, not only hover.",
    createdAt: "2026-08-21T12:30:00",
    upvoteCount: 7,
    downvoteCount: 0,
  },
  {
    id: "c-6",
    author: AUTHORS.mina,
    content: "This final record verifies client-side pagination.",
    createdAt: "2026-08-21T13:10:00",
    upvoteCount: 1,
    downvoteCount: 0,
  },
];

function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, 450));
}

export default function CommentsTestPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const translate = (key, fallback) => {
    const translated = t(key);
    return translated === key ? fallback : translated;
  };
  const [comments, setComments] = React.useState(INITIAL_COMMENTS);
  const [readonly, setReadonly] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [events, setEvents] = React.useState([]);
  const log = (message) =>
    setEvents((current) => [message, ...current].slice(0, 5));

  function updateComment(id, updater) {
    setComments((current) =>
      current.map((comment) =>
        comment.id === id
          ? updater(comment)
          : {
              ...comment,
              replies: comment.replies?.map((reply) =>
                reply.id === id ? updater(reply) : reply,
              ),
            },
      ),
    );
  }

  return (
    <main className="comments-test-page">
      <section className="comments-test-hero">
        <div>
          <p>/test/frontend/packages/comments</p>
          <h1>Comment Thread Lab</h1>
          <span>
            Controlled async callbacks, flexible author nodes, Markdown, React
            content, and compact reply hierarchy.
          </span>
        </div>
        <Button onClick={() => navigate("/home")}>返回首页</Button>
      </section>
      <section className="comments-test-layout">
        <article className="comments-test-panel">
          <CommentThread
            comments={comments}
            currentUserId="iris"
            getAuthorId={(author) => author.id}
            isAdmin={isAdmin}
            readonly={readonly}
            pageSize={3}
            translate={translate}
            renderAuthor={(author, context) => (
              <div className="comments-demo-author">
                <span
                  className={`comments-demo-avatar comments-demo-avatar--${author.tone}`}
                >
                  {author.name.slice(0, 1)}
                </span>
                <span>
                  <strong>{author.name}</strong>
                  <small>
                    {context.isAdmin
                      ? "Moderator controls enabled"
                      : author.role}
                  </small>
                </span>
              </div>
            )}
            renderReplyToAuthor={(author) => (
              <strong className="comments-demo-reply-target">
                {author.name}
              </strong>
            )}
            onSubmit={async ({ content, parentComment, replyTo }) => {
              await wait();
              const next = {
                id: `c-${Date.now()}`,
                author: AUTHORS.iris,
                content,
                createdAt: new Date().toISOString(),
                upvoteCount: 0,
                downvoteCount: 0,
                ...(replyTo
                  ? {
                      replyTo: {
                        commentId: replyTo.id,
                        author: replyTo.author,
                      },
                    }
                  : {}),
              };
              if (parentComment)
                updateComment(parentComment.id, (comment) => ({
                  ...comment,
                  replies: [...(comment.replies || []), next],
                }));
              else setComments((current) => [next, ...current]);
              log(
                parentComment
                  ? "Reply submitted"
                  : "Top-level comment submitted",
              );
            }}
            onEdit={async ({ comment }, content) => {
              await wait();
              updateComment(comment.id, (current) => ({
                ...current,
                content,
                updatedAt: new Date().toISOString(),
              }));
              log("Comment edited");
            }}
            onDelete={async ({ comment }) => {
              await wait();
              setComments((current) =>
                current
                  .filter((item) => item.id !== comment.id)
                  .map((item) => ({
                    ...item,
                    replies: item.replies?.filter(
                      (reply) => reply.id !== comment.id,
                    ),
                  })),
              );
              log("Comment deleted");
            }}
            onVote={async ({ comment }, nextVote) => {
              await wait();
              updateComment(comment.id, (current) => ({
                ...current,
                viewerVote: nextVote,
                ...getVoteCountsAfterChange(
                  current.upvoteCount,
                  current.downvoteCount,
                  current.viewerVote,
                  nextVote,
                ),
              }));
              log(
                nextVote
                  ? `${nextVote === "up" ? "Upvote" : "Downvote"} sent`
                  : "Vote cancelled",
              );
            }}
          />
        </article>
        <aside className="comments-test-sidebar">
          <article className="comments-test-panel">
            <h2>Scenario Controls</h2>
            <label>
              <input
                type="checkbox"
                checked={readonly}
                onChange={(event) => setReadonly(event.target.checked)}
              />{" "}
              Readonly mode
            </label>
            <label>
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(event) => setIsAdmin(event.target.checked)}
              />{" "}
              View as administrator
            </label>
            <p>
              Current user: <strong>Iris Chen</strong>. Toggle administrator
              mode to manage every comment; otherwise only Iris comments expose
              the menu.
            </p>
          </article>
          <article className="comments-test-panel">
            <h2>Callback Log</h2>
            {events.length ? (
              <ul>
                {events.map((event, index) => (
                  <li key={`${event}-${index}`}>{event}</li>
                ))}
              </ul>
            ) : (
              <p>
                Use a write action to observe the host-controlled callback flow.
              </p>
            )}
          </article>
          <article className="comments-test-panel">
            <h2>Verification</h2>
            <ul>
              <li>Load more starts collapsed at three root comments.</li>
              <li>
                Replies start collapsed; direct replies receive a left guide
                only after expansion.
              </li>
              <li>The host controls the comment composer implementation.</li>
              <li>
                The custom React content card does not go through Markdown
                rendering.
              </li>
              <li>
                All mutations await an async callback before closing their
                editor or re-enabling actions.
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
}
