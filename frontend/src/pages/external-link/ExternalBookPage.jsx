import { useSearchParams, useParams } from "react-router-dom";
import { ArticleDetailReader } from "../../utils/article-detail";

export default function ExternalBookPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  return (
    <ArticleDetailReader
      articleSlug={params.get("article") || "external"}
      externalBookToken={token}
      readOnly
    />
  );
}
