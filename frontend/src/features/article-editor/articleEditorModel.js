export const emptyArticleValues = {
  title: "",
  slug: "",
  abstract: "",
  content: "",
  suppress_detail_hero: false,
  allow_quote: true,
  allow_reprint: false,
  tag_names: "",
  visibility: "public",
  condition_rules: [],
  access_scope: "unified",
  vip_access_permission: "public",
  vip_condition_rules: [],
};

export function articleToValues(article) {
  return {
    ...emptyArticleValues,
    ...article,
    // New drafts keep a stable internal slug for routing, but do not expose a
    // placeholder slug until the author has supplied a title.
    slug: article?.title ? article.slug || "" : "",
    tag_names: Array.isArray(article?.tags)
      ? article.tags.map((tag) => tag.name).join(", ")
      : "",
    condition_rules: Array.isArray(article?.condition_rules)
      ? article.condition_rules
      : [],
    vip_condition_rules: Array.isArray(article?.vip_condition_rules)
      ? article.vip_condition_rules
      : [],
  };
}

export function articlePayload(values, removeCover) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    abstract: values.abstract,
    content: values.content,
    suppress_detail_hero: Boolean(values.suppress_detail_hero),
    allow_quote: Boolean(values.allow_quote),
    allow_reprint: Boolean(values.allow_reprint),
    tag_names: values.tag_names,
    visibility: values.visibility,
    condition_rules: values.condition_rules,
    access_scope: values.access_scope,
    vip_access_permission: values.vip_access_permission,
    vip_condition_rules: values.vip_condition_rules,
    ...(removeCover ? { remove_cover: true } : {}),
  };
}

export function extractAssetIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/assetId="([0-9a-fA-F-]{36})"/g)].map(
        ([, id]) => id,
      ),
    ),
  ];
}

export function extractAttachmentIds(markdown) {
  return [
    ...new Set(
      [...String(markdown || "").matchAll(/attachmentId="(\d+)"/g)].map(
        ([, id]) => id,
      ),
    ),
  ];
}

export function attachmentsFromManifest(assets = {}) {
  return Object.fromEntries(
    Object.entries(assets)
      .filter(([, asset]) => asset.attachmentId)
      .map(([assetId, asset]) => [
        asset.attachmentId,
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
