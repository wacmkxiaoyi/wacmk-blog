import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import AttachmentAccessPolicy, {
  hasValidAccessPolicy,
} from "../../components/attachment-manager/AttachmentAccessPolicy";
import { buildDefaultEditorTools, RichTextEditor } from "../../packages/editor";
import useI18n from "../../hooks/useI18n";
import useAuth from "../../hooks/useAuth";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import api from "../../api";
import {
  ContentResourceModals,
  createContentEditorTools,
  extendContentEditorTools,
} from "../../utils/editor";
import ManageSidebar from "../../pages/manage/ManageSidebar";
import ProfileSidebar from "../../pages/profile/ProfileSidebar";
import { getArticleWritePermission } from "../../utils/articleWritePermission";
import ArticleCoverField from "./ArticleCoverField";
import {
  articlePayload,
  articleToValues,
  attachmentsFromManifest,
  emptyArticleValues,
  extractAssetIds,
  extractAttachmentIds,
} from "./articleEditorModel";
import "../../pages/manage/Basic/BasicSettingsPage.css";
import "./ArticleEditorPage.css";

function message(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  return (
    data?.detail ||
    Object.values(data || {})
      .flat()
      .find((value) => typeof value === "string") ||
    error?.message ||
    fallback
  );
}

export default function ArticleEditorPage({
  published = false,
  profile = false,
}) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const { config } = useSiteRuntime();
  const writePermission = getArticleWritePermission(user, config);
  const returnPath = profile ? "/profile?section=articles" : "/manage/articles";
  const [article, setArticle] = useState(null);
  const [values, setValues] = useState(emptyArticleValues);
  const [coverFile, setCoverFile] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [manifest, setManifest] = useState({});
  const [attachments, setAttachments] = useState({});
  const [previews, setPreviews] = useState({});
  const [workflow, setWorkflow] = useState({
    open: false,
    type: null,
    context: null,
  });
  const [saveState, setSaveState] = useState("loading");
  const [notice, setNotice] = useState(null);
  const savedRef = useRef("");
  const savingRef = useRef(false);
  const rerunRef = useRef(false);
  const dirtyRef = useRef(false);
  const valuesRef = useRef(values);
  const coverRef = useRef(coverFile);
  const removeRef = useRef(removeCover);
  valuesRef.current = values;
  coverRef.current = coverFile;
  removeRef.current = removeCover;

  const hydrate = async (item) => {
    const assetIds = extractAssetIds(item.content);
    const attachmentIds = extractAttachmentIds(item.content);
    const response = assetIds.length
      ? await api.resources.getAssetManifest(
          "drafts",
          item.slug,
          assetIds,
          attachmentIds,
        )
      : { assets: {} };
    const assets = response.assets || {};
    setManifest(assets);
    setAttachments((current) => ({
      ...current,
      ...attachmentsFromManifest(assets),
    }));
  };
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const item = published
          ? await api.resources.createRevision(slug)
          : await api.resources.getDraft(slug);
        if (!active) return;
        const next = articleToValues(item);
        setArticle(item);
        setValues(next);
        savedRef.current = JSON.stringify(next);
        setSaveState("saved");
        await hydrate(item);
      } catch (error) {
        if (active) {
          setSaveState("failed");
          setNotice({
            type: "error",
            message: message(error, t("articleEditor.loadFailed")),
          });
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [published, slug]);
  const dirty =
    article &&
    (savedRef.current !== JSON.stringify(values) ||
      Boolean(coverFile) ||
      removeCover);
  dirtyRef.current = dirty;
  const save = async ({ publish = false, automatic = false } = {}) => {
    if (!article) return;
    if (savingRef.current) {
      if (!automatic) rerunRef.current = true;
      return;
    }
    if (automatic && !dirtyRef.current) return;
    if (!valuesRef.current.title.trim()) {
      setNotice({ type: "error", message: t("articleEditor.titleRequired") });
      return;
    }
    if (!hasValidAccessPolicy(valuesRef.current)) {
      setNotice({
        type: "error",
        message: t("contentTemplate.editor.conditionRequired"),
      });
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    try {
      const saved = await api.resources.updateDraft(
        article.slug,
        articlePayload(valuesRef.current, removeRef.current),
        coverRef.current,
      );
      setArticle(saved);
      setValues(articleToValues(saved));
      setCoverFile(null);
      setRemoveCover(false);
      savedRef.current = JSON.stringify(articleToValues(saved));
      await hydrate(saved);
      if (publish) {
        const result = await api.resources.publishDraft(saved.slug);
        setSaveState("saved");
        navigate(returnPath);
        return;
      }
      setSaveState("saved");
      setNotice({
        type: "success",
        message: t(
          automatic ? "articleEditor.autoSaved" : "articleEditor.saved",
        ),
      });
    } catch (error) {
      setSaveState("failed");
      setNotice({
        type: "error",
        message: message(error, t("articleEditor.saveFailed")),
      });
    } finally {
      savingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void save();
      }
    }
  };
  useEffect(() => {
    const setting = config?.["content.article"];
    if (!article || !setting?.editor_autosave_enabled) return undefined;
    const interval =
      Math.max(1, Number(setting.editor_autosave_interval_minutes) || 5) *
      60_000;
    const timer = setInterval(() => void save({ automatic: true }), interval);
    return () => clearInterval(timer);
  }, [article?.slug, config]);
  useEffect(() => {
    const guard = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(
    () => () =>
      Object.values(previews).forEach(
        (preview) => preview.localUrl && URL.revokeObjectURL(preview.localUrl),
      ),
    [previews],
  );
  const translate = (key, fallback) => (t(key) === key ? fallback : t(key));
  const tools = extendContentEditorTools(
    buildDefaultEditorTools(translate),
    createContentEditorTools({
      t,
      attachments,
      user,
      config,
      openWorkflow: (type, context) =>
        setWorkflow({ open: true, type, context }),
    }),
  );
  const autosaveSetting = config?.["content.article"];
  const autosaveInterval = Math.max(
    1,
    Number(autosaveSetting?.editor_autosave_interval_minutes) || 5,
  );
  const content = !article ? (
    <div className="article-editor__loading">{t("articleEditor.loading")}</div>
  ) : (
    <div className="settings-shell article-editor">
      <header className="article-editor__heading">
        <span>{t("articleEditor.kicker")}</span>
        <h1>
          {article.draftKind === "revision"
            ? t("articleEditor.revisionTitle")
            : t("articleEditor.title")}
        </h1>
        {autosaveSetting?.editor_autosave_enabled && (
          <p className="article-editor__autosave">
            {t("articleEditor.autosaveEvery", { minutes: autosaveInterval })}
          </p>
        )}
      </header>
      <div className="article-editor__field">
        <label>{t("articleEditor.fields.title")}</label>
        <input
          value={values.title}
          maxLength="200"
          onChange={(event) =>
            setValues({ ...values, title: event.target.value })
          }
        />
      </div>
      <div className="article-editor__split">
        <ArticleCoverField
          label={t("articleEditor.fields.cover")}
          replaceLabel={t("articleEditor.replaceCover")}
          removeLabel={t("articleEditor.removeCover")}
          undoLabel={t("articleEditor.undoRemoveCover")}
          emptyLabel={t("articleEditor.emptyCover")}
          value={article.coverUrl}
          file={coverFile}
          remove={removeCover}
          disabled={saveState === "saving"}
          onFileChange={setCoverFile}
          onRemoveChange={setRemoveCover}
        />
        <div className="article-editor__details">
          <div className="article-editor__field">
            <label>
              {t("articleEditor.fields.slug")}{" "}
              <small>({t("articleEditor.slugHelp")})</small>
            </label>
            <input
              value={values.slug}
              placeholder={t("articleEditor.slugPlaceholder")}
              onChange={(event) =>
                setValues({ ...values, slug: event.target.value })
              }
            />
          </div>
          <div className="article-editor__field">
            <label>
              {t("articleEditor.fields.tags")}{" "}
              <small>({t("articleEditor.tagHelp")})</small>
            </label>
            <input
              value={values.tag_names}
              placeholder={t("articleEditor.tagPlaceholder")}
              onChange={(event) =>
                setValues({ ...values, tag_names: event.target.value })
              }
            />
          </div>
          <label className="article-editor__hero-toggle">
            <input
              type="checkbox"
              checked={values.suppress_detail_hero}
              onChange={(event) =>
                setValues({
                  ...values,
                  suppress_detail_hero: event.target.checked,
                })
              }
            />
            {t("articleEditor.fields.suppressHero")}
          </label>
        </div>
      </div>
      <div className="article-editor__field">
        <label>{t("articleEditor.fields.abstract")}</label>
        <textarea
          value={values.abstract}
          onChange={(event) =>
            setValues({ ...values, abstract: event.target.value })
          }
        />
      </div>
      <div className="article-editor__divider" />
      <section className="article-editor__access">
        <h2>{t("articleEditor.accessTitle")}</h2>
        <AttachmentAccessPolicy
          t={t}
          value={values}
          onChange={(policy) => setValues({ ...values, ...policy })}
          allowBookOnly
          vipPermissionLabel={t("articleEditor.vipVisibility")}
        />
        <div className="article-editor__reuse-permissions">
          <label>
            <input
              type="checkbox"
              checked={values.allow_quote}
              onChange={(event) =>
                setValues({ ...values, allow_quote: event.target.checked })
              }
            />
            {t("articleEditor.allowQuote")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={values.allow_reprint}
              onChange={(event) =>
                setValues({ ...values, allow_reprint: event.target.checked })
              }
            />
            {t("articleEditor.allowReprint")}
          </label>
        </div>
      </section>
      <div className="article-editor__divider" />
      <div className="article-editor__content">
        <label>{t("articleEditor.fields.content")}</label>
        <RichTextEditor
          value={values.content}
          tools={tools}
          onChange={(content) => setValues({ ...values, content })}
          translate={translate}
          resolveAssetUrl={(id) => previews[id] || manifest[id]?.inlineUrl}
          assetPreviewVersion={JSON.stringify([previews, manifest])}
          customBlockVersion={JSON.stringify(attachments)}
          minHeight={520}
        />
      </div>
      <footer className="article-editor__footer">
        <Button
          variant="secondary"
          loading={saveState === "saving"}
          disabled={!writePermission.allowed}
          onClick={() => void save()}
        >
          {t("articleEditor.saveDraft")}
        </Button>
        <Button
          loading={saveState === "saving"}
          disabled={!writePermission.allowed}
          onClick={() => void save({ publish: true })}
        >
          {t("articleEditor.publish")}
        </Button>
      </footer>
    </div>
  );
  return (
    <main
      className={profile ? "profile-page profile-editor-page" : "manage-page"}
    >
      {profile ? (
        <>
          <ProfileSidebar
            activeSection="articles"
            onSectionChange={(section) =>
              navigate(
                section === "basic"
                  ? "/profile"
                  : `/profile?section=${section}`,
              )
            }
          />
          <section className="profile-content">{content}</section>
        </>
      ) : (
        <>
          <ManageSidebar active="posts" />
          <section className="manage-content">{content}</section>
        </>
      )}
      <ContentResourceModals
        t={t}
        workflow={workflow}
        onOpenChange={(open) =>
          setWorkflow((current) => ({ ...current, open }))
        }
        onMediaUploading={({ assetId, file }) => {
          const localUrl = URL.createObjectURL(file);
          setPreviews((current) => ({
            ...current,
            [assetId]: { url: localUrl, localUrl, state: "uploading" },
          }));
        }}
        onMediaUploaded={(media, temporaryId) =>
          setPreviews((current) => {
            const currentPreview = current[temporaryId];
            if (currentPreview?.localUrl)
              URL.revokeObjectURL(currentPreview.localUrl);
            const { [temporaryId]: _, ...rest } = current;
            return {
              ...rest,
              [media.assetId]: { url: media.previewUrl, state: "ready" },
            };
          })
        }
        onMediaUploadFailed={(assetId, error) =>
          setPreviews((current) => ({
            ...current,
            [assetId]: { ...current[assetId], state: "failed", message: error },
          }))
        }
        onAttachmentSelected={(attachment) =>
          setAttachments((current) => ({
            ...current,
            [attachment.id]: attachment,
          }))
        }
      />
      <Toast
        visible={Boolean(notice)}
        type={notice?.type}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}
