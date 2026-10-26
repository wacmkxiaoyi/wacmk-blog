import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useI18n from "../../hooks/useI18n";
import api from "../../api";

export default function NewArticlePage({ profile = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api.resources
      .createDraft({
        title: "",
        abstract: "",
        content: "",
        visibility: "public",
      })
      .then((draft) => {
        if (!draft?.slug) throw new Error(t("articleEditor.createFailed"));
        navigate(
          `${profile ? "/profile/articles" : "/manage/articles"}/drafts/${encodeURIComponent(draft.slug)}/edit`,
          { replace: true },
        );
      })
      .catch((requestError) =>
        setError(
          requestError?.response?.data?.detail ||
            requestError.message ||
            t("articleEditor.createFailed"),
        ),
      );
  }, [navigate, t]);
  return (
    <main className="article-editor__loading">
      {error || t("articleEditor.creating")}
    </main>
  );
}
