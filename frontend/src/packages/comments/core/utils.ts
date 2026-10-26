import type { Comment, CommentTarget } from "./types.ts";

export function getVisibleComments<TAuthor>(
  comments: Comment<TAuthor>[],
  pageSize: number,
  shownCount: number,
) {
  const safePageSize = Math.max(1, pageSize);
  const safeShownCount = Math.max(safePageSize, shownCount);
  return comments.slice(0, safeShownCount);
}

export function getNextShownCount(
  current: number,
  pageSize: number,
  total: number,
) {
  return Math.min(total, Math.max(1, current) + Math.max(1, pageSize));
}

export function canManageComment<TAuthor>(
  comment: Comment<TAuthor>,
  currentUserId: string | null | undefined,
  isAdmin: boolean,
  getAuthorId?: (author: TAuthor) => string | null | undefined,
) {
  if (isAdmin) {
    return true;
  }
  const authorId = getAuthorId?.(comment.author);
  return Boolean(currentUserId && authorId && currentUserId === authorId);
}

export function createCommentTarget<TAuthor>(
  comment: Comment<TAuthor>,
  parentComment: Comment<TAuthor> | null,
  depth: 0 | 1,
): CommentTarget<TAuthor> {
  return { comment, parentComment, depth };
}

export function getCommentText(content: Comment<unknown>["content"]) {
  return typeof content === "string" ? content : "";
}

export function getNextCommentVote(
  currentVote: "up" | "down" | null | undefined,
  clickedVote: "up" | "down",
) {
  return currentVote === clickedVote ? null : clickedVote;
}

export function getVoteCountsAfterChange(
  upvoteCount: number | undefined,
  downvoteCount: number | undefined,
  currentVote: "up" | "down" | null | undefined,
  nextVote: "up" | "down" | null,
) {
  let nextUpvoteCount = Math.max(0, upvoteCount || 0);
  let nextDownvoteCount = Math.max(0, downvoteCount || 0);

  if (currentVote === "up") nextUpvoteCount = Math.max(0, nextUpvoteCount - 1);
  if (currentVote === "down")
    nextDownvoteCount = Math.max(0, nextDownvoteCount - 1);
  if (nextVote === "up") nextUpvoteCount += 1;
  if (nextVote === "down") nextDownvoteCount += 1;

  return { upvoteCount: nextUpvoteCount, downvoteCount: nextDownvoteCount };
}
