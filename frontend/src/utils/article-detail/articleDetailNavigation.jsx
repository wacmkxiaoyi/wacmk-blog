import React from "react";
import { getResourceAccessChannels } from "../../components/access-tag/resourceAccessTags";
import AccessTag from "../../components/access-tag/AccessTag";

function nodesFromStructure(
  structure,
  articlesById,
  currentArticleId,
  untitledGroup,
  path = [],
) {
  if (!Array.isArray(structure)) return [];
  return structure.flatMap((item, index) => {
    const itemPath = [...path, index];
    if (!item || typeof item !== "object") return [];
    if (item.type === "group") {
      const children = nodesFromStructure(
        item.children,
        articlesById,
        currentArticleId,
        untitledGroup,
        itemPath,
      );
      if (!children.length) return [];
      return [
        {
          key: `group-${itemPath.join("-")}`,
          label: item.title || untitledGroup,
          clickable: false,
          children,
        },
      ];
    }
    if (item.type !== "article") return [];
    const article = articlesById.get(String(item.article_id));
    if (!article) return [];
    const accessChannels = getResourceAccessChannels(article);
    return [
      {
        key: `article-${article.id}`,
        label: (
          <span className="article-detail-book-access-tags">
            <span>{article.title}</span>
            {accessChannels.map((channel, channelIndex) => (
              <AccessTag
                key={`${channel.isVIP ? "vip" : "common"}-${channelIndex}`}
                {...channel}
                iconOnly
              />
            ))}
          </span>
        ),
        active: String(article.id) === String(currentArticleId),
        data: { article, accessChannels },
      },
    ];
  });
}

export function createBookNavigatorItems(
  book,
  articles,
  currentArticleId,
  untitledGroup = "Untitled",
) {
  const articlesById = new Map(
    (articles || []).map((article) => [String(article.id), article]),
  );
  return nodesFromStructure(
    book?.structure,
    articlesById,
    currentArticleId,
    untitledGroup,
  );
}

export function updateCommentInThreads(threads, commentId, updater) {
  return threads.map((thread) => {
    if (String(thread.id) === String(commentId)) return updater(thread);
    return {
      ...thread,
      replies: (thread.replies || []).map((reply) =>
        String(reply.id) === String(commentId) ? updater(reply) : reply,
      ),
    };
  });
}
