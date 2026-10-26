import React from "react";
import { MarkdownPreset } from "../../packages/content-renderer";
import { LinkRenderer } from "../../packages/content-renderer/react/renderers/inlines/LinkRenderer.tsx";
import AttachmentCard from "../../components/attachment-card/AttachmentCard";
import ArticleCard from "../../components/article-card/ArticleCard";
import { Tooltip } from "../../packages/tooltip";
import api, { normalizeResourceAccessDecision } from "../../api";
import "./articleContentTemplate.css";

export function createContentLabels(t) {
  return {
    copy: t("contentTemplate.renderer.copy"),
    copied: t("contentTemplate.renderer.copied"),
    expand: t("contentTemplate.renderer.expand"),
    collapse: t("contentTemplate.renderer.collapse"),
    permalink: t("contentTemplate.renderer.permalink"),
  };
}

function assetIdFromUrl(value) {
  return String(value || "").startsWith("asset://")
    ? String(value).slice("asset://".length)
    : null;
}

export function getAttachmentAccessDecision(asset) {
  return normalizeResourceAccessDecision(asset?.accessDecision);
}

export function InvalidAttachmentBlock({
  title,
  label = "Attachment unavailable",
  description = "This attachment is temporarily unavailable for download. It may have been deleted, or you may not have access to it.",
  untitledLabel = "Untitled attachment",
} = {}) {
  return (
    <article className="content-attachment content-attachment--missing">
      <div className="content-attachment__missing-icon" aria-hidden="true">
        FILE
      </div>
      <div className="content-attachment__missing-body">
        <div className="content-attachment__missing-heading">
          <strong title={title || untitledLabel}>
            {title || untitledLabel}
          </strong>
          <span>{label}</span>
        </div>
        <p>{description}</p>
      </div>
    </article>
  );
}

function AttachmentBlock({
  node,
  assetManifest,
  resourceContext,
  onAttachmentDownload,
  unavailableLabel,
  unavailableDescription,
  untitledAttachmentLabel,
}) {
  const assetId = node.data?.assetId;
  const attachmentId = node.data?.attachmentId;
  const asset = assetManifest?.[attachmentId || assetId];
  if (!assetId || !asset)
    return (
      <InvalidAttachmentBlock
        title={node.data?.title}
        label={unavailableLabel}
        description={unavailableDescription}
        untitledLabel={untitledAttachmentLabel}
      />
    );
  const requestDownload = resourceContext?.externalBookToken
    ? () =>
        api.resources.requestExternalBookArticleAttachmentDownload(
          resourceContext.externalBookToken,
          resourceContext.slug,
          assetId,
          attachmentId || asset.attachmentId,
          resourceContext.externalLinkPassword,
        )
    : resourceContext?.externalToken
      ? () =>
          api.resources.requestExternalArticleAttachmentDownload(
            resourceContext.externalToken,
            assetId,
            attachmentId || asset.attachmentId,
            resourceContext.externalLinkPassword,
          )
      : resourceContext?.commentAssets
        ? () =>
            api.resources.requestArticleCommentAttachmentDownload(
              resourceContext.slug,
              assetId,
              attachmentId || asset.attachmentId,
              resourceContext.bookId
                ? { bookId: resourceContext.bookId }
                : undefined,
            )
        : resourceContext?.type && resourceContext?.slug
          ? () =>
              api.resources.requestAttachmentDownload(
                resourceContext.type,
                resourceContext.slug,
                assetId,
                attachmentId || asset.attachmentId,
                resourceContext.bookId
                  ? { bookId: resourceContext.bookId }
                  : undefined,
              )
          : null;
  return (
    <AttachmentCard
      attachment={{
        id: asset.attachmentId,
        assetId,
        title: asset.title || node.data?.title,
        original_filename: asset.filename,
        file_ext: asset.extension,
        fileSizeLabel: asset.sizeLabel,
        download_count: asset.downloadCount || 0,
        visibility: asset.visibility || "public",
        condition_rules: asset.conditionRules || [],
        access_scope: asset.accessScope || "unified",
        vip_access_permission: asset.vipAccessPermission || "public",
        vip_condition_rules: asset.vipConditionRules || [],
      }}
      accessDecision={getAttachmentAccessDecision(asset)}
      accessClient={api.resourceAccess}
      resourceContext={resourceContext?.inBook ? { inBook: true } : undefined}
      onDownload={onAttachmentDownload}
      requestDownload={requestDownload}
    />
  );
}

function isInternalContentHref(href) {
  return /^\/(articles|books)\/[^/?#]+\/?(?:[?#].*)?$/.test(href || "");
}

function createInternalLinkRenderer(navigate) {
  return function InternalLinkRenderer(props) {
    const { node } = props;
    if (!isInternalContentHref(node.href)) return <LinkRenderer {...props} />;
    const [article, setArticle] = React.useState(null);
    const [shouldLoad, setShouldLoad] = React.useState(false);
    const [isLinkActive, setIsLinkActive] = React.useState(false);
    const slug = node.href.split("/").filter(Boolean).pop();
    React.useEffect(() => {
      if (!shouldLoad) return undefined;
      const controller = new AbortController();
      api.resources
        .previewArticle(slug, undefined, { signal: controller.signal })
        .then((value) => !controller.signal.aborted && setArticle(value))
        .catch(() => {});
      return () => controller.abort();
    }, [shouldLoad, slug]);
    const link = (
      <a
        href={node.href}
        title={node.title}
        onMouseEnter={() => {
          setIsLinkActive(true);
          setShouldLoad(true);
        }}
        onMouseLeave={() => setIsLinkActive(false)}
        onFocus={() => {
          setIsLinkActive(true);
          setShouldLoad(true);
        }}
        onBlur={() => setIsLinkActive(false)}
        onClick={(event) => {
          event.preventDefault();
          navigate?.(node.href);
        }}
      >
        {node.children?.map((child, index) =>
          child.type === "text" ? (
            <React.Fragment key={index}>{child.value}</React.Fragment>
          ) : null,
        )}
      </a>
    );
    if (!shouldLoad) {
      return link;
    }
    if (!article) return link;
    return (
      <Tooltip
        content={
          <ArticleCard
            article={article}
            showTags={false}
            onClick={() => navigate?.(node.href)}
          />
        }
        width={420}
        backgroundColor="#fff"
        placement="top"
        openDelay={500}
        closeDelay={120}
        zIndex={2800}
        defaultOpen={isLinkActive}
      >
        {link}
      </Tooltip>
    );
  };
}

export function createContentRendererTemplate({
  t,
  navigate,
  assetManifest,
  resourceContext,
  onAttachmentDownload,
  labels = {},
} = {}) {
  const translate = (key, fallback) => {
    const translated = t?.(key);
    return translated && translated !== key ? translated : fallback;
  };
  return {
    format: "markdown",
    adapter: MarkdownPreset.adapter,
    plugins: MarkdownPreset.plugins,
    labels: { ...createContentLabels((key) => translate(key, key)), ...labels },
    // Existing ::html support is intentionally preserved by MarkdownPreset and CustomRenderer.
    resolvers: {
      image: (node) => {
        const asset = assetManifest?.[assetIdFromUrl(node.src)];
        return asset?.inlineUrl ? { ...node, src: asset.inlineUrl } : node;
      },
      video: (node) => {
        const asset = assetManifest?.[assetIdFromUrl(node.src)];
        const poster = assetManifest?.[assetIdFromUrl(node.poster)];
        return asset?.inlineUrl
          ? {
              ...node,
              src: asset.inlineUrl,
              ...(poster?.inlineUrl ? { poster: poster.inlineUrl } : {}),
            }
          : node;
      },
    },
    components: {
      inlines: {
        link: createInternalLinkRenderer(navigate),
      },
    },
    customComponents: {
      attachment: (props) => (
        <AttachmentBlock
          {...props}
          assetManifest={assetManifest}
          resourceContext={resourceContext}
          onAttachmentDownload={onAttachmentDownload}
          unavailableLabel={translate(
            "attachment.unavailable",
            "Attachment unavailable",
          )}
          unavailableDescription={translate(
            "attachment.unavailableDescription",
            "This attachment is temporarily unavailable for download. It may have been deleted, or you may not have access to it.",
          )}
          untitledAttachmentLabel={translate(
            "attachment.untitled",
            "Untitled attachment",
          )}
        />
      ),
    },
  };
}

export function normalizeArticleMarkdown(value) {
  return String(value || "");
}

export function getInternalContentPath(href) {
  return isInternalContentHref(href) ? href : null;
}
