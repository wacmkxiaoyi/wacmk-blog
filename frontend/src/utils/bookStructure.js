import {
  createGroup,
  isCatalogGroup,
} from "../packages/catalog-manager/core/tree-utils";

export function bookStructureToCatalog(structure, articles = []) {
  const articlesById = new Map(
    articles.map((article) => [article.id, article]),
  );

  function convert(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.flatMap((node) => {
      if (!node || typeof node !== "object") return [];
      if (node.type === "group") {
        const group = createGroup(String(node.title || "").trim() || "Group");
        group.children = convert(node.children);
        return [group];
      }
      if (node.type !== "article" || !Number.isInteger(node.article_id))
        return [];
      const article = articlesById.get(node.article_id);
      return [
        {
          ...article,
          id: node.article_id,
          title: article?.title || `#${node.article_id}`,
        },
      ];
    });
  }

  return convert(structure);
}

export function catalogToBookStructure(items) {
  const articleIds = new Set();

  function convert(nodes) {
    if (!Array.isArray(nodes)) return [];
    return nodes.flatMap((node) => {
      if (isCatalogGroup(node)) {
        const title = node.title.trim();
        if (!title) return [];
        return [{ type: "group", title, children: convert(node.children) }];
      }
      if (!node || typeof node !== "object" || !Number.isInteger(node.id))
        return [];
      if (articleIds.has(node.id)) return [];
      articleIds.add(node.id);
      return [{ type: "article", article_id: node.id }];
    });
  }

  return convert(items);
}
