import { useParams, useSearchParams } from "react-router-dom";
import { ArticleDetailReader } from "../../../utils/article-detail";

export default function BookDetailPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  return (
    <ArticleDetailReader articleSlug={params.get("article")} bookSlug={slug} />
  );
}
