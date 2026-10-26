import { useLocation, useParams } from "react-router-dom";
import { ArticleDetailReader } from "../../../utils/article-detail";

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  return (
    <ArticleDetailReader
      articleSlug={slug}
      isDraft={pathname.startsWith("/drafts/")}
    />
  );
}
