import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ContentRenderer,
  useContentNavigation,
} from "../../packages/content-renderer";
import { buildDefaultEditorTools, RichTextEditor } from "../../packages/editor";
import { Navigator } from "../../packages/navigator";
import { CommentThread } from "../../packages/comments";
import { Card } from "../../packages/card";
import { Modal } from "../../packages/modal";
import AccessTag from "../../components/access-tag/AccessTag";
import ArticleCard from "../../components/article-card/ArticleCard";
import ArticleTag from "../../components/article-tag/ArticleTag";
import ArticleFeedback, {
  ArticleHeroFeedback,
} from "../../components/article-feedback/ArticleFeedback";
import { getResourceAccessChannels } from "../../components/access-tag/resourceAccessTags";
import useAuth from "../../hooks/useAuth";
import useI18n from "../../hooks/useI18n";
import useResourceAccess from "../../hooks/useResourceAccess";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import {
  createContentRendererTemplate,
  normalizeArticleMarkdown,
} from "../content-renderer";
import {
  ContentResourceModals,
  createContentEditorTools,
  extendContentEditorTools,
} from "../editor";
import api from "../../api";
import PasswordInput from "../../components/ui/PasswordInput";
import {
  getExternalLinkPassword,
  setExternalLinkPassword,
} from "../../utils/externalLinkAccessCache";
import {
  createBookNavigatorItems,
  updateCommentInThreads,
} from "./articleDetailNavigation.jsx";
import "./ArticleDetailReader.css";

function collectArticleIds(nodes, result = []) {
  if (!Array.isArray(nodes)) return result;
  nodes.forEach((node) => {
    if (node?.type === "article") result.push(node.article_id);
    if (node?.type === "group") collectArticleIds(node.children, result);
  });
  return result;
}

function extractAssetIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/assetId="([0-9a-fA-F-]{36})"/g)].map(
        ([, assetId]) => assetId,
      ),
    ),
  ];
}

function extractAttachmentIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/attachmentId="(\d+)"/g)].map(
        ([, attachmentId]) => attachmentId,
      ),
    ),
  ];
}

function createNavigatorItems(items) {
  return (items || []).map((item) => ({
    key: item.id,
    label: item.text,
    level: item.level,
    children: createNavigatorItems(item.children),
  }));
}

function formatArticleDate(value, language) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    language.startsWith("zh") ? "zh-CN" : "en-US",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function translate(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

function mergeParticipants(current, participants) {
  return { ...current, ...(participants || {}) };
}

function hydrateCommentParticipants(comments, participants) {
  return comments.map((comment) => ({
    ...comment,
    author: participants[String(comment.authorId)] || {
      id: comment.authorId,
      username: "",
    },
    replyTo: comment.replyTo
      ? {
          ...comment.replyTo,
          author: participants[String(comment.replyTo.authorId)] || {
            id: comment.replyTo.authorId,
            username: "",
          },
        }
      : null,
    replies: hydrateCommentParticipants(comment.replies || [], participants),
  }));
}

function collectCommentAssetIds(comments) {
  return comments.flatMap((comment) => [
    ...extractAssetIds(comment.content),
    ...extractAttachmentIds(comment.content),
    ...collectCommentAssetIds(comment.replies || []),
  ]);
}

function CommentAuthorIdentity({ author, isArticleAuthor, t }) {
  const name = author.displayName || author.username;
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <span className="article-detail-reader__comment-identity">
      {author.avatarUrl ? (
        <img
          className="article-detail-reader__comment-avatar"
          src={author.avatarUrl}
          alt=""
        />
      ) : (
        <span
          className="article-detail-reader__comment-avatar article-detail-reader__comment-avatar--fallback"
          aria-label={translate(
            t,
            "articleDetail.avatarFallback",
            "User avatar",
          )}
        >
          {initial}
        </span>
      )}
      <strong className="article-detail-reader__comment-name">{name}</strong>
      {isArticleAuthor && (
        <span className="article-detail-reader__comment-role article-detail-reader__comment-role--author">
          {translate(t, "articleDetail.author", "Author")}
        </span>
      )}
      {(author.isStaff || author.isSuperuser) && (
        <span className="article-detail-reader__comment-role">
          {translate(t, "articleDetail.administrator", "Administrator")}
        </span>
      )}
      {author.vipLevel > 0 && (
        <span className="article-detail-reader__comment-role article-detail-reader__comment-role--vip">
          {author.vipName || `VIP ${author.vipLevel}`}
        </span>
      )}
    </span>
  );
}

export default function ArticleDetailReader({
  articleSlug,
  bookSlug,
  readOnly = false,
  isDraft = false,
  externalToken,
  externalBookToken,
}) {
  const navigate = useNavigate();
  const [readerElement, setReaderElement] = React.useState(null);
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { config } = useSiteRuntime();
  const { authorizeResource } = useResourceAccess();
  const [state, setState] = React.useState({
    loading: true,
    error: null,
    article: null,
    book: null,
    comments: [],
    participants: {},
    hasMore: false,
    nextOffset: null,
    manifest: {},
    commentManifest: {},
    related: [],
  });
  const [document, setDocument] = React.useState(null);
  const [commentWorkflow, setCommentWorkflow] = React.useState({
    open: false,
    type: null,
    context: null,
  });
  const [commentPreviews, setCommentPreviews] = React.useState({});
  const [commentAttachments, setCommentAttachments] = React.useState({});
  const [externalLinkPassword, setExternalLinkPasswordState] =
    React.useState("");
  const [passwordModalOpen, setPasswordModalOpen] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState("");
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const externalLinkKind = externalBookToken ? "books" : "articles";
  const externalLinkToken = externalBookToken || externalToken;
  const contentNavigation = useContentNavigation({
    document,
    minLevel: 1,
    maxLevel: 3,
    tree: true,
    observeActive: true,
    offsetTop: 84,
  });

  const loadComments = React.useCallback(async (slug, bookId, offset = 0) => {
    const data = await api.resources.listArticleComments(slug, {
      ...(bookId ? { bookId } : {}),
      offset,
    });
    setState((current) => ({
      ...current,
      comments: offset ? [...current.comments, ...data.items] : data.items,
      participants: mergeParticipants(current.participants, data.participants),
      hasMore: data.hasMore,
      nextOffset: data.nextOffset,
    }));
  }, []);

  React.useEffect(() => {
    let active = true;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        if (externalBookToken) {
          const password =
            externalLinkPassword ||
            getExternalLinkPassword("books", externalBookToken);
          const book = await api.resources.getExternalBook(
            externalBookToken,
            password,
          );
          const articlesById = new Map(
            (book.articles || []).map((item) => [String(item.id), item]),
          );
          const articleIds = collectArticleIds(book.structure);
          const target =
            articleSlug && articleSlug !== "external"
              ? articleSlug
              : articleIds
                  .map((id) => articlesById.get(String(id))?.slug)
                  .find(Boolean);
          if (!target) {
            if (!active) return;
            setPasswordError("");
            setPasswordModalOpen(false);
            setState({
              loading: false,
              error: null,
              article: {
                title: book.name,
                abstract: book.abstract,
                content: "",
                author: book.createdBy || {},
                visibility: "public",
                condition_rules: [],
                access_scope: "unified",
                vip_access_permission: "public",
                vip_condition_rules: [],
                tags: [],
              },
              book: { ...book, articles: book.articles || [] },
              comments: [],
              participants: {},
              hasMore: false,
              nextOffset: null,
              manifest: {},
              commentManifest: {},
              related: [],
            });
            return;
          }
          const article = await api.resources.getExternalBookArticle(
            externalBookToken,
            target,
            password,
          );
          const assetIds = extractAssetIds(article.content);
          const attachmentIds = extractAttachmentIds(article.content);
          const manifest =
            await api.resources.getExternalBookArticleAssetManifest(
              externalBookToken,
              article.slug,
              assetIds,
              attachmentIds,
              password,
            );
          if (!active) return;
          setPasswordError("");
          setPasswordModalOpen(false);
          setState({
            loading: false,
            error: null,
            article,
            book: { ...book, articles: book.articles || [] },
            comments: [],
            participants: {},
            hasMore: false,
            nextOffset: null,
            manifest: manifest.assets || {},
            commentManifest: {},
            related: [],
          });
          return;
        }
        if (externalToken) {
          const password =
            externalLinkPassword ||
            getExternalLinkPassword("articles", externalToken);
          const article = await api.resources.getExternalArticle(
            externalToken,
            password,
          );
          const assetIds = extractAssetIds(article.content);
          const attachmentIds = extractAttachmentIds(article.content);
          const [manifest, comments] = await Promise.all([
            api.resources.getExternalArticleAssetManifest(
              externalToken,
              assetIds,
              attachmentIds,
              password,
            ),
            api.resources.listExternalArticleComments(
              externalToken,
              undefined,
              password,
            ),
          ]);
          if (!active) return;
          setPasswordError("");
          setPasswordModalOpen(false);
          setState({
            loading: false,
            error: null,
            article,
            book: null,
            comments: comments.items,
            participants: comments.participants || {},
            hasMore: comments.hasMore,
            nextOffset: comments.nextOffset,
            manifest: manifest.assets || {},
            commentManifest: {},
            related: [],
          });
          return;
        }
        const bookPreview = bookSlug
          ? await api.resources.previewBook(bookSlug)
          : null;
        if (
          bookPreview &&
          !(await authorizeResource(
            {
              type: "book",
              id: bookPreview.id,
              name: bookPreview.name,
              context: { inBook: false },
            },
            { allowCancel: false },
          ))
        ) {
          if (active)
            setState((current) => ({
              ...current,
              loading: false,
              error: new Error("Book access denied"),
            }));
          return;
        }
        const book = bookPreview ? await api.resources.getBook(bookSlug) : null;
        if (!articleSlug) {
          const articleIds = book ? collectArticleIds(book.structure) : [];
          const bookArticles = articleIds.length
            ? await api.resources.listArticles({
                ids: articleIds.join(","),
                bookId: book.id,
              })
            : { items: [] };
          const articlesById = new Map(
            (bookArticles.items || []).map((item) => [String(item.id), item]),
          );
          const visibleArticles = articleIds
            .map((id) => articlesById.get(String(id)))
            .filter(Boolean);
          const firstArticle =
            visibleArticles.find((item) => item.accessDecision?.all_granted) ||
            visibleArticles[0];
          if (!active) return;
          if (firstArticle) {
            navigate(
              `/books/${book.slug}?article=${encodeURIComponent(firstArticle.slug)}`,
              {
                replace: true,
              },
            );
            return;
          }
          setState((current) => ({
            ...current,
            loading: false,
            error: new Error("No articles in this book"),
            book,
          }));
          return;
        }
        const articlePreview = isDraft
          ? await api.resources.getDraft(articleSlug)
          : await api.resources.previewArticle(
              articleSlug,
              book ? { bookId: book.id } : undefined,
            );
        if (
          !isDraft &&
          !(await authorizeResource(
            {
              type: "article",
              id: articlePreview.id,
              name: articlePreview.title,
              context: { inBook: Boolean(book), bookId: book?.id },
            },
            { allowCancel: false },
          ))
        ) {
          if (active)
            setState((current) => ({
              ...current,
              loading: false,
              error: new Error("Article access denied"),
            }));
          return;
        }
        const article = isDraft
          ? { ...articlePreview, publishedAt: null, status: "draft" }
          : await api.resources.getArticle(
              articleSlug,
              book ? { bookId: book.id } : undefined,
            );
        const articleIds = book ? collectArticleIds(book.structure) : [];
        const assetIds = extractAssetIds(article.content);
        const attachmentIds = extractAttachmentIds(article.content);
        const relatedPromise =
          readOnly || book
            ? Promise.resolve({ items: [] })
            : api.resources.listArticles({ limit: 4 });
        const [manifest, comments, related, bookArticles] = await Promise.all([
          api.resources.getAssetManifest(
            isDraft ? "drafts" : "articles",
            article.slug,
            assetIds,
            attachmentIds,
            book ? { bookId: book.id } : undefined,
          ),
          isDraft
            ? Promise.resolve({
                items: [],
                participants: {},
                hasMore: false,
                nextOffset: null,
              })
            : api.resources.listArticleComments(
                article.slug,
                book ? { bookId: book.id } : undefined,
              ),
          relatedPromise,
          articleIds.length
            ? api.resources.listArticles({
                ids: articleIds.join(","),
                bookId: book.id,
              })
            : Promise.resolve({ items: [] }),
        ]);
        if (!active) return;
        setState({
          loading: false,
          error: null,
          article,
          book: book ? { ...book, articles: bookArticles.items } : null,
          comments: comments.items,
          participants: comments.participants || {},
          hasMore: comments.hasMore,
          nextOffset: comments.nextOffset,
          manifest: manifest.assets || {},
          commentManifest: {},
          related: (related.items || [])
            .filter((item) => item.id !== article.id)
            .slice(0, 3),
        });
        void api.resources
          .recordArticleView(articleSlug, book?.id)
          .catch(() => {});
      } catch (error) {
        const passwordCode =
          error.response?.data?.code || error.response?.data?.detail?.code;
        const passwordRequired =
          error.response?.status === 403 &&
          passwordCode === "external_link_password_required";
        if (active && passwordRequired) {
          const attemptedPassword =
            externalLinkPassword ||
            getExternalLinkPassword(externalLinkKind, externalLinkToken);
          if (attemptedPassword)
            setExternalLinkPassword(externalLinkKind, externalLinkToken, "");
          setPasswordError(
            attemptedPassword
              ? translate(
                  t,
                  "externalLinkAccess.passwordInvalid",
                  "Incorrect access password. Please try again.",
                )
              : "",
          );
          setPasswordModalOpen(true);
          setState((current) => ({ ...current, loading: false, error: null }));
        } else if (active)
          setState((current) => ({ ...current, loading: false, error }));
      }
    }
    if (articleSlug || bookSlug || externalToken || externalBookToken)
      void load();
    return () => {
      active = false;
    };
  }, [
    articleSlug,
    authorizeResource,
    bookSlug,
    externalBookToken,
    externalLinkKind,
    externalLinkToken,
    externalToken,
    isDraft,
    readOnly,
    reloadNonce,
    t,
  ]);

  const { article, book } = state;
  React.useEffect(() => {
    if (!article || externalToken || externalBookToken) return undefined;
    const commentAssetIds = collectCommentAssetIds(state.comments);
    const assetIds = [
      ...new Set(commentAssetIds.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id))),
    ];
    const attachmentIds = [
      ...new Set(commentAssetIds.filter((id) => /^\d+$/.test(id))),
    ];
    if (!assetIds.length && !attachmentIds.length) {
      setState((current) =>
        Object.keys(current.commentManifest || {}).length
          ? { ...current, commentManifest: {} }
          : current,
      );
      return undefined;
    }
    let active = true;
    api.resources
      .getArticleCommentAssetManifest(
        article.slug,
        assetIds,
        attachmentIds,
        book ? { bookId: book.id } : undefined,
      )
      .then((response) => {
        if (active)
          setState((current) => ({
            ...current,
            commentManifest: response.assets || {},
          }));
      })
      .catch(() => {
        if (active)
          setState((current) => ({ ...current, commentManifest: {} }));
      });
    return () => {
      active = false;
    };
  }, [article, book, externalBookToken, externalToken, state.comments]);
  const resourceContext = React.useMemo(
    () =>
      article
        ? {
            type: isDraft ? "drafts" : "articles",
            slug: article.slug,
            inBook: Boolean(book),
            bookId: book?.id,
            externalToken,
            externalBookToken,
            externalLinkPassword:
              externalLinkPassword ||
              getExternalLinkPassword(externalLinkKind, externalLinkToken),
          }
        : null,
    [article, book, externalBookToken, externalLinkPassword, externalToken],
  );
  const rendererTemplate = React.useMemo(
    () =>
      createContentRendererTemplate({
        t,
        navigate,
        assetManifest: state.manifest,
        resourceContext,
      }),
    [navigate, resourceContext, state.manifest, t],
  );
  const canComment =
    Boolean(user) &&
    (Boolean(user?.is_staff || user?.is_superuser) ||
      (config?.comment?.allow_user_comment &&
        (!config.comment.vip_only || user?.vip_level > 0)));
  const commentEnabled =
    !externalToken && !externalBookToken && !isDraft && !readOnly && canComment;
  const commentReadonly = isDraft || readOnly || !commentEnabled;
  const contextParams = book ? { bookId: book.id } : undefined;
  const commentEditor = React.useMemo(
    () => ({
      tools: extendContentEditorTools(
        buildDefaultEditorTools((key, fallback) => translate(t, key, fallback)),
        createContentEditorTools({
          t,
          attachments: commentAttachments,
          user,
          config,
          openWorkflow: (type, context) =>
            setCommentWorkflow({ open: true, type, context }),
        }),
      ),
      translate: (key, fallback) => translate(t, key, fallback),
    }),
    [commentAttachments, config, t, user],
  );
  const commentRendererTemplate = React.useMemo(
    () =>
      createContentRendererTemplate({
        t,
        navigate,
        assetManifest: { ...state.commentManifest, ...commentPreviews },
        resourceContext: { ...resourceContext, commentAssets: true },
      }),
    [commentPreviews, navigate, resourceContext, state.commentManifest, t],
  );
  const bookItems = React.useMemo(
    () =>
      createBookNavigatorItems(
        book,
        book?.articles,
        article?.id,
        t("admin.books.untitledGroup"),
      ),
    [article?.id, book],
  );
  const contentNavigatorItems = React.useMemo(
    () => createNavigatorItems(contentNavigation.items),
    [contentNavigation.items],
  );
  const hydratedComments = React.useMemo(
    () => hydrateCommentParticipants(state.comments, state.participants),
    [state.comments, state.participants],
  );

  const passwordModal = externalLinkToken ? (
    <Modal
      open={passwordModalOpen}
      onOpenChange={setPasswordModalOpen}
      title={translate(
        t,
        "externalLinkAccess.passwordTitle",
        "Password required",
      )}
      closeOnEsc={false}
      closeOnBackdrop={false}
      showCloseButton={false}
      actions={[
        {
          key: "submit",
          label: translate(t, "externalLinkAccess.passwordSubmit", "Verify"),
          keepOpen: true,
          onClick: () => {
            if (!externalLinkPassword) {
              setPasswordError(
                translate(
                  t,
                  "externalLinkAccess.passwordRequired",
                  "Enter the access password.",
                ),
              );
              return;
            }
            setExternalLinkPassword(
              externalLinkKind,
              externalLinkToken,
              externalLinkPassword,
            );
            setPasswordError("");
            setReloadNonce((value) => value + 1);
          },
        },
      ]}
    >
      <p>
        {translate(
          t,
          "externalLinkAccess.passwordDescription",
          "This external link is protected by an access password.",
        )}
      </p>
      <PasswordInput
        label={translate(
          t,
          "externalLinkAccess.passwordLabel",
          "Access password",
        )}
        value={externalLinkPassword}
        onChange={(event) => {
          setExternalLinkPasswordState(event.target.value);
          setPasswordError("");
        }}
        error={passwordError}
        autoFocus
        autoComplete="current-password"
      />
    </Modal>
  ) : null;

  if (state.loading)
    return (
      <main className="article-detail-reader">
        <p>{translate(t, "articleDetail.loading", "Loading article...")}</p>
        {passwordModal}
      </main>
    );
  if (state.error || !article)
    return (
      <main className="article-detail-reader">
        <p>
          {translate(
            t,
            "articleDetail.loadFailed",
            "Unable to load this article.",
          )}
        </p>
        {passwordModal}
      </main>
    );

  async function submitComment({ content, parentComment, replyTo }) {
    const { item: created, participants } =
      await api.resources.createArticleComment(
        article.slug,
        {
          content,
          ...(parentComment
            ? {
                parentId: parentComment.id,
                replyToId: replyTo?.id || parentComment.id,
              }
            : {}),
        },
        contextParams,
      );
    setState((current) =>
      parentComment
        ? {
            ...current,
            participants: mergeParticipants(current.participants, participants),
            comments: current.comments.map((item) =>
              String(item.id) === String(parentComment.id)
                ? { ...item, replies: [...(item.replies || []), created] }
                : item,
            ),
          }
        : {
            ...current,
            participants: mergeParticipants(current.participants, participants),
            comments: [created, ...current.comments],
          },
    );
  }
  async function editComment(target, content) {
    const { item: updated, participants } =
      await api.resources.updateArticleComment(
        article.slug,
        target.comment.id,
        { content },
        contextParams,
      );
    setState((current) => ({
      ...current,
      participants: mergeParticipants(current.participants, participants),
      comments: updateCommentInThreads(current.comments, updated.id, () => ({
        ...updated,
        replies: target.comment.replies || [],
      })),
    }));
  }
  async function deleteComment(target) {
    await api.resources.deleteArticleComment(
      article.slug,
      target.comment.id,
      contextParams,
    );
    setState((current) => ({
      ...current,
      comments: updateCommentInThreads(
        current.comments,
        target.comment.id,
        (comment) => ({ ...comment, content: "", is_deleted: true }),
      ),
    }));
  }
  async function voteComment(target, vote) {
    const reaction = await api.resources.setArticleCommentReaction(
      article.slug,
      target.comment.id,
      vote,
      contextParams,
    );
    setState((current) => ({
      ...current,
      comments: updateCommentInThreads(
        current.comments,
        reaction.commentId,
        (comment) => ({ ...comment, ...reaction }),
      ),
    }));
  }
  async function updateArticleInteraction(action, value) {
    const result =
      action === "star"
        ? await api.resources.setArticleStar(article.slug, value)
        : await api.resources.setArticleVote(article.slug, value);
    setState((current) => ({
      ...current,
      article: { ...current.article, interaction: result.interaction },
    }));
  }

  return (
    <main ref={setReaderElement} className="article-detail-reader">
      {bookItems.length > 0 && (
        <Navigator
          items={bookItems}
          currentKey={`article-${article.id}`}
          initialPosition="top-left"
          minPageWidth={900}
          expandedWidth={320}
          anchorSide="right"
          anchorElement={readerElement}
          anchorOffset={16}
          collapseBoundaryElement={readerElement}
          labels={{
            heading: translate(t, "articleDetail.chapters", "Chapters"),
          }}
          onNavigate={async (node) => {
            const target = node.data?.article;
            if (!target) return;
            if (externalBookToken) {
              navigate(
                `/external-link/books/${encodeURIComponent(externalBookToken)}?article=${encodeURIComponent(target.slug)}`,
              );
              return;
            }
            if (
              !(await authorizeResource({
                type: "article",
                id: target.id,
                name: target.title,
                context: { inBook: true, bookId: book.id },
              }))
            )
              return;
            navigate(
              `/books/${encodeURIComponent(book.slug)}?article=${encodeURIComponent(target.slug)}`,
            );
          }}
        />
      )}
      {contentNavigatorItems.length > 0 && (
        <Navigator
          items={contentNavigatorItems}
          currentKey={contentNavigation.activeId || undefined}
          initialPosition="top-right"
          minPageWidth={900}
          expandedWidth={320}
          anchorSide="left"
          anchorElement={readerElement}
          anchorOffset={16}
          collapseBoundaryElement={readerElement}
          labels={{
            heading: translate(
              t,
              "articleDetail.tableOfContents",
              "Table of Contents",
            ),
          }}
          onNavigate={(node) => contentNavigation.navigate(node.key)}
        />
      )}
      {passwordModal}
      {!article.suppress_detail_hero && (
        <Card
          className={`article-detail-reader__hero${article.coverUrl ? " article-detail-reader__hero--with-cover" : ""}`}
          interactive={false}
          style={
            article.coverUrl
              ? {
                  "--card-padding": "0",
                  backgroundImage: `url("${article.coverUrl}")`,
                }
              : { "--card-padding": "0" }
          }
          content={
            <div className="article-detail-reader__hero-content">
              <div className="article-detail-reader__title-row">
                <h1 id="article-detail-reader-title">{article.title}</h1>
                {getResourceAccessChannels(article).map((channel) => (
                  <AccessTag
                    key={`${channel.type}-${channel.value}`}
                    {...channel}
                  />
                ))}
                {!externalToken && !externalBookToken && (
                  <ArticleHeroFeedback
                    article={article}
                    disabled={readOnly || isDraft}
                    onStarChange={
                      isDraft
                        ? undefined
                        : (starred) => updateArticleInteraction("star", starred)
                    }
                  />
                )}
              </div>
              <div className="article-detail-reader__metadata">
                <span>
                  {article.author?.displayName || article.author?.username}
                </span>
                <div className="article-detail-reader__timestamps">
                  {article.publishedAt && (
                    <span className="article-detail-reader__timestamp">
                      {translate(t, "articleDetail.publishedAt", "Published")}
                      <time dateTime={article.publishedAt}>
                        {formatArticleDate(article.publishedAt, lang)}
                      </time>
                    </span>
                  )}
                  {article.updatedAt && (
                    <span className="article-detail-reader__timestamp">
                      {translate(t, "articleDetail.updatedAt", "Updated")}
                      <time dateTime={article.updatedAt}>
                        {formatArticleDate(article.updatedAt, lang)}
                      </time>
                    </span>
                  )}
                </div>
              </div>
              {article.abstract && (
                <p className="article-detail-reader__summary">
                  {article.abstract}
                </p>
              )}
              {article.tags?.length > 0 && (
                <div className="article-detail-reader__tags">
                  {article.tags.map((tag) => (
                    <ArticleTag
                      key={tag.id || tag.name}
                      className="article-detail-reader__tag"
                      tag={tag}
                      disabled={Boolean(externalToken || externalBookToken)}
                      onClick={
                        externalToken || externalBookToken
                          ? undefined
                          : () =>
                              navigate(
                                `/articles?tag=${encodeURIComponent(tag.name)}`,
                              )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          }
        />
      )}
      <article className="article-detail-reader__content">
        <ContentRenderer
          {...rendererTemplate}
          mode="article"
          value={normalizeArticleMarkdown(article.content)}
          onDocument={setDocument}
        />
        {!externalToken && !externalBookToken && (
          <ArticleFeedback
            article={article}
            disabled={readOnly || isDraft}
            onVoteChange={
              isDraft
                ? undefined
                : (vote) => updateArticleInteraction("vote", vote)
            }
          />
        )}
      </article>
      {(hydratedComments.length > 0 || canComment) && (
        <section className="article-detail-reader__comments">
          <CommentThread
            comments={hydratedComments}
            currentUserId={user?.id ? String(user.id) : null}
            getAuthorId={(author) => String(author.id)}
            renderAuthor={(author) => (
              <CommentAuthorIdentity
                author={author}
                isArticleAuthor={
                  String(author.id) === String(article.author?.id)
                }
                t={t}
              />
            )}
            renderReplyToAuthor={(author) => (
              <CommentAuthorIdentity
                author={author}
                isArticleAuthor={
                  String(author.id) === String(article.author?.id)
                }
                t={t}
              />
            )}
            renderContent={(comment) =>
              typeof comment.content === "string" ? (
                <ContentRenderer
                  {...commentRendererTemplate}
                  mode="comment"
                  value={normalizeArticleMarkdown(comment.content)}
                  anchorNavigation={{ enabled: false }}
                  options={{ enableHeadingAnchor: false }}
                />
              ) : (
                comment.content
              )
            }
            renderComposer={({
              value,
              placeholder,
              submitting,
              classes,
              onChange,
              onSubmit,
              onCancel,
              mode,
            }) => (
              <div className={classes.composer}>
                <RichTextEditor
                  value={value}
                  onChange={onChange}
                  placeholder={placeholder}
                  tools={commentEditor.tools}
                  translate={commentEditor.translate}
                  resolveAssetUrl={(id) =>
                    commentPreviews[id]?.url ||
                    commentPreviews[id] ||
                    state.commentManifest[id]?.inlineUrl
                  }
                  assetPreviewVersion={JSON.stringify([
                    commentPreviews,
                    state.commentManifest,
                  ])}
                  customBlockVersion={JSON.stringify(commentAttachments)}
                />
                <div className={classes.composerActions}>
                  <button
                    type="button"
                    className={classes.secondaryButton}
                    onClick={onCancel}
                    disabled={submitting}
                  >
                    {translate(t, "comments.cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    className={classes.primaryButton}
                    onClick={() => void onSubmit(value)}
                    disabled={submitting || !value.trim()}
                  >
                    {submitting
                      ? translate(t, "comments.loading", "Working...")
                      : mode === "edit"
                        ? translate(t, "comments.save", "Save changes")
                        : translate(t, "comments.publish", "Publish")}
                  </button>
                </div>
              </div>
            )}
            readonly={commentReadonly}
            isAdmin={Boolean(user?.is_staff || user?.is_superuser)}
            onSubmit={submitComment}
            onEdit={editComment}
            onDelete={deleteComment}
            onVote={voteComment}
            hasMore={state.hasMore}
            onLoadMore={() =>
              externalToken
                ? api.resources
                    .listExternalArticleComments(
                      externalToken,
                      {
                        offset: state.nextOffset,
                      },
                      externalLinkPassword ||
                        getExternalLinkPassword("articles", externalToken),
                    )
                    .then((data) =>
                      setState((current) => ({
                        ...current,
                        comments: [...current.comments, ...data.items],
                        participants: mergeParticipants(
                          current.participants,
                          data.participants,
                        ),
                        hasMore: data.hasMore,
                        nextOffset: data.nextOffset,
                      })),
                    )
                : loadComments(article.slug, book?.id, state.nextOffset)
            }
            translate={(key, fallback) => translate(t, key, fallback)}
          />
          <ContentResourceModals
            t={t}
            workflow={commentWorkflow}
            onOpenChange={(open) =>
              setCommentWorkflow((current) => ({ ...current, open }))
            }
            onMediaUploading={({ assetId, file }) => {
              const localUrl = URL.createObjectURL(file);
              setCommentPreviews((current) => ({
                ...current,
                [assetId]: { url: localUrl, localUrl, state: "uploading" },
              }));
            }}
            onMediaUploaded={(media, temporaryId) =>
              setCommentPreviews((current) => {
                const preview = current[temporaryId];
                if (preview?.localUrl) URL.revokeObjectURL(preview.localUrl);
                const { [temporaryId]: _, ...remaining } = current;
                return {
                  ...remaining,
                  // ContentRenderer resolves comment media through inlineUrl;
                  // retain url as well because the editor uses it for previews.
                  [media.assetId]: {
                    url: media.previewUrl,
                    inlineUrl: media.previewUrl,
                    state: "ready",
                  },
                };
              })
            }
            onMediaUploadFailed={(assetId, message) =>
              setCommentPreviews((current) => {
                if (current[assetId]?.localUrl)
                  URL.revokeObjectURL(current[assetId].localUrl);
                return {
                  ...current,
                  [assetId]: { ...current[assetId], state: "failed", message },
                };
              })
            }
            onAttachmentSelected={(attachment) =>
              setCommentAttachments((current) => ({
                ...current,
                [attachment.id]: attachment,
              }))
            }
          />
        </section>
      )}
      {!readOnly && !book && state.related.length > 0 && (
        <section className="article-detail-reader__related">
          <h2>{translate(t, "articleDetail.related", "More to read")}</h2>
          <div className="article-detail-reader__related-list">
            {state.related.map((item) => (
              <ArticleCard
                key={item.id}
                article={item}
                onClick={(article) => navigate(`/articles/${article.slug}`)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
