import { useParams } from "react-router-dom";
import { ArticleDetailReader } from "../../utils/article-detail";

export default function ExternalArticlePage() {
  const { token } = useParams();
  return (
    <ArticleDetailReader
      articleSlug="external"
      externalToken={token}
      readOnly
    />
  );
}
