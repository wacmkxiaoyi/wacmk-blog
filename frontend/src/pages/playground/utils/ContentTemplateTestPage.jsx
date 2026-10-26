import React from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button.jsx";
import {
  buildDefaultEditorTools,
  RichTextEditor,
} from "../../../packages/editor";
import { ContentRenderer } from "../../../packages/content-renderer";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import api from "../../../api";
import {
  ContentResourceModals,
  createContentEditorTools,
  extendContentEditorTools,
} from "../../../utils/editor";
import {
  createContentRendererTemplate,
  normalizeArticleMarkdown,
} from "../../../utils/content-renderer";
import "./ContentTemplateTestPage.css";

const INITIAL_MARKDOWN = [
  "# Content Utility Template",
  "",
  "Use the editor tools to upload media, insert an attachment, or reference an internal article.",
].join("\n");

function extractAssetIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/assetId="([0-9a-fA-F-]{36})"/g)].map(
        ([, assetId]) => assetId,
      ),
    ),
  ];
}

function extractAttachmentIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/attachmentId="(\d+)"/g)].map(
        ([, attachmentId]) => attachmentId,
      ),
    ),
  ];
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return (
    data?.detail ||
    data?.content ||
    Object.values(data || {})
      .flat()
      .find((value) => typeof value === "string") ||
    error?.message ||
    fallback
  );
}

function attachmentsFromManifest(assets) {
  return Object.fromEntries(
    Object.entries(assets || {})
      .filter(([, asset]) => asset.attachmentId)
      .map(([assetId, asset]) => [
        asset.attachmentId || assetId,
        {
          id: asset.attachmentId,
          assetId,
          title: asset.title,
          original_filename: asset.filename,
          file_ext: asset.extension,
          fileSizeLabel: asset.sizeLabel,
          download_count: asset.downloadCount,
          visibility: asset.visibility,
          condition_rules: asset.conditionRules,
          access_scope: asset.accessScope,
          vip_access_permission: asset.vipAccessPermission,
          vip_condition_rules: asset.vipConditionRules,
        },
      ]),
  );
}

export default function ContentTemplateTestPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { config } = useSiteRuntime();
  const { t } = useI18n();
  const [article, setArticle] = React.useState(null);
  const [markdown, setMarkdown] = React.useState("");
  const [assetManifest, setAssetManifest] = React.useState({});
  const [assetPreviews, setAssetPreviews] = React.useState({});
  const [draftAttachments, setDraftAttachments] = React.useState({});
  const [workflow, setWorkflow] = React.useState({
    open: false,
    type: null,
    context: null,
  });
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const hydrateArticleAssets = React.useCallback(async (value) => {
    const assetIds = extractAssetIds(value.content);
    const attachmentIds = extractAttachmentIds(value.content);
    const manifest = assetIds.length
      ? await api.resources.getAssetManifest(
          "drafts",
          value.slug,
          assetIds,
          attachmentIds,
        )
      : { assets: {} };
    const assets = manifest.assets || {};
    setAssetManifest(assets);
    setDraftAttachments((current) => ({
      ...current,
      ...attachmentsFromManifest(assets),
    }));
  }, []);

  React.useEffect(() => {
    if (loading || !user?.id) return undefined;
    let active = true;
    const slug = `playground-test-${user.id}`;
    async function loadArticle() {
      setError("");
      try {
        let value;
        try {
          value = await api.resources.getDraft(slug);
        } catch (requestError) {
          if (requestError?.response?.status !== 404) throw requestError;
          value = await api.resources.createDraft({
            title: slug,
            summary: t("contentTemplate.playground.privateSummary"),
            content: INITIAL_MARKDOWN,
            visibility: "private",
          });
        }
        if (value.slug !== slug || value.author?.id !== user.id)
          throw new Error(
            t("contentTemplate.playground.articleOwnershipError"),
          );
        if (!active) return;
        setArticle(value);
        setMarkdown(value.content || INITIAL_MARKDOWN);
        await hydrateArticleAssets(value);
      } catch (requestError) {
        if (active)
          setError(
            errorMessage(
              requestError,
              t("contentTemplate.playground.prepareFailed"),
            ),
          );
      }
    }
    loadArticle();
    return () => {
      active = false;
    };
  }, [hydrateArticleAssets, loading, t, user?.id]);

  const saveAndRefresh = React.useCallback(async () => {
    if (!article) return;
    setSaving(true);
    setError("");
    try {
      const saved = await api.resources.updateDraft(article.slug, {
        content: markdown,
      });
      setArticle(saved);
      setMarkdown(saved.content);
      await hydrateArticleAssets(saved);
    } catch (requestError) {
      setError(
        errorMessage(requestError, t("contentTemplate.playground.saveFailed")),
      );
    } finally {
      setSaving(false);
    }
  }, [article, hydrateArticleAssets, markdown, t]);

  const tools = React.useMemo(
    () =>
      extendContentEditorTools(
        buildDefaultEditorTools((key, fallback) =>
          t(key) === key ? fallback : t(key),
        ),
        createContentEditorTools({
          t,
          attachments: draftAttachments,
          user,
          config,
          openWorkflow: (type, context) =>
            setWorkflow({ open: true, type, context }),
        }),
      ),
    [config, draftAttachments, t, user],
  );
  const resourceContext = React.useMemo(
    () =>
      article
        ? {
            type: "articles",
            slug: article.slug,
            inBook: false,
          }
        : null,
    [article],
  );
  const previewManifest = React.useMemo(
    () => ({
      ...assetManifest,
      ...Object.fromEntries(
        Object.entries(assetPreviews)
          .filter(([, preview]) => preview.url)
          .map(([assetId, preview]) => [
            assetId,
            { kind: "media", state: preview.state, inlineUrl: preview.url },
          ]),
      ),
      ...Object.fromEntries(
        Object.entries(draftAttachments).map(([, attachment]) => [
          attachment.id,
          {
            kind: "attachment",
            state: "available",
            attachmentId: attachment.id,
            title: attachment.title,
            filename: attachment.original_filename,
            extension: attachment.file_ext,
            sizeLabel: attachment.fileSizeLabel,
            downloadCount: attachment.download_count,
            visibility: attachment.visibility,
            conditionRules: attachment.condition_rules,
            accessScope: attachment.access_scope,
            vipAccessPermission: attachment.vip_access_permission,
            vipConditionRules: attachment.vip_condition_rules,
          },
        ]),
      ),
    }),
    [assetManifest, assetPreviews, draftAttachments],
  );
  const rendererTemplate = React.useMemo(
    () =>
      createContentRendererTemplate({
        t,
        navigate,
        assetManifest: previewManifest,
        resourceContext,
      }),
    [article, navigate, previewManifest, resourceContext, t],
  );
  const resolveAssetUrl = React.useCallback(
    (assetId) => assetPreviews[assetId] || assetManifest[assetId]?.inlineUrl,
    [assetManifest, assetPreviews],
  );
  React.useEffect(
    () => () =>
      Object.values(assetPreviews).forEach((preview) => {
        if (preview.localUrl) URL.revokeObjectURL(preview.localUrl);
      }),
    [assetPreviews],
  );

  return (
    <main className="content-template-test-page">
      <section className="content-template-test-page__hero">
        <div>
          <p>/test/frontend/utils/content-template</p>
          <h1>{t("contentTemplate.playground.title")}</h1>
          <span>
            {article
              ? t("contentTemplate.playground.privateArticle").replace(
                  "{slug}",
                  article.slug,
                )
              : t("contentTemplate.playground.preparing")}
          </span>
        </div>
        <div>
          <Button
            variant="primary"
            disabled={!article || saving}
            onClick={saveAndRefresh}
          >
            {saving
              ? t("contentTemplate.playground.saving")
              : t("contentTemplate.playground.saveAndRefresh")}
          </Button>
          <Button onClick={() => navigate("/home")}>
            {t("contentTemplate.playground.backHome")}
          </Button>
        </div>
      </section>
      {error ? (
        <p className="content-template-test-page__error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="content-template-test-page__grid">
        <article>
          <h2>{t("contentTemplate.playground.editor")}</h2>
          <p>{t("contentTemplate.playground.editorDescription")}</p>
          <RichTextEditor
            value={markdown}
            tools={tools}
            onChange={setMarkdown}
            translate={(key, fallback) => (t(key) === key ? fallback : t(key))}
            resolveAssetUrl={resolveAssetUrl}
            assetPreviewVersion={JSON.stringify([assetPreviews, assetManifest])}
            customBlockVersion={JSON.stringify(draftAttachments)}
            minHeight={360}
          />
        </article>
        <article>
          <h2>{t("contentTemplate.playground.renderer")}</h2>
          <p>{t("contentTemplate.playground.rendererDescription")}</p>
          <ContentRenderer
            {...rendererTemplate}
            value={normalizeArticleMarkdown(markdown)}
            options={{ enableHeadingAnchor: false }}
          />
        </article>
      </section>
      <ContentResourceModals
        t={t}
        workflow={workflow}
        onMediaUploading={({ assetId, file }) => {
          const localUrl = URL.createObjectURL(file);
          setAssetPreviews((current) => ({
            ...current,
            [assetId]: { url: localUrl, localUrl, state: "uploading" },
          }));
        }}
        onMediaUploaded={(media, temporaryAssetId) =>
          media.previewUrl &&
          setAssetPreviews((current) => {
            const temporary = current[temporaryAssetId];
            if (temporary?.localUrl) URL.revokeObjectURL(temporary.localUrl);
            const { [temporaryAssetId]: _temporary, ...rest } = current;
            return {
              ...rest,
              [media.assetId]: { url: media.previewUrl, state: "ready" },
            };
          })
        }
        onMediaUploadFailed={(assetId, message) =>
          setAssetPreviews((current) => ({
            ...current,
            [assetId]: { ...current[assetId], state: "failed", message },
          }))
        }
        onAttachmentSelected={(attachment) =>
          setDraftAttachments((current) => ({
            ...current,
            [attachment.id]: attachment,
          }))
        }
        onOpenChange={(open) =>
          setWorkflow((current) => ({ ...current, open }))
        }
      />
    </main>
  );
}
