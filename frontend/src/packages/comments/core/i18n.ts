import type { CommentTranslate } from "./types.ts";

const DEFAULT_TRANSLATIONS: Record<string, string> = {
  "comments.title": "Comments",
  "comments.reply": "Reply",
  "comments.cancel": "Cancel",
  "comments.publish": "Publish",
  "comments.save": "Save changes",
  "comments.edit": "Edit",
  "comments.delete": "Delete",
  "comments.upvote": "Upvote",
  "comments.downvote": "Downvote",
  "comments.more": "More actions",
  "comments.loading": "Working...",
  "comments.showMore": "Show more comments",
  "comments.showReplies": "Show {count} replies",
  "comments.hideReplies": "Hide replies",
  "comments.noComments": "No comments yet. Start the conversation.",
  "comments.writeComment": "Write a comment...",
  "comments.replyPlaceholder": "Write a reply...",
  "comments.editPlaceholder": "Edit your comment...",
};

export const DEFAULT_TRANSLATIONS_COMMENTS = DEFAULT_TRANSLATIONS;

export function resolveCommentLabel(
  translate: CommentTranslate | undefined,
  key: string,
  fallback: string,
): string {
  if (translate) {
    return translate(key, fallback);
  }
  return DEFAULT_TRANSLATIONS[key] ?? fallback;
}
