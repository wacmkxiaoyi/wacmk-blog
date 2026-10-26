import type { ReactNode } from "react";

export type CommentContent = string | ReactNode;

export type CommentVote = "up" | "down" | null;

export type CommentTranslate = (key: string, fallback: string) => string;

export type CommentAuthorRenderContext<TAuthor> = {
  author: TAuthor;
  comment: Comment<TAuthor>;
  depth: 0 | 1;
  isOwner: boolean;
  isAdmin: boolean;
};

export type Comment<TAuthor = unknown> = {
  id: string;
  author: TAuthor;
  content: CommentContent;
  createdAt: string | number | Date;
  updatedAt?: string | number | Date;
  upvoteCount?: number;
  downvoteCount?: number;
  viewerVote?: CommentVote;
  isAdmin?: boolean;
  replies?: Comment<TAuthor>[];
  replyTo?: {
    commentId: string;
    author: TAuthor;
  };
};

export type CommentTarget<TAuthor> = {
  comment: Comment<TAuthor>;
  parentComment: Comment<TAuthor> | null;
  depth: 0 | 1;
};

export type CommentSubmitPayload<TAuthor> = {
  content: string;
  parentComment: Comment<TAuthor> | null;
  replyTo: Comment<TAuthor> | null;
};

export type CommentThreadProps<TAuthor = unknown> = {
  comments: Comment<TAuthor>[];
  currentUserId?: string | null;
  getAuthorId?: (author: TAuthor) => string | null | undefined;
  renderAuthor: (
    author: TAuthor,
    context: CommentAuthorRenderContext<TAuthor>,
  ) => ReactNode;
  renderReplyToAuthor?: (
    author: TAuthor,
    comment: Comment<TAuthor>,
  ) => ReactNode;
  renderContent?: (comment: Comment<TAuthor>) => ReactNode;
  formatDate?: (
    date: Comment<TAuthor>["createdAt"],
    comment: Comment<TAuthor>,
  ) => ReactNode;
  readonly?: boolean;
  isAdmin?: boolean;
  pageSize?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void | Promise<void>;
  onSubmit?: (payload: CommentSubmitPayload<TAuthor>) => void | Promise<void>;
  onEdit?: (
    target: CommentTarget<TAuthor>,
    content: string,
  ) => void | Promise<void>;
  onDelete?: (target: CommentTarget<TAuthor>) => void | Promise<void>;
  onVote?: (
    target: CommentTarget<TAuthor>,
    nextVote: CommentVote,
  ) => void | Promise<void>;
  renderComposer?: (props: CommentComposerRenderProps<TAuthor>) => ReactNode;
  translate?: CommentTranslate;
  className?: string;
};

export type CommentComposerRenderProps<TAuthor> = {
  mode: "create" | "reply" | "edit";
  target: CommentTarget<TAuthor> | null;
  initialValue: string;
  value: string;
  placeholder: string;
  submitting: boolean;
  classes: {
    composer: string;
    composerActions: string;
    primaryButton: string;
    secondaryButton: string;
  };
  onChange: (content: string) => void;
  onSubmit: (content: string) => void | Promise<void>;
  onCancel: () => void;
};
