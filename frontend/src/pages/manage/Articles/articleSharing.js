export function canShareArticle(activeTab, article) {
  return (
    activeTab === "published" &&
    article.kind === "published" &&
    article.visibility === "public"
  );
}
