import axios from "axios";
import {
  buildLoginRedirectPath,
  getCurrentLocationPath,
} from "./utils/authRedirect";

const request = axios.create({ baseURL: "/api" });
let isRefreshing = false;
let failedQueue = [];
let pendingMeRequest = null;

function unwrap(response) {
  return response.data;
}

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  failedQueue = [];
}

function managedListParams(
  { query, page, pageSize, sortKey, sortDirection },
  fallbackOrder,
) {
  return {
    query,
    page,
    page_size: pageSize,
    ordering: sortKey
      ? `${sortDirection === "desc" ? "-" : ""}${sortKey}`
      : fallbackOrder,
  };
}

function normalizeCondition(condition = {}) {
  const discountRate = condition.discount_rate;
  return {
    id: condition.id,
    type: condition.type || "unknown",
    icon: condition.icon,
    label: condition.label,
    tone: condition.tone,
    requirement: condition.requirement,
    status: condition.status || "invalid_condition",
    action: condition.action || "none",
    originalRequirement: condition.original_requirement,
    discountedRequirement: condition.discounted_requirement,
    discountRate,
    discountPercent:
      condition.discount_percent ??
      (Number.isFinite(Number(discountRate))
        ? Number(discountRate) * 100
        : undefined),
    discountApplied: condition.discount_applied === true,
  };
}

export function normalizeResourceAccessDecision(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.all_granted !== "boolean" ||
    !Array.isArray(payload.conditions)
  )
    return null;
  return {
    resourceType: payload.resource_type,
    resourceId: payload.resource_id,
    label: payload.label,
    accessScope: payload.access_scope,
    effectiveChannel: payload.effective_channel,
    isVip: payload.is_vip === true,
    allGranted: payload.all_granted,
    canFinalize: payload.can_finalize === true,
    settlementRequired: payload.settlement_required === true,
    conditions: payload.conditions.map(normalizeCondition),
  };
}

function accessPath(resource) {
  return `/resources/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}/access`;
}

function resourceAccessContext(resource) {
  return {
    book_context: Boolean(resource.context?.inBook),
    ...(resource.context?.bookId ? { bookId: resource.context.bookId } : {}),
  };
}

function accessError(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function articleFormData(payload, coverFile) {
  if (!coverFile && !payload.remove_cover) return payload;
  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === "tag_ids")
      value.forEach((id) => body.append("tag_ids", String(id)));
    else if (key === "condition_rules" || key === "vip_condition_rules")
      body.append(key, JSON.stringify(value));
    else body.append(key, String(value));
  });
  if (coverFile) body.append("cover_image", coverFile);
  return body;
}

function bookFormData(payload, coverFile) {
  if (!coverFile && !payload.remove_cover) return payload;
  const body = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (["structure", "condition_rules", "vip_condition_rules"].includes(key))
      body.append(key, JSON.stringify(value));
    else body.append(key, String(value));
  });
  if (coverFile) body.append("cover_image", coverFile);
  return body;
}

function getCookie(name) {
  for (const cookie of document.cookie.split(";")) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value || "");
  }
  return "";
}

function externalLinkConfig(password, config = {}) {
  return password
    ? {
        ...config,
        headers: { ...config.headers, "X-External-Link-Password": password },
      }
    : config;
}

request.interceptors.request.use((config) => {
  const access = localStorage.getItem("access_token");
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

request.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error) || error.code === "ERR_CANCELED")
      return Promise.reject(error);
    const originalRequest = error.config;
    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry
    )
      return Promise.reject(error);
    if (isRefreshing) {
      return new Promise((resolve, reject) =>
        failedQueue.push({ resolve, reject }),
      ).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return request(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) {
      isRefreshing = false;
      clearTokens();
      return Promise.reject(error);
    }
    try {
      const { data } = await axios.post("/api/auth/refresh/", { refresh });
      setTokens(data.access, data.refresh);
      processQueue(null, data.access);
      originalRequest.headers.Authorization = `Bearer ${data.access}`;
      return request(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      clearTokens();
      window.location.replace(buildLoginRedirectPath(getCurrentLocationPath()));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export function setTokens(access, refresh) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  pendingMeRequest = null;
}

export const api = {
  i18n: {
    setLanguage: (language) =>
      axios.post("/i18n/setlang/", `language=${encodeURIComponent(language)}`, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      }),
  },
  auth: {
    login: (username, password, rememberMe) =>
      request
        .post("/auth/login/", { username, password, remember_me: rememberMe })
        .then(unwrap),
    register: (credentials) =>
      request.post("/auth/register/", credentials).then(unwrap),
    sendRegistrationCode: (email) =>
      request.post("/auth/register/send-code/", { email }).then(unwrap),
    sendPasswordResetCode: (username) =>
      request.post("/auth/forgot-password/", { username }).then(unwrap),
    resetPassword: (username, code, newPassword) =>
      request
        .post("/auth/reset-password/", {
          username,
          code,
          new_password: newPassword,
        })
        .then(unwrap),
    getMe: () => {
      if (!pendingMeRequest)
        pendingMeRequest = request
          .get("/auth/me/")
          .then(unwrap)
          .finally(() => {
            pendingMeRequest = null;
          });
      return pendingMeRequest;
    },
  },
  runtime: {
    getConfig: (version, config = {}) =>
      request.get("/site/config/", {
        ...config,
        params: version ? { version } : undefined,
      }),
  },
  dashboard: {
    getHome: (config = {}) =>
      request.get("/dashboard/home/", config).then(unwrap),
  },
  tags: {
    list: ({ query = "" } = {}, config = {}) =>
      request
        .get("/tags/", { ...config, params: query ? { query } : undefined })
        .then(unwrap),
  },
  namecards: {
    get: (id, config = {}) =>
      request.get(`/users/${id}/namecard/`, config).then(unwrap),
  },
  profile: {
    get: (config = {}) => request.get("/profile/", config).then(unwrap),
    save: (values, avatarFile) => {
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined)
          body.append(key, value === null ? "" : String(value));
      });
      if (avatarFile) body.append("avatar", avatarFile);
      return request.patch("/profile/", body).then(unwrap);
    },
    sendEmailChangeCode: (email) =>
      request.post("/profile/email/send-code/", { email }).then(unwrap),
    changeEmail: (email, verificationCode) =>
      request
        .patch("/profile/email/", {
          email,
          verification_code: verificationCode,
        })
        .then(unwrap),
    changePassword: (values) =>
      request.post("/profile/password/", values).then(unwrap),
    getMoneyHistory: ({ page, pageSize }, config = {}) =>
      request
        .get("/profile/money-history/", {
          ...config,
          params: { page, page_size: pageSize },
        })
        .then(unwrap),
    getPointsHistory: ({ page, pageSize }, config = {}) =>
      request
        .get("/profile/points-history/", {
          ...config,
          params: { page, page_size: pageSize },
        })
        .then(unwrap),
  },
  resources: {
    listArticles: (params, config = {}) =>
      request.get("/resources/articles/", { ...config, params }).then(unwrap),
    listMyArticles: (params, config = {}) =>
      request
        .get("/resources/articles/mine/", {
          ...config,
          params: {
            ...managedListParams(params, "-updated_at"),
            kinds:
              params.status === "draft" ? ["draft", "revision"] : ["published"],
          },
          paramsSerializer: { indexes: null },
        })
        .then(unwrap),
    listReferenceCandidates: (params, config = {}) =>
      request
        .get("/resources/articles/reference-candidates/", { ...config, params })
        .then(unwrap),
    listImportCandidates: (params, config = {}) =>
      request
        .get("/resources/articles/import-candidates/", { ...config, params })
        .then(unwrap),
    importArticle: (articleId) =>
      request
        .post("/resources/articles/import/", { article_id: articleId })
        .then(unwrap),
    getArticle: (slug, params, config = {}) =>
      request
        .get(`/resources/articles/${encodeURIComponent(slug)}/`, {
          ...config,
          params,
        })
        .then(unwrap),
    recordArticleView: (slug, bookId) =>
      request
        .post(
          `/resources/articles/${encodeURIComponent(slug)}/view/`,
          bookId ? { bookId } : {},
        )
        .then(unwrap),
    previewArticle: (slug, params, config = {}) =>
      request
        .get(`/resources/articles/${encodeURIComponent(slug)}/preview/`, {
          ...config,
          params,
        })
        .then(unwrap),
    setArticleStar: (slug, starred) =>
      request
        .put(`/resources/articles/${encodeURIComponent(slug)}/star/`, {
          starred,
        })
        .then(unwrap),
    setArticleVote: (slug, vote) =>
      request
        .put(`/resources/articles/${encodeURIComponent(slug)}/vote/`, { vote })
        .then(unwrap),
    createArticle: (payload, coverFile) =>
      request
        .post("/resources/articles/", articleFormData(payload, coverFile))
        .then(unwrap),
    updateArticle: (slug, payload, coverFile) =>
      request
        .patch(
          `/resources/articles/${encodeURIComponent(slug)}/`,
          articleFormData(payload, coverFile),
        )
        .then(unwrap),
    deleteArticle: (slug) =>
      request
        .delete(`/resources/articles/${encodeURIComponent(slug)}/`)
        .then(unwrap),
    listDrafts: (config = {}) =>
      request.get("/resources/drafts/", config).then(unwrap),
    getDraft: (slug, config = {}) =>
      request
        .get(`/resources/drafts/${encodeURIComponent(slug)}/`, config)
        .then(unwrap),
    createDraft: (payload, coverFile) =>
      request
        .post("/resources/drafts/", articleFormData(payload, coverFile))
        .then(unwrap),
    updateDraft: (slug, payload, coverFile) =>
      request
        .patch(
          `/resources/drafts/${encodeURIComponent(slug)}/`,
          articleFormData(payload, coverFile),
        )
        .then(unwrap),
    deleteDraft: (slug) =>
      request
        .delete(`/resources/drafts/${encodeURIComponent(slug)}/`)
        .then(unwrap),
    publishDraft: (slug) =>
      request
        .post(`/resources/drafts/${encodeURIComponent(slug)}/publish/`)
        .then(unwrap),
    createRevision: (slug) =>
      request
        .post(`/resources/articles/${encodeURIComponent(slug)}/revision/`)
        .then(unwrap),
    listMyArticleExternalLinks: (params, config = {}) =>
      request
        .get("/resources/article-external-links/mine/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    getMyArticleExternalLink: (id) =>
      request
        .get(
          `/resources/article-external-links/mine/${encodeURIComponent(id)}/`,
        )
        .then(unwrap),
    createMyArticleExternalLink: (id, payload) =>
      request
        .post(
          `/resources/article-external-links/mine/${encodeURIComponent(id)}/`,
          payload,
        )
        .then(unwrap),
    updateMyArticleExternalLink: (id, payload) =>
      request
        .patch(
          `/resources/article-external-links/mine/${encodeURIComponent(id)}/`,
          payload,
        )
        .then(unwrap),
    deleteMyArticleExternalLink: (id) =>
      request
        .delete(
          `/resources/article-external-links/mine/${encodeURIComponent(id)}/`,
        )
        .then(unwrap),
    listBooks: (params, config = {}) =>
      request.get("/resources/books/", { ...config, params }).then(unwrap),
    listMyBooks: (params, config = {}) =>
      request
        .get("/resources/books/mine/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    getBook: (slug, config = {}) =>
      request
        .get(`/resources/books/${encodeURIComponent(slug)}/`, config)
        .then(unwrap),
    previewBook: (slug, config = {}) =>
      request
        .get(`/resources/books/${encodeURIComponent(slug)}/preview/`, config)
        .then(unwrap),
    setBookStar: (slug, starred) =>
      request
        .put(`/resources/books/${encodeURIComponent(slug)}/star/`, { starred })
        .then(unwrap),
    setBookVote: (slug, vote) =>
      request
        .put(`/resources/books/${encodeURIComponent(slug)}/vote/`, { vote })
        .then(unwrap),
    createBook: (payload, coverFile) =>
      request
        .post("/resources/books/", bookFormData(payload, coverFile))
        .then(unwrap),
    updateBook: (slug, payload, coverFile) =>
      request
        .patch(
          `/resources/books/${encodeURIComponent(slug)}/`,
          bookFormData(payload, coverFile),
        )
        .then(unwrap),
    deleteBook: (slug) =>
      request
        .delete(`/resources/books/${encodeURIComponent(slug)}/`)
        .then(unwrap),
    listMyBookExternalLinks: (params, config = {}) =>
      request
        .get("/resources/book-external-links/mine/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    getMyBookExternalLink: (id) =>
      request
        .get(`/resources/book-external-links/mine/${encodeURIComponent(id)}/`)
        .then(unwrap),
    createMyBookExternalLink: (id, payload) =>
      request
        .post(
          `/resources/book-external-links/mine/${encodeURIComponent(id)}/`,
          payload,
        )
        .then(unwrap),
    updateMyBookExternalLink: (id, payload) =>
      request
        .patch(
          `/resources/book-external-links/mine/${encodeURIComponent(id)}/`,
          payload,
        )
        .then(unwrap),
    deleteMyBookExternalLink: (id) =>
      request
        .delete(
          `/resources/book-external-links/mine/${encodeURIComponent(id)}/`,
        )
        .then(unwrap),
    listAttachments: (params, config = {}) =>
      request
        .get("/resources/attachments/", { ...config, params })
        .then(unwrap),
    uploadAttachment: (payload) =>
      request
        .post("/resources/attachments/", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then(unwrap),
    updateAttachment: (id, payload) =>
      request
        .patch(`/resources/attachments/${encodeURIComponent(id)}/`, payload)
        .then(unwrap),
    deleteAttachment: (id) =>
      request
        .delete(`/resources/attachments/${encodeURIComponent(id)}/`)
        .then(unwrap),
    requestStandaloneAttachmentDownload: (id) =>
      request
        .get(`/resources/attachments/${encodeURIComponent(id)}/download/`)
        .then(unwrap),
    getAssetManifest: (
      resourceType,
      slug,
      assetIds,
      attachmentIds = [],
      params,
    ) =>
      request
        .post(
          `/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(slug)}/asset-manifest/`,
          { assetIds, attachmentIds },
          { params },
        )
        .then(unwrap),
    requestAttachmentDownload: (
      resourceType,
      slug,
      assetId,
      attachmentId,
      params,
    ) =>
      request
        .post(
          `/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}/download/`,
          { attachmentId },
          { params },
        )
        .then(unwrap),
    getExternalArticle: (token, password, config = {}) =>
      request
        .get(
          `/resources/external-links/articles/${encodeURIComponent(token)}/`,
          externalLinkConfig(password, config),
        )
        .then(unwrap),
    getExternalBook: (token, password, config = {}) =>
      request
        .get(
          `/resources/external-links/books/${encodeURIComponent(token)}/`,
          externalLinkConfig(password, config),
        )
        .then(unwrap),
    getExternalBookArticle: (token, slug, password, config = {}) =>
      request
        .get(
          `/resources/external-links/books/${encodeURIComponent(token)}/articles/${encodeURIComponent(slug)}/`,
          externalLinkConfig(password, config),
        )
        .then(unwrap),
    getExternalBookArticleAssetManifest: (
      token,
      slug,
      assetIds,
      attachmentIds = [],
      password,
    ) =>
      request
        .post(
          `/resources/external-links/books/${encodeURIComponent(token)}/articles/${encodeURIComponent(slug)}/asset-manifest/`,
          { assetIds, attachmentIds },
          externalLinkConfig(password),
        )
        .then(unwrap),
    requestExternalBookArticleAttachmentDownload: (
      token,
      slug,
      assetId,
      attachmentId,
      password,
    ) =>
      request
        .post(
          `/resources/external-links/books/${encodeURIComponent(token)}/articles/${encodeURIComponent(slug)}/assets/${encodeURIComponent(assetId)}/download/`,
          { attachmentId },
          externalLinkConfig(password),
        )
        .then(unwrap),
    getExternalArticleAssetManifest: (
      token,
      assetIds,
      attachmentIds = [],
      password,
    ) =>
      request
        .post(
          `/resources/external-links/articles/${encodeURIComponent(token)}/asset-manifest/`,
          { assetIds, attachmentIds },
          externalLinkConfig(password),
        )
        .then(unwrap),
    requestExternalArticleAttachmentDownload: (
      token,
      assetId,
      attachmentId,
      password,
    ) =>
      request
        .post(
          `/resources/external-links/articles/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}/download/`,
          { attachmentId },
          externalLinkConfig(password),
        )
        .then(unwrap),
    listExternalArticleComments: (token, params, password, config = {}) =>
      request
        .get(
          `/resources/external-links/articles/${encodeURIComponent(token)}/comments/`,
          { ...externalLinkConfig(password, config), params },
        )
        .then(unwrap),
    listArticleComments: (slug, params, config = {}) =>
      request
        .get(`/resources/articles/${encodeURIComponent(slug)}/comments/`, {
          ...config,
          params,
        })
        .then(unwrap),
    getArticleCommentAssetManifest: (
      slug,
      assetIds,
      attachmentIds = [],
      params,
    ) =>
      request
        .post(
          `/resources/articles/${encodeURIComponent(slug)}/comments/asset-manifest/`,
          { assetIds, attachmentIds },
          { params },
        )
        .then(unwrap),
    requestArticleCommentAttachmentDownload: (
      slug,
      assetId,
      attachmentId,
      params,
    ) =>
      request
        .post(
          `/resources/articles/${encodeURIComponent(slug)}/comments/assets/${encodeURIComponent(assetId)}/download/`,
          { attachmentId },
          { params },
        )
        .then(unwrap),
    createArticleComment: (slug, payload, params) =>
      request
        .post(
          `/resources/articles/${encodeURIComponent(slug)}/comments/`,
          payload,
          { params },
        )
        .then(unwrap),
    updateArticleComment: (slug, id, payload, params) =>
      request
        .patch(
          `/resources/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(id)}/`,
          payload,
          { params },
        )
        .then(unwrap),
    deleteArticleComment: (slug, id, params) =>
      request
        .delete(
          `/resources/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(id)}/`,
          { params },
        )
        .then(unwrap),
    setArticleCommentReaction: (slug, id, vote, params) =>
      request
        .put(
          `/resources/articles/${encodeURIComponent(slug)}/comments/${encodeURIComponent(id)}/reaction/`,
          { vote },
          { params },
        )
        .then(unwrap),
    uploadMedia: (kind, file) => {
      const payload = new FormData();
      payload.append(kind, file);
      return request
        .post(`/resources/media/${kind}/`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then(unwrap);
    },
  },
  manage: {
    listUsers: (params, config = {}) =>
      request
        .get("/manage/users/", {
          ...config,
          params: managedListParams(params, "username"),
        })
        .then(unwrap),
    createUser: (values) => request.post("/manage/users/", values).then(unwrap),
    updateUser: (id, values, avatarFile) => {
      if (!avatarFile && !values.remove_avatar)
        return request.patch(`/manage/users/${id}/`, values).then(unwrap);
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null)
          body.append(key, String(value));
      });
      if (avatarFile) body.append("avatar", avatarFile);
      return request.patch(`/manage/users/${id}/`, body).then(unwrap);
    },
    updateUserRole: (id, values) =>
      request.patch(`/manage/users/${id}/role/`, values).then(unwrap),
    adjustUserBalances: (id, values) =>
      request.post(`/manage/users/${id}/balances/`, values).then(unwrap),
    resetUserPassword: (id, values) =>
      request.post(`/manage/users/${id}/password/`, values).then(unwrap),
    deleteUser: (id) => request.delete(`/manage/users/${id}/`).then(unwrap),
    listArticles: (params, config = {}) =>
      request
        .get("/manage/articles/", {
          ...config,
          params: {
            ...managedListParams(params, "-updated_at"),
            kinds:
              params.status === "draft" ? ["draft", "revision"] : ["published"],
          },
          paramsSerializer: { indexes: null },
        })
        .then(unwrap),
    listBooks: (params, config = {}) =>
      request
        .get("/manage/books/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    createBook: (payload, coverFile) =>
      request
        .post("/manage/books/", bookFormData(payload, coverFile))
        .then(unwrap),
    getBook: (slug, config = {}) =>
      request
        .get(`/manage/books/${encodeURIComponent(slug)}/`, config)
        .then(unwrap),
    updateBook: (slug, payload, coverFile) =>
      request
        .patch(
          `/manage/books/${encodeURIComponent(slug)}/`,
          bookFormData(payload, coverFile),
        )
        .then(unwrap),
    deleteBook: (slug) =>
      request.delete(`/manage/books/${encodeURIComponent(slug)}/`).then(unwrap),
    cleanupArticleTags: () =>
      request.post("/manage/articles/tags/cleanup/").then(unwrap),
    listArticleExternalLinks: (params, config = {}) =>
      request
        .get("/manage/article-external-links/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    getArticleExternalLink: (id) =>
      request
        .get(`/manage/article-external-links/${encodeURIComponent(id)}/`)
        .then(unwrap),
    createArticleExternalLink: (id, payload) =>
      request
        .post(`/manage/article-external-links/${id}/`, payload)
        .then(unwrap),
    updateArticleExternalLink: (id, payload) =>
      request
        .patch(`/manage/article-external-links/${id}/`, payload)
        .then(unwrap),
    deleteArticleExternalLink: (id) =>
      request.delete(`/manage/article-external-links/${id}/`).then(unwrap),
    listBookExternalLinks: (params, config = {}) =>
      request
        .get("/manage/book-external-links/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    getBookExternalLink: (id) =>
      request
        .get(`/manage/book-external-links/${encodeURIComponent(id)}/`)
        .then(unwrap),
    createBookExternalLink: (id, payload) =>
      request.post(`/manage/book-external-links/${id}/`, payload).then(unwrap),
    updateBookExternalLink: (id, payload) =>
      request.patch(`/manage/book-external-links/${id}/`, payload).then(unwrap),
    deleteBookExternalLink: (id) =>
      request.delete(`/manage/book-external-links/${id}/`).then(unwrap),
    listAttachments: (params, config = {}) =>
      request
        .get("/manage/attachments/", {
          ...config,
          params: managedListParams(params, "-updated_at"),
        })
        .then(unwrap),
    updateAttachment: (id, values) =>
      request.patch(`/manage/attachments/${id}/`, values).then(unwrap),
    deleteAttachment: (id) =>
      request.delete(`/manage/attachments/${id}/`).then(unwrap),
    getBasicSettings: (config = {}) =>
      request
        .get("/manage/site-settings/basic/", config)
        .then(({ data }) => data.values),
    saveBasicSettings: (values) =>
      request
        .patch("/manage/site-settings/basic/", { values })
        .then(({ data }) => data.values),
    resetBasicSettings: () =>
      request
        .delete("/manage/site-settings/basic/")
        .then(({ data }) => data.values),
    uploadBasicAsset: (field, file) => {
      const body = new FormData();
      body.append("file", file);
      return request
        .post(`/manage/site-settings/basic/assets/${field}/`, body)
        .then(({ data }) => data.assets);
    },
    removeBasicAsset: (field) =>
      request
        .delete(`/manage/site-settings/basic/assets/${field}/`)
        .then(({ data }) => data.assets),
    uploadLive2DBundle: (field, file) => {
      const body = new FormData();
      body.append("file", file);
      return request
        .post(`/manage/site-settings/basic/live2d/bundles/${field}/`, body)
        .then(({ data }) => data.live2d);
    },
    removeLive2DBundle: (field) =>
      request
        .delete(`/manage/site-settings/basic/live2d/bundles/${field}/`)
        .then(({ data }) => data.live2d),
    listAuditLogs: (params, config = {}) =>
      request
        .get("/manage/site-settings/audit-logs/", {
          ...config,
          params: managedListParams(params, "-created_at"),
        })
        .then(unwrap),
    getAuditLog: (id, config = {}) =>
      request
        .get(`/manage/site-settings/audit-logs/${id}/`, config)
        .then(unwrap),
    clearAuditLogs: () =>
      request.post("/manage/site-settings/audit-logs/clear/").then(unwrap),
  },
  resourceAccess: {
    check: (resource, config = {}) =>
      request
        .get(`${accessPath(resource)}/`, {
          ...config,
          params: resourceAccessContext(resource),
        })
        .then(({ data }) => {
          const decision = normalizeResourceAccessDecision(data);
          if (!decision) throw new Error("Invalid resource access decision.");
          return decision;
        })
        .catch((error) => {
          throw new Error(
            accessError(error, "Unable to check resource access."),
          );
        }),
    verifyPassword: (resource, password) =>
      request
        .post(`${accessPath(resource)}/password/`, {
          password,
          ...resourceAccessContext(resource),
        })
        .then(({ data }) => {
          if (!data?.ok)
            throw new Error(data?.message || "Password verification failed.");
          const decision = normalizeResourceAccessDecision(data.access_check);
          if (!decision) throw new Error("Invalid resource access decision.");
          return decision;
        })
        .catch((error) => {
          throw new Error(accessError(error, "Password verification failed."));
        }),
    finalize: (resource) =>
      request
        .post(
          `${accessPath(resource)}/finalize/`,
          resourceAccessContext(resource),
        )
        .then(({ data }) => {
          if (!data?.ok)
            throw new Error(
              data?.message || "Resource access finalization failed.",
            );
          const decision = normalizeResourceAccessDecision(data.access_check);
          if (!decision) throw new Error("Invalid resource access decision.");
          return decision;
        })
        .catch((error) => {
          throw new Error(
            accessError(error, "Resource access finalization failed."),
          );
        }),
  },
};

export default api;
