import { describe, expect, it } from "vitest";
import {
  canManageComment,
  getNextCommentVote,
  getNextShownCount,
  getVisibleComments,
  getVoteCountsAfterChange,
} from "../core/index.ts";

describe("comments utilities", () => {
  const comments = ["one", "two", "three"].map((id) => ({
    id,
    author: { id },
    content: id,
    createdAt: "2026-01-01",
  }));

  it("paginates comments without exceeding available records", () => {
    expect(
      getVisibleComments(comments, 2, 2).map((comment) => comment.id),
    ).toEqual(["one", "two"]);
    expect(getNextShownCount(2, 2, comments.length)).toBe(3);
  });

  it("allows admins and comment owners to manage a comment", () => {
    expect(
      canManageComment(comments[0], "one", false, (author) => author.id),
    ).toBe(true);
    expect(
      canManageComment(comments[0], "two", false, (author) => author.id),
    ).toBe(false);
    expect(
      canManageComment(comments[0], "two", true, (author) => author.id),
    ).toBe(true);
  });

  it("toggles, cancels, and switches a viewer vote without double-counting", () => {
    expect(getNextCommentVote(null, "up")).toBe("up");
    expect(getNextCommentVote("up", "up")).toBeNull();
    expect(getNextCommentVote("up", "down")).toBe("down");
    expect(getVoteCountsAfterChange(4, 2, null, "up")).toEqual({
      upvoteCount: 5,
      downvoteCount: 2,
    });
    expect(getVoteCountsAfterChange(5, 2, "up", null)).toEqual({
      upvoteCount: 4,
      downvoteCount: 2,
    });
    expect(getVoteCountsAfterChange(5, 2, "up", "down")).toEqual({
      upvoteCount: 4,
      downvoteCount: 3,
    });
    expect(getVoteCountsAfterChange(0, 0, "down", "up")).toEqual({
      upvoteCount: 1,
      downvoteCount: 0,
    });
  });
});
