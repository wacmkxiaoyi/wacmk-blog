import {
    getCsrfToken,
    openModal,
    showInlineFlash
} from "../../core/app.js";

var conditionTooltip = null;
var postLinkPreviewTooltip = null;
var postLinkPreviewBody = null;
var postLinkPreviewActiveLink = null;
var postLinkPreviewHoverTimer = 0;
var postLinkPreviewHideTimer = 0;
var postLinkPreviewRequestPath = "";
var postLinkPreviewCache = {};

export function getAccessPresentationClasses(presentation) {
    if (!presentation || !presentation.icon || !presentation.tone) {
        return null;
    }

    return {
        iconClass: "fa-solid fa-" + presentation.icon,
        toneClass: "access-tone-" + presentation.tone,
        label: presentation.label || ""
    };
}

function escapeConditionTooltipHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildConditionTooltipContent(conditionItems) {
    if (!conditionItems || !conditionItems.length) {
        return "";
    }

    return '<span class="condition-badge-group condition-badge-group-inline">' + conditionItems.map(function (item) {
        var label = item && item.label ? String(item.label) : "";
        var tone = item && item.tone ? String(item.tone) : "conditional";
        var type = item && item.type ? String(item.type) : "conditional";
        var icon = item && item.icon ? String(item.icon) : "circle-question";
        var value = item && item.value != null && item.value !== "" ? String(item.value) : "";
        var text = value ? (label ? (label + " " + value) : value) : label;

        return '<span class="condition-badge access-tone-' + escapeConditionTooltipHtml(tone) + ' condition-badge-' + escapeConditionTooltipHtml(type) + '">' +
            '<i class="fa-solid fa-' + escapeConditionTooltipHtml(icon) + '" aria-hidden="true"></i>' +
            '<span>' + escapeConditionTooltipHtml(text) + '</span>' +
            '</span>';
    }).join("") + "</span>";
}

export function appendAccessDisplay(container, accessDisplay, options) {
    var settings = options || {};
    var display = accessDisplay || null;
    var fallbackPresentation = settings.fallbackPresentation || null;
    var iconClassName = settings.iconClassName || "";
    var countClassName = settings.countClassName || "";
    var presentation = null;
    var icon = null;
    var countBadge = null;
    var tooltipTemplate = null;
    var count = 0;
    var tooltipContent = "";
    var finalPresentation = null;

    if (!container) {
        return false;
    }

    if (display && display.mode === "multiple") {
        count = parseInt(display.count, 10) || ((display.condition_items || []).length) || 0;
        if (!count) {
            return false;
        }
        countBadge = document.createElement("span");
        countBadge.className = "condition-count-badge" + (countClassName ? (" " + countClassName) : "");
        countBadge.textContent = String(count);
        countBadge.setAttribute("data-condition-tooltip-trigger", "true");
        countBadge.setAttribute("tabindex", "0");
        tooltipContent = buildConditionTooltipContent(display.condition_items || []);
        if (tooltipContent) {
            tooltipTemplate = document.createElement("div");
            tooltipTemplate.hidden = true;
            tooltipTemplate.setAttribute("data-condition-tooltip-template", "true");
            tooltipTemplate.innerHTML = tooltipContent;
        }
        container.appendChild(countBadge);
        if (tooltipTemplate) {
            container.appendChild(tooltipTemplate);
        }
        return true;
    }

    finalPresentation = display && display.presentation ? display.presentation : fallbackPresentation;
    presentation = getAccessPresentationClasses(finalPresentation);
    if (!presentation || !finalPresentation || finalPresentation.type === "conditional") {
        return false;
    }

    icon = document.createElement("i");
    icon.className = presentation.iconClass + (iconClassName ? (" " + iconClassName) : "") + " access-icon-only " + presentation.toneClass;
    if (presentation.label) {
        icon.setAttribute("title", presentation.label);
    }
    icon.setAttribute("aria-hidden", "true");
    container.appendChild(icon);
    return true;
}

function createConditionTooltip() {
    if (conditionTooltip) {
        return conditionTooltip;
    }

    conditionTooltip = document.createElement("div");
    conditionTooltip.className = "condition-tooltip";
    conditionTooltip.hidden = true;
    conditionTooltip.setAttribute("role", "tooltip");
    document.body.appendChild(conditionTooltip);
    return conditionTooltip;
}

function hideConditionTooltip() {
    if (!conditionTooltip) {
        return;
    }
    conditionTooltip.hidden = true;
    conditionTooltip.innerHTML = "";
    conditionTooltip.style.top = "";
    conditionTooltip.style.left = "";
}

function showConditionTooltip(trigger) {
    var tooltip = createConditionTooltip();
    var rect = null;
    var tooltipRect = null;
    var top = 0;
    var left = 0;
    var template = null;
    var contentHtml = "";
    var minTop = 10;
    var minLeft = 10;
    var maxLeft = 0;

    if (!tooltip || !trigger) {
        return;
    }

    template = trigger.nextElementSibling;
    if (template && template.hasAttribute("data-condition-tooltip-template")) {
        contentHtml = template.innerHTML || "";
    }
    if (!contentHtml) {
        hideConditionTooltip();
        return;
    }

    tooltip.innerHTML = contentHtml;
    tooltip.hidden = false;
    rect = trigger.getBoundingClientRect();
    tooltipRect = tooltip.getBoundingClientRect();
    top = rect.top - tooltipRect.height - 10;
    left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    if (top < minTop) {
        top = rect.bottom + 10;
    }
    maxLeft = window.innerWidth - tooltipRect.width - minLeft;
    left = Math.max(minLeft, Math.min(left, maxLeft));
    tooltip.style.top = top + "px";
    tooltip.style.left = left + "px";
}

export function bindConditionTooltips(rootNode) {
    Array.prototype.forEach.call((rootNode || document).querySelectorAll("[data-condition-tooltip-trigger]"), function (trigger) {
        if (trigger.getAttribute("data-condition-tooltip-bound") === "true") {
            return;
        }
        trigger.setAttribute("data-condition-tooltip-bound", "true");
        trigger.addEventListener("mouseenter", function () {
            showConditionTooltip(trigger);
        });
        trigger.addEventListener("mouseleave", hideConditionTooltip);
        trigger.addEventListener("focus", function () {
            showConditionTooltip(trigger);
        });
        trigger.addEventListener("blur", hideConditionTooltip);
    });
}

function initializeImportPostCards(rootNode) {
    Array.prototype.forEach.call((rootNode || document).querySelectorAll(".import-post-form .post-card"), function (card) {
        if (card.getAttribute("data-import-post-card-bound") === "true") {
            return;
        }
        card.setAttribute("data-import-post-card-bound", "true");
        card.addEventListener("click", function (event) {
            var form = card.closest(".import-post-form");
            if (!form) {
                return;
            }

            var needsIntercept = form.getAttribute("data-import-requires-condition") === "true";
            var postId = form.getAttribute("data-import-post-id") || "";

            if (needsIntercept && postId) {
                event.preventDefault();
                event.stopPropagation();
                handleImportConditionalAccess(form, postId);
                return;
            }

            var interactiveTarget = event.target.closest("button, a, input, select, textarea, label, [data-condition-tooltip-trigger]");
            if (interactiveTarget) {
                return;
            }

            if (typeof form.requestSubmit === "function") {
                form.requestSubmit();
                return;
            }
            form.submit();
        });
    });
}

function handleImportConditionalAccess(form, postId) {
    var csrfToken = getCsrfToken();
    var postUrl = form.getAttribute("data-import-post-url") || "";
    var body = new FormData();

    if (!csrfToken) {
        return;
    }

    body.append("source_post_id", postId);
    body.append("csrfmiddlewaretoken", csrfToken);

    fetch(form.action || window.location.href, {
        method: "POST",
        headers: {
            "X-Requested-With": "XMLHttpRequest"
        },
        body: body,
        credentials: "same-origin"
    }).then(function (response) {
        return response.json().catch(function () {
            return { ok: false, message: "Request failed." };
        }).then(function (payload) {
            return { ok: response.ok && payload.ok, status: response.status, data: payload };
        });
    }).then(function (result) {
        if (result.ok) {
            window.location.href = result.data.redirect_url || form.action;
            return;
        }

        if (result.data.requires_condition) {
            showImportConditionModal(form, postId);
            return;
        }

        if (result.data.requires_password) {
            openEncryptedPostModal({
                url: postUrl,
                title: "Enter password to view this article",
                kicker: "Encrypted",
                confirmText: "Unlock article",
                cancelText: "Cancel",
                isDirect: false,
                error: "",
                onImportSuccess: function () {
                    submitImportForm(form, postId);
                }
            });
            return;
        }

        showInlineFlash(result.data.message || "You do not have permission to import this article.", false);
    }).catch(function () {
        showInlineFlash("Request failed.", false);
    });
}

function showImportConditionModal(form, postId) {
    var postUrl = form.getAttribute("data-import-post-url") || "";
    var status = form.getAttribute("data-import-condition-status") || "";
    var money = form.getAttribute("data-import-condition-money") || "";
    var points = form.getAttribute("data-import-condition-points") || "";

    var modalConfig = buildConditionModalConfig({
        status: status,
        money: money,
        points: points,
        postUrl: postUrl,
        csrfToken: getCsrfToken(),
        onSuccess: function () {
            submitImportForm(form, postId);
        },
        onError: function (error) {
            showInlineFlash(error.message || "Insufficient balance.", false);
        }
    });

    if (!modalConfig) {
        return;
    }

    openModal({
        tone: modalConfig.tone,
        kicker: "Conditional",
        title: "Content access check",
        message: modalConfig.message,
        confirmText: modalConfig.confirmText,
        cancelText: "Cancel",
        keepOpenOnConfirm: true,
        onConfirm: modalConfig.confirmHandler,
        onCancel: function () {
            return;
        }
    });
}

function submitImportForm(form, postId) {
    var csrfToken = getCsrfToken();
    var postUrl = form.getAttribute("data-import-post-url") || "";
    var body = new URLSearchParams();

    body.append("source_post_id", postId);
    body.append("csrfmiddlewaretoken", csrfToken);

    fetch(form.action || window.location.href, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
    }).then(function (response) {
        return response.json().catch(function () {
            return { ok: false, message: "Request failed." };
        }).then(function (payload) {
            return { ok: response.ok && payload.ok, data: payload };
        });
    }).then(function (result) {
        if (result.ok && result.data.redirect_url) {
            window.location.href = result.data.redirect_url;
        } else if (result.ok) {
            form.submit();
        } else if (result.data && result.data.requires_password) {
            openEncryptedPostModal({
                url: postUrl,
                title: "Enter password to view this article",
                kicker: "Encrypted",
                confirmText: "Unlock article",
                cancelText: "Cancel",
                isDirect: false,
                error: "",
                onImportSuccess: function () {
                    submitImportForm(form, postId);
                }
            });
        } else if (result.data && result.data.requires_condition) {
            showImportConditionModal(form, postId);
        } else {
            showInlineFlash(result.data.message || "Import failed.", false);
        }
    }).catch(function () {
        showInlineFlash("Request failed.", false);
    });
}

export function buildConditionModalConfig(options) {
    var status = options.status || "";
    var money = options.money || "";
    var points = options.points || "";
    var postUrl = options.postUrl || "";
    var csrfToken = options.csrfToken || "";
    var onSuccess = options.onSuccess;
    var onError = options.onError;
    var insufficientMoneyLabel = options.insufficientMoneyLabel || "Insufficient balance";
    var insufficientPointsLabel = options.insufficientPointsLabel || "Insufficient points";

    if (status === "purchase_required") {
        return {
            message: money ? ("This content requires purchasing for " + money + ".") : "This content requires purchase.",
            tone: "attention",
            confirmText: "Purchase now",
            confirmHandler: function () {
                return fetch(postUrl, {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        "X-CSRFToken": csrfToken
                    }
                }).then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: "Request failed." };
                    }).then(function (payload) {
                        if (!response.ok || !payload.ok) {
                            throw new Error(payload.message || "Request failed.");
                        }
                        if (onSuccess) {
                            onSuccess(payload);
                        }
                    });
                }).catch(function (error) {
                    if (onError) {
                        onError(error);
                    }
                });
            }
        };
    }

    if (status === "insufficient_money") {
        return {
            message: insufficientMoneyLabel + (money ? (": " + money) : ""),
            tone: "warning",
            confirmText: ""
        };
    }

    if (status === "insufficient_points") {
        return {
            message: insufficientPointsLabel + (points ? (": " + points) : ""),
            tone: "warning",
            confirmText: ""
        };
    }

    return null;
}

function initializeConditionalAccess() {
    var configEl = document.querySelector("[data-conditional-access-modal]");
    var status = "";
    var cancelText = "";
    var title = "";
    var kicker = "";
    var url = "";
    var returnUrl = "";
    var money = "";
    var points = "";
    var insufficientMoney = "";
    var insufficientPoints = "";
    var modalConfig = null;

    if (!configEl || configEl.getAttribute("data-conditional-access-bound") === "true") {
        return;
    }
    configEl.setAttribute("data-conditional-access-bound", "true");

    status = configEl.getAttribute("data-conditional-access-status") || "";
    cancelText = configEl.getAttribute("data-conditional-access-cancel") || "";
    title = configEl.getAttribute("data-conditional-access-title") || "";
    kicker = configEl.getAttribute("data-conditional-access-kicker") || "";
    url = configEl.getAttribute("data-conditional-access-url") || "";
    returnUrl = configEl.getAttribute("data-conditional-access-return-url") || "";
    money = configEl.getAttribute("data-conditional-access-money") || "";
    points = configEl.getAttribute("data-conditional-access-points") || "";
    insufficientMoney = configEl.getAttribute("data-conditional-access-insufficient-money") || "Insufficient balance";
    insufficientPoints = configEl.getAttribute("data-conditional-access-insufficient-points") || "Insufficient points";

    modalConfig = buildConditionModalConfig({
        status: status,
        money: money,
        points: points,
        postUrl: url,
        csrfToken: getCsrfToken(),
        insufficientMoneyLabel: insufficientMoney,
        insufficientPointsLabel: insufficientPoints,
        onSuccess: function (payload) {
            window.location.assign(payload.redirect_url || url);
        },
        onError: function (error) {
            showInlineFlash(error.message || insufficientMoney, false);
            if (returnUrl) {
                window.location.assign(returnUrl);
            }
        }
    });

    if (!modalConfig) {
        return;
    }

    openModal({
        tone: modalConfig.tone,
        kicker: kicker,
        title: title,
        message: modalConfig.message,
        confirmText: modalConfig.confirmText,
        cancelText: cancelText,
        keepOpenOnConfirm: true,
        onConfirm: modalConfig.confirmHandler,
        onCancel: function () {
            if (returnUrl) {
                window.location.assign(returnUrl);
                return;
            }
            if (window.history.length > 1) {
                window.history.back();
            }
        }
    });
}

function getEncryptedPostFallbackUrl() {
    if (document.referrer && document.referrer !== window.location.href) {
        return document.referrer;
    }
    return "/";
}

export function openEncryptedPostModal(config) {
    var csrfToken = getCsrfToken();
    var content = document.createElement("div");
    var field = document.createElement("div");
    var label = document.createElement("label");
    var input = document.createElement("input");
    var errorNode = document.createElement("div");
    var submitUrl = config.url || "";
    var fallbackUrl = config.fallbackUrl || getEncryptedPostFallbackUrl();

    if (!csrfToken || !submitUrl) {
        return;
    }

    content.className = "encrypted-access-form";
    field.className = "field-group";
    label.textContent = config.passwordLabel || "Password";
    label.setAttribute("for", "encrypted-post-password-input");
    input.type = "password";
    input.id = "encrypted-post-password-input";
    input.className = "input-control";
    input.placeholder = config.placeholder || "Enter article password";
    input.autocomplete = "current-password";
    errorNode.className = "field-error";
    errorNode.hidden = !config.error;
    errorNode.textContent = config.error || "";
    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(errorNode);
    content.appendChild(field);

    function submitPassword() {
        var body = new FormData();

        body.append("password", input.value || "");
        body.append("csrfmiddlewaretoken", csrfToken);

        return fetch(submitUrl, {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            },
            body: body,
            credentials: "same-origin"
        }).then(function (response) {
            return response.json().catch(function () {
                return { ok: false, message: "Request failed." };
            }).then(function (data) {
                return { ok: response.ok && data.ok, data: data };
            });
        }).then(function (result) {
            if (!result.ok) {
                errorNode.hidden = false;
                errorNode.textContent = result.data.message || config.error || "Request failed.";
                input.focus();
                input.select();
                return;
            }
            if (config.onImportSuccess) {
                config.onImportSuccess();
                return;
            }
            window.location.href = result.data.redirect_url || submitUrl;
        }).catch(function () {
            errorNode.hidden = false;
            errorNode.textContent = "Request failed.";
        });
    }

    openModal({
        tone: "error",
        kicker: config.kicker || "Encrypted",
        title: config.title || "Enter password to view this article",
        contentNode: content,
        cancelText: config.cancelText || "Cancel",
        confirmText: config.confirmText || "Unlock article",
        keepOpenOnConfirm: true,
        onConfirm: submitPassword,
        onCancel: function () {
            if (config.isDirect) {
                window.location.href = fallbackUrl;
            }
        }
    });

    window.requestAnimationFrame(function () {
        input.focus();
    });
}

function initializeEncryptedPostAccess() {
    var pageModalConfig = document.querySelector("[data-encrypted-post-modal]");

    Array.prototype.forEach.call(document.querySelectorAll("[data-encrypted-post-trigger]"), function (trigger) {
        if (trigger.getAttribute("data-encrypted-post-bound") === "true") {
            return;
        }
        trigger.setAttribute("data-encrypted-post-bound", "true");
        trigger.addEventListener("click", function (event) {
            event.preventDefault();
            var importForm = trigger.closest(".import-post-form");
            var importPostId = importForm ? (importForm.querySelector("input[name='source_post_id']") || {}).value : null;

            openEncryptedPostModal({
                url: trigger.getAttribute("data-encrypted-post-url") || "",
                title: trigger.getAttribute("data-encrypted-post-title") || "",
                kicker: trigger.getAttribute("data-encrypted-post-kicker") || "",
                confirmText: trigger.getAttribute("data-encrypted-post-confirm") || "",
                cancelText: trigger.getAttribute("data-encrypted-post-cancel") || "",
                isDirect: false,
                error: "",
                onImportSuccess: importForm && importPostId ? function () {
                    submitImportForm(importForm, importPostId);
                } : null
            });
        });
    });

    if (pageModalConfig && pageModalConfig.getAttribute("data-encrypted-post-page-bound") !== "true") {
        pageModalConfig.setAttribute("data-encrypted-post-page-bound", "true");
        openEncryptedPostModal({
            url: pageModalConfig.getAttribute("data-encrypted-post-url") || "",
            title: pageModalConfig.getAttribute("data-encrypted-post-title") || "",
            kicker: pageModalConfig.getAttribute("data-encrypted-post-kicker") || "",
            confirmText: pageModalConfig.getAttribute("data-encrypted-post-confirm") || "",
            cancelText: pageModalConfig.getAttribute("data-encrypted-post-cancel") || "",
            error: pageModalConfig.getAttribute("data-encrypted-post-error") || "",
            isDirect: pageModalConfig.getAttribute("data-encrypted-post-direct") === "true"
        });
    }
}

function updateFeedbackWidget(widget, payload) {
    var activeValue = payload.active_value || 0;
    var upCount = typeof payload.up_count === "number" ? payload.up_count : 0;
    var downCount = typeof payload.down_count === "number" ? payload.down_count : 0;

    Array.prototype.forEach.call(widget.querySelectorAll("[data-feedback-value]"), function (button) {
        var value = parseInt(button.getAttribute("data-feedback-value"), 10);
        var isActive = value === activeValue;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (widget.querySelector("[data-feedback-count='up']")) {
        widget.querySelector("[data-feedback-count='up']").textContent = String(upCount);
    }
    if (widget.querySelector("[data-feedback-count='down']")) {
        widget.querySelector("[data-feedback-count='down']").textContent = String(downCount);
    }
}

function bindFeedbackWidgets() {
    var csrfToken = getCsrfToken();

    Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-widget][data-feedback-endpoint]"), function (widget) {
        Array.prototype.forEach.call(widget.querySelectorAll("[data-feedback-value]"), function (button) {
            if (button.getAttribute("data-feedback-bound") === "true") {
                return;
            }
            button.setAttribute("data-feedback-bound", "true");
            button.addEventListener("click", function () {
                var value = button.getAttribute("data-feedback-value");
                var endpoint = widget.getAttribute("data-feedback-endpoint") || "";
                var body = new FormData();

                if (!endpoint || !csrfToken || !value) {
                    return;
                }

                body.append("value", value);
                body.append("csrfmiddlewaretoken", csrfToken);
                button.disabled = true;

                fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: body,
                    credentials: "same-origin"
                }).then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                }).then(function (result) {
                    if (!result.ok || !result.data.ok) {
                        throw new Error(result.data.message || "Request failed.");
                    }
                    updateFeedbackWidget(widget, result.data);
                }).catch(function (error) {
                    showInlineFlash(error.message || "Request failed.", false);
                }).finally(function () {
                    button.disabled = false;
                });
            });
        });
    });
}

function bindInlineShareControls() {
    var csrfToken = getCsrfToken();

    function updateInlineShareResult(trigger, url, expiresDisplay) {
        var root = trigger.closest(".editor-access-layout");
        var result = root ? root.querySelector("[data-share-inline-result]") : null;
        var resultUrl = root ? root.querySelector("[data-share-inline-url]") : null;
        var copyButton = root ? root.querySelector("[data-share-inline-copy]") : null;
        var visibilitySelect = root ? root.querySelector("#id_visibility") : null;
        var hasUrl = !!(url || "");
        var isPublic = !visibilitySelect || visibilitySelect.value === "public";

        trigger.setAttribute("data-share-current-url", url || "");
        trigger.setAttribute("data-share-current-expires", expiresDisplay || "");
        if (!result || !resultUrl || !copyButton) {
            return;
        }

        result.classList.toggle("is-hidden", !hasUrl);
        result.hidden = !isPublic || !hasUrl;
        resultUrl.value = url || "";
        copyButton.disabled = !hasUrl;
    }

    if (!csrfToken) {
        return;
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-inline-share-trigger]"), function (trigger) {
        var root = trigger.closest(".editor-access-layout");
        var select = root ? root.querySelector("[data-share-expiry-select]") : null;
        var copyButton = root ? root.querySelector("[data-share-inline-copy]") : null;

        if (trigger.getAttribute("data-inline-share-bound") !== "true") {
            trigger.setAttribute("data-inline-share-bound", "true");
            trigger.addEventListener("click", function () {
                var canGenerate = (trigger.getAttribute("data-share-can-generate") || "") === "true";
                var endpoint = trigger.getAttribute("data-share-endpoint") || "";
                var body = new FormData();

                if (!canGenerate || !endpoint) {
                    showInlineFlash(trigger.getAttribute("data-share-disabled-message") || trigger.getAttribute("data-share-generate-error") || "Unable to generate share link right now.", false);
                    return;
                }

                body.append("expiry", select ? select.value : "7d");
                body.append("csrfmiddlewaretoken", csrfToken);
                trigger.disabled = true;

                fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: body,
                    credentials: "same-origin"
                }).then(function (response) {
                    return response.json().then(function (data) {
                        return { ok: response.ok, data: data };
                    });
                }).then(function (resultPayload) {
                    if (!resultPayload.ok || !resultPayload.data.ok) {
                        throw new Error(resultPayload.data.message || "Request failed.");
                    }
                    updateInlineShareResult(trigger, resultPayload.data.url || "", resultPayload.data.expires_display || "");
                }).catch(function (error) {
                    showInlineFlash(error.message || (trigger.getAttribute("data-share-request-error") || trigger.getAttribute("data-share-generate-error") || "Unable to generate share link right now."), false);
                }).finally(function () {
                    trigger.disabled = !canGenerate;
                });
            });
        }

        if (copyButton && copyButton.getAttribute("data-inline-share-copy-bound") !== "true") {
            copyButton.setAttribute("data-inline-share-copy-bound", "true");
            copyButton.addEventListener("click", function () {
                var input = root.querySelector("[data-share-inline-url]");
                var text = input ? input.value || "" : "";

                if (!text || !navigator.clipboard || !navigator.clipboard.writeText) {
                    return;
                }
                input.focus();
                input.select();
                navigator.clipboard.writeText(text).then(function () {
                    showInlineFlash(trigger.getAttribute("data-share-copy-success") || "Share link copied.", true);
                }).catch(function () {
                    showInlineFlash(trigger.getAttribute("data-share-generate-error") || "Unable to generate share link right now.", false);
                });
            });
        }

        updateInlineShareResult(trigger, trigger.getAttribute("data-share-current-url") || "", trigger.getAttribute("data-share-current-expires") || "");
    });
}

function collectShareExpiryOptions() {
    var options = [];
    Array.prototype.forEach.call(document.querySelectorAll("[data-share-expiry-option]"), function (optionNode) {
        options.push({
            value: optionNode.getAttribute("data-share-expiry-option") || "",
            label: optionNode.textContent || ""
        });
    });
    return options;
}

function bindExternalShareEditors() {
    var csrfToken = getCsrfToken();
    var expiryOptions = collectShareExpiryOptions();

    if (!csrfToken) {
        return;
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-share-trigger][data-share-endpoint]"), function (trigger) {
        if (trigger.getAttribute("data-share-trigger-bound") === "true") {
            return;
        }
        trigger.setAttribute("data-share-trigger-bound", "true");

        trigger.addEventListener("click", function () {
            var endpoint = trigger.getAttribute("data-share-endpoint") || "";
            var title = trigger.getAttribute("data-share-title") || "";
            var kicker = trigger.getAttribute("data-share-kicker") || "";
            var message = trigger.getAttribute("data-share-message") || "";
            var help = trigger.getAttribute("data-share-help") || "";
            var copyLabel = trigger.getAttribute("data-share-copy-label") || "Copy link";
            var generateLabel = trigger.getAttribute("data-share-generate-label") || "Update link";
            var generatingLabel = trigger.getAttribute("data-share-generating-label") || generateLabel;
            var expiryLabel = trigger.getAttribute("data-share-expiry-label") || "Link validity";
            var urlLabel = trigger.getAttribute("data-share-url-label") || "Share link";
            var expiresLabel = trigger.getAttribute("data-share-expires-label") || "Expires at";
            var neverLabel = trigger.getAttribute("data-share-never-label") || "Never expires";
            var copySuccess = trigger.getAttribute("data-share-copy-success") || "Share link copied.";
            var generateError = trigger.getAttribute("data-share-generate-error") || "Unable to update share link right now.";
            var requestError = trigger.getAttribute("data-share-request-error") || "Request failed. Please try again.";
            var closeLabel = trigger.getAttribute("data-share-close-label") || "Close";
            var currentUrl = trigger.getAttribute("data-share-current-url") || "";
            var currentExpires = trigger.getAttribute("data-share-current-expires") || neverLabel;
            var content = document.createElement("div");
            var intro = document.createElement("p");
            var helpNode = document.createElement("p");
            var expiryField = document.createElement("div");
            var expiryTitle = document.createElement("label");
            var expirySelect = document.createElement("select");
            var urlField = document.createElement("div");
            var urlTitle = document.createElement("label");
            var urlRow = document.createElement("div");
            var urlInput = document.createElement("input");
            var copyButton = document.createElement("button");
            var expiresField = document.createElement("div");
            var expiresTitle = document.createElement("label");
            var expiresValue = document.createElement("div");

            if (!endpoint) {
                showInlineFlash(generateError, false);
                return;
            }

            content.className = "editor-modal-form";
            intro.className = "field-help";
            intro.textContent = message;
            helpNode.className = "field-help";
            helpNode.textContent = help;
            expiryField.className = "field-group";
            expiryTitle.textContent = expiryLabel;
            expirySelect.className = "input-control";
            expiryOptions.forEach(function (option) {
                var optionNode = document.createElement("option");
                optionNode.value = option.value;
                optionNode.textContent = option.label;
                expirySelect.appendChild(optionNode);
            });
            urlField.className = "field-group";
            urlTitle.textContent = urlLabel;
            urlRow.className = "inline-action-field";
            urlInput.type = "text";
            urlInput.className = "input-control";
            urlInput.readOnly = true;
            urlInput.value = currentUrl;
            copyButton.type = "button";
            copyButton.className = "secondary-button inline-action-button";
            copyButton.textContent = copyLabel;
            copyButton.disabled = !currentUrl;
            expiresField.className = "field-group";
            expiresTitle.textContent = expiresLabel;
            expiresValue.className = "profile-readonly-value";
            expiresValue.textContent = currentExpires || neverLabel;

            copyButton.addEventListener("click", function () {
                var text = urlInput.value || "";
                if (!text || !navigator.clipboard || !navigator.clipboard.writeText) {
                    return;
                }
                navigator.clipboard.writeText(text).then(function () {
                    showInlineFlash(copySuccess, true);
                }).catch(function () {
                    showInlineFlash(generateError, false);
                });
            });

            expiryField.appendChild(expiryTitle);
            expiryField.appendChild(expirySelect);
            urlRow.appendChild(urlInput);
            urlRow.appendChild(copyButton);
            urlField.appendChild(urlTitle);
            urlField.appendChild(urlRow);
            expiresField.appendChild(expiresTitle);
            expiresField.appendChild(expiresValue);
            content.appendChild(intro);
            if (help) {
                content.appendChild(helpNode);
            }
            content.appendChild(expiryField);
            content.appendChild(urlField);
            content.appendChild(expiresField);

            openModal({
                kicker: kicker,
                title: title,
                contentNode: content,
                cancelText: closeLabel,
                confirmText: generateLabel,
                keepOpenOnConfirm: true,
                onConfirm: function () {
                    var body = new FormData();
                    var confirmButton = document.querySelector("[data-app-modal-confirm-slot] .primary-button");
                    body.append("expiry", expirySelect.value || "");
                    body.append("csrfmiddlewaretoken", csrfToken);

                    if (confirmButton) {
                        confirmButton.disabled = true;
                        confirmButton.textContent = generatingLabel;
                    }

                    return fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        body: body,
                        credentials: "same-origin"
                    }).then(function (response) {
                        return response.json().catch(function () {
                            return { ok: false, message: requestError };
                        }).then(function (payload) {
                            return { ok: response.ok && payload.ok, data: payload };
                        });
                    }).then(function (result) {
                        if (!result.ok) {
                            throw new Error(result.data.message || requestError);
                        }
                        currentUrl = result.data.url || currentUrl;
                        currentExpires = result.data.expires_display || neverLabel;
                        trigger.setAttribute("data-share-current-url", currentUrl);
                        trigger.setAttribute("data-share-current-expires", currentExpires);
                        urlInput.value = currentUrl;
                        expiresValue.textContent = currentExpires;
                        copyButton.disabled = !currentUrl;
                        showInlineFlash(copySuccess, true);
                    }).catch(function (error) {
                        showInlineFlash(error.message || generateError, false);
                    }).finally(function () {
                        if (confirmButton) {
                            confirmButton.disabled = false;
                            confirmButton.textContent = generateLabel;
                        }
                    });
                }
            });
        });
    });
}

function slugifyHeadingText(value) {
    return (value || "")
        .toLowerCase()
        .trim()
        .replace(/[\s\u3000]+/g, "-")
        .replace(/[^\w\-\u4e00-\u9fff]+/g, "")
        .replace(/\-+/g, "-")
        .replace(/^\-+|\-+$/g, "");
}

function initializePostOutline() {
    var outlineRoot = document.querySelector("[data-post-outline-root]");
    var outlineScope = document.querySelector("[data-post-outline-scope]");
    var postShell = document.querySelector(".post-detail-shell");
    var headerTitle = document.querySelector(".post-detail-header h1");
    var contentNode = document.querySelector("[data-post-content]");
    var outlineNavs = document.querySelectorAll("[data-post-outline-nav]");
    var mobileToggle = document.querySelector("[data-post-outline-toggle]");
    var mobilePanel = document.querySelector("[data-post-outline-panel]");
    var headings = [];
    var headingIds = Object.create(null);
    var outlineLinks = [];
    var observer = null;
    var activeId = "";
    var outlineStorageKey = "blog-post-outline-compact-position";
    var compactPointerId = null;
    var compactDragOffsetX = 0;
    var compactDragOffsetY = 0;
    var compactPosition = null;
    var isBookPostOutline = Boolean(outlineRoot && outlineRoot.classList.contains("book-post-outline"));
    var compactHideThreshold = isBookPostOutline ? 900 : 0;
    var expandedMinWidth = isBookPostOutline ? 1400 : 1180;
    var outlineGap = isBookPostOutline ? 32 : 24;

    if (!outlineRoot || !outlineScope || !postShell || !contentNode || !outlineNavs.length || !mobileToggle || !mobilePanel || outlineRoot.getAttribute("data-post-outline-bound") === "true") {
        return;
    }
    outlineRoot.setAttribute("data-post-outline-bound", "true");

    function getPanelWidth() {
        return Math.min(mobilePanel.offsetWidth || 300, Math.max(window.innerWidth - 32, 220));
    }

    function setPanelOpenDirection(direction) {
        mobilePanel.setAttribute("data-open-direction", direction === "right" ? "right" : "left");
    }

    function canShowExpandedPanel() {
        var shellRect = null;
        var panelWidth = getPanelWidth();
        var remainingSpace = 0;
        var outerSpace = 0;

        if (compactHideThreshold && window.innerWidth <= compactHideThreshold) {
            return false;
        }
        shellRect = postShell.getBoundingClientRect();
        if (isBookPostOutline) {
            outerSpace = Math.min(shellRect.left, window.innerWidth - shellRect.right) - outlineGap;
            return outerSpace >= panelWidth && window.innerWidth >= expandedMinWidth;
        }
        remainingSpace = window.innerWidth - shellRect.right - outlineGap;
        return remainingSpace >= panelWidth && window.innerWidth >= expandedMinWidth;
    }

    function isCompactOutlineMode() {
        return !canShowExpandedPanel();
    }

    function clampCompactPosition(position) {
        var margin = 12;
        var toggleSize = mobileToggle.offsetWidth || 48;
        var maxLeft = Math.max(margin, window.innerWidth - toggleSize - margin);
        var maxTop = Math.max(margin, window.innerHeight - toggleSize - margin);

        return {
            left: Math.min(Math.max(position.left, margin), maxLeft),
            top: Math.min(Math.max(position.top, margin), maxTop)
        };
    }

    function getDefaultCompactPosition() {
        var shellRect = postShell.getBoundingClientRect();
        var top = Math.max(88, shellRect.top + 12);
        var left = Math.min(window.innerWidth - 60, shellRect.right + 12);
        return clampCompactPosition({ left: left, top: top });
    }

    function loadCompactPosition() {
        var stored = null;
        try {
            stored = window.localStorage ? window.localStorage.getItem(outlineStorageKey) : null;
            stored = stored ? JSON.parse(stored) : null;
        } catch (_error) {
            return null;
        }
        if (!stored || typeof stored.left !== "number" || typeof stored.top !== "number") {
            return null;
        }
        return clampCompactPosition(stored);
    }

    function saveCompactPosition(position) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(outlineStorageKey, JSON.stringify(position));
            }
        } catch (_error) {
            return;
        }
    }

    function applyExpandedPosition() {
        var shellRect = postShell.getBoundingClientRect();
        var top = Math.max(88, shellRect.top);
        var left = shellRect.right + outlineGap;
        setPanelOpenDirection("left");
        outlineRoot.style.top = Math.round(top) + "px";
        outlineRoot.style.left = Math.round(left) + "px";
    }

    function applyCompactPosition(position) {
        var nextPosition = clampCompactPosition(position || getDefaultCompactPosition());
        compactPosition = nextPosition;
        outlineRoot.style.top = Math.round(nextPosition.top) + "px";
        outlineRoot.style.left = Math.round(nextPosition.left) + "px";
    }

    function updateCompactPanelDirection() {
        var toggleRect = mobileToggle.getBoundingClientRect();
        var panelWidth = getPanelWidth();
        var spaceOnRight = window.innerWidth - toggleRect.right - 12;
        setPanelOpenDirection(spaceOnRight >= panelWidth ? "right" : "left");
    }

    function updateOutlineRootPosition() {
        if (isCompactOutlineMode()) {
            applyCompactPosition(compactPosition || loadCompactPosition() || getDefaultCompactPosition());
            updateCompactPanelDirection();
            return;
        }
        compactPosition = null;
        applyExpandedPosition();
    }

    function toggleDraggingState(isDragging) {
        mobileToggle.classList.toggle("is-dragging", isDragging);
    }

    function handleCompactPointerMove(event) {
        if (compactPointerId !== event.pointerId) {
            return;
        }
        applyCompactPosition({
            left: event.clientX - compactDragOffsetX,
            top: event.clientY - compactDragOffsetY
        });
    }

    function handleCompactPointerEnd(event) {
        if (compactPointerId !== event.pointerId) {
            return;
        }
        compactPointerId = null;
        toggleDraggingState(false);
        try {
            mobileToggle.releasePointerCapture(event.pointerId);
        } catch (_error) {
        } finally {
            if (compactPosition) {
                saveCompactPosition(compactPosition);
            }
        }
    }

    function setActiveLink(nextId) {
        if (!nextId || activeId === nextId) {
            return;
        }
        activeId = nextId;
        outlineLinks.forEach(function (link) {
            var isActive = link.getAttribute("href") === "#" + nextId;
            link.classList.toggle("is-active", isActive);
            link.setAttribute("aria-current", isActive ? "location" : "false");
        });
    }

    function updateMobileToggleLabel() {
        mobileToggle.setAttribute("aria-label", mobilePanel && !mobilePanel.hidden ? "收起目录" : "打开目录");
    }

    function syncActiveHeadingFromViewport() {
        var viewportOffset = Math.max(window.innerHeight * 0.18, 96);
        var currentHeading = headings[0] || null;
        headings.forEach(function (heading) {
            if (heading.getBoundingClientRect().top <= viewportOffset) {
                currentHeading = heading;
            }
        });
        if (!currentHeading) {
            return;
        }
        setActiveLink(currentHeading.id);
        updateMobileToggleLabel();
    }

    function openMobileOutline() {
        mobilePanel.hidden = false;
        mobileToggle.setAttribute("aria-expanded", "true");
        updateMobileToggleLabel();
    }

    function closeMobileOutline() {
        mobilePanel.hidden = true;
        mobileToggle.setAttribute("aria-expanded", "false");
        updateMobileToggleLabel();
    }

    function syncOutlineDisplayMode() {
        if (outlineRoot.hasAttribute("data-post-outline-hide-narrow") && compactHideThreshold && window.innerWidth <= compactHideThreshold) {
            outlineRoot.hidden = true;
            mobileToggle.hidden = true;
            mobilePanel.hidden = true;
            mobileToggle.setAttribute("aria-expanded", "false");
            return;
        }
        if (isCompactOutlineMode()) {
            outlineRoot.classList.add("is-compact");
            outlineRoot.hidden = false;
            mobileToggle.hidden = false;
            closeMobileOutline();
        } else {
            outlineRoot.classList.remove("is-compact");
            outlineRoot.hidden = false;
            mobileToggle.hidden = true;
            mobilePanel.hidden = false;
            mobileToggle.setAttribute("aria-expanded", "true");
            updateMobileToggleLabel();
        }
        updateOutlineRootPosition();
    }

    if (headerTitle && (headerTitle.textContent || "").trim()) {
        headings.push(headerTitle);
    }
    Array.prototype.forEach.call(contentNode.querySelectorAll("h1, h2, h3"), function (heading) {
        if (heading && heading.textContent && heading.textContent.trim()) {
            headings.push(heading);
        }
    });
    if (!headings.length) {
        return;
    }

    headings.forEach(function (heading, index) {
        var baseId = heading.id || slugifyHeadingText(heading.textContent) || "section-" + String(index + 1);
        var uniqueId = baseId;
        var duplicateIndex = 2;
        var level = heading.tagName.toLowerCase();

        while (headingIds[uniqueId] || (document.getElementById(uniqueId) && document.getElementById(uniqueId) !== heading)) {
            uniqueId = baseId + "-" + String(duplicateIndex);
            duplicateIndex += 1;
        }
        headingIds[uniqueId] = true;
        heading.id = uniqueId;
        heading.tabIndex = -1;
        heading.classList.add("post-outline-target", "post-outline-target-" + level);
    });

    outlineNavs.forEach(function (nav) {
        var list = document.createElement("ol");
        list.className = "post-outline-list";
        headings.forEach(function (heading) {
            var item = document.createElement("li");
            var link = document.createElement("a");
            var level = heading.tagName.toLowerCase();

            item.className = "post-outline-item post-outline-item-" + level;
            if (heading === headerTitle) {
                item.classList.add("post-outline-item-title");
            }
            link.className = "post-outline-link";
            link.href = "#" + heading.id;
            link.textContent = heading.textContent.trim();
            link.setAttribute("aria-current", "false");
            link.addEventListener("click", function () {
                setActiveLink(heading.id);
                updateMobileToggleLabel();
            });
            item.appendChild(link);
            list.appendChild(item);
            outlineLinks.push(link);
        });

        nav.innerHTML = "";
        nav.appendChild(list);
    });

    outlineRoot.hidden = false;
    syncOutlineDisplayMode();
    mobileToggle.addEventListener("click", function () {
        if (mobileToggle.classList.contains("is-dragging")) {
            return;
        }
        if (mobilePanel && !mobilePanel.hidden) {
            closeMobileOutline();
        } else {
            updateCompactPanelDirection();
            openMobileOutline();
        }
    });
    mobileToggle.addEventListener("pointerdown", function (event) {
        var rect = null;
        if (!isCompactOutlineMode()) {
            return;
        }
        rect = mobileToggle.getBoundingClientRect();
        compactPointerId = event.pointerId;
        compactDragOffsetX = event.clientX - rect.left;
        compactDragOffsetY = event.clientY - rect.top;
        toggleDraggingState(false);
        mobileToggle.setPointerCapture(event.pointerId);
    });
    mobileToggle.addEventListener("pointermove", function (event) {
        if (compactPointerId !== event.pointerId) {
            return;
        }
        if (Math.abs(event.movementX) > 0 || Math.abs(event.movementY) > 0) {
            toggleDraggingState(true);
        }
        handleCompactPointerMove(event);
        updateCompactPanelDirection();
    });
    mobileToggle.addEventListener("pointerup", handleCompactPointerEnd);
    mobileToggle.addEventListener("pointercancel", handleCompactPointerEnd);

    if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(function (entries) {
            var visibleEntries = entries.filter(function (entry) {
                return entry.isIntersecting;
            });
            if (!visibleEntries.length) {
                return;
            }
            visibleEntries.sort(function (left, right) {
                return left.boundingClientRect.top - right.boundingClientRect.top;
            });
            setActiveLink(visibleEntries[0].target.id);
            updateMobileToggleLabel();
        }, {
            rootMargin: "-12% 0px -70% 0px",
            threshold: [0, 1]
        });

        headings.forEach(function (heading) {
            observer.observe(heading);
        });
    }

    syncActiveHeadingFromViewport();
    document.addEventListener("scroll", syncActiveHeadingFromViewport, true);
    window.addEventListener("resize", function () {
        syncOutlineDisplayMode();
        syncActiveHeadingFromViewport();
    });
    window.addEventListener("hashchange", function () {
        var hash = window.location.hash || "";
        if (!hash || hash === "#") {
            return;
        }
        activeId = "";
        setActiveLink(hash.slice(1));
        updateMobileToggleLabel();
    });
}

function initializeBookOutline() {
    var dataNode = document.querySelector("[data-book-outline-data]");
    var outlineRoot = document.querySelector("[data-book-outline-root]");
    var outlineNavs = document.querySelectorAll("[data-book-outline-nav]");
    var mobileToggle = document.querySelector("[data-book-outline-toggle]");
    var mobilePanel = document.querySelector("[data-book-outline-panel]");
    var scope = document.querySelector("[data-book-outline-scope]");
    var storageKey = "blog-book-outline-compact-position";
    var compactPointerId = null;
    var compactOffsetX = 0;
    var compactOffsetY = 0;
    var compactPosition = null;
    var items = [];
    var expandedMinWidth = 1400;
    var outlineGap = 32;

    if (!dataNode || !outlineRoot || !outlineNavs.length || outlineRoot.getAttribute("data-book-outline-bound") === "true") {
        return;
    }
    outlineRoot.setAttribute("data-book-outline-bound", "true");

    try {
        items = JSON.parse(dataNode.textContent || "[]") || [];
    } catch (_error) {
        items = [];
    }

    function getPanelWidth() {
        return Math.min((mobilePanel && mobilePanel.offsetWidth) || 300, Math.max(window.innerWidth - 32, 220));
    }

    function canShowExpandedPanel() {
        var rect = scope ? scope.getBoundingClientRect() : null;
        var outerSpace = rect ? Math.min(rect.left, window.innerWidth - rect.right) - outlineGap : 0;
        return Boolean(scope) && outerSpace >= getPanelWidth() && window.innerWidth >= expandedMinWidth;
    }

    function clampPosition(position) {
        var margin = 12;
        var toggleSize = mobileToggle ? mobileToggle.offsetWidth || 48 : 48;
        return {
            left: Math.min(Math.max(position.left, margin), Math.max(margin, window.innerWidth - toggleSize - margin)),
            top: Math.min(Math.max(position.top, margin), Math.max(margin, window.innerHeight - toggleSize - margin))
        };
    }

    function applyExpandedPosition() {
        var rect = scope ? scope.getBoundingClientRect() : null;
        if (!rect) {
            return;
        }
        outlineRoot.style.top = Math.max(88, rect.top) + "px";
        outlineRoot.style.left = Math.max(16, rect.left - getPanelWidth() - outlineGap) + "px";
    }

    function loadCompactPosition() {
        try {
            return clampPosition(JSON.parse(window.localStorage.getItem(storageKey) || "null") || { left: window.innerWidth - 60, top: 88 });
        } catch (_error) {
            return { left: window.innerWidth - 60, top: 88 };
        }
    }

    function saveCompactPosition(position) {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(position));
        } catch (_error) {
            return;
        }
    }

    function applyCompactPosition(position) {
        compactPosition = clampPosition(position || loadCompactPosition());
        outlineRoot.style.top = compactPosition.top + "px";
        outlineRoot.style.left = compactPosition.left + "px";
    }

    function updateMode() {
        var compact = !canShowExpandedPanel();
        outlineRoot.classList.toggle("is-compact", compact);
        if (compact) {
            outlineRoot.hidden = false;
            applyCompactPosition(compactPosition || loadCompactPosition());
            if (mobileToggle) {
                mobileToggle.hidden = false;
            }
            if (mobilePanel) {
                mobilePanel.hidden = true;
            }
        } else {
            outlineRoot.hidden = false;
            if (mobileToggle) {
                mobileToggle.hidden = true;
                mobileToggle.setAttribute("aria-expanded", "false");
            }
            if (mobilePanel) {
                mobilePanel.hidden = false;
            }
            applyExpandedPosition();
        }
    }

    function renderNodes(nodes) {
        var list = document.createElement("ul");
        list.className = "post-outline-list book-outline-list";

        (nodes || []).forEach(function (node) {
            var item = document.createElement("li");
            item.className = "post-outline-item";
            if (node.type === "group") {
                var heading = document.createElement("div");
                item.classList.add("book-outline-group-item");
                heading.className = "book-outline-group-title";
                heading.textContent = node.title || "";
                item.appendChild(heading);
                item.appendChild(renderNodes(node.children || []));
                list.appendChild(item);
                return;
            }

            var link = document.createElement("a");
            var title = document.createElement("span");
            var hasStatus = false;
            link.className = "post-outline-link book-outline-link" + (node.isCurrent ? " is-active" : "");
            link.href = node.url || "#";
            if (node.isCurrent) {
                link.setAttribute("aria-current", "page");
            }
            title.className = "book-outline-link-text";
            title.textContent = node.title || "";
            hasStatus = appendAccessDisplay(link, node.accessDisplay || null, {
                fallbackPresentation: node.visibilityPresentation || null,
                iconClassName: "book-outline-status-icon",
                countClassName: "book-outline-status-count"
            });
            if (hasStatus) {
                link.appendChild(document.createTextNode(" "));
            }
            link.appendChild(title);
            item.appendChild(link);
            list.appendChild(item);
        });

        return list;
    }

    outlineNavs.forEach(function (nav) {
        nav.innerHTML = "";
        nav.appendChild(renderNodes(items));
        bindConditionTooltips(nav);
    });

    if (mobileToggle && mobilePanel) {
        mobilePanel.hidden = true;
        mobileToggle.addEventListener("click", function () {
            var isHidden = mobilePanel.hidden;
            mobilePanel.hidden = !isHidden;
            mobileToggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
        });
        mobileToggle.addEventListener("pointerdown", function (event) {
            if (!outlineRoot.classList.contains("is-compact")) {
                return;
            }
            compactPointerId = event.pointerId;
            compactOffsetX = event.clientX - mobileToggle.getBoundingClientRect().left;
            compactOffsetY = event.clientY - mobileToggle.getBoundingClientRect().top;
            mobileToggle.setPointerCapture(event.pointerId);
        });
        mobileToggle.addEventListener("pointermove", function (event) {
            if (compactPointerId !== event.pointerId) {
                return;
            }
            applyCompactPosition({ left: event.clientX - compactOffsetX, top: event.clientY - compactOffsetY });
        });
        mobileToggle.addEventListener("pointerup", function (event) {
            if (compactPointerId !== event.pointerId) {
                return;
            }
            compactPointerId = null;
            saveCompactPosition(compactPosition || loadCompactPosition());
            try {
                mobileToggle.releasePointerCapture(event.pointerId);
            } catch (_error) {
                return;
            }
        });
    }

    window.addEventListener("resize", updateMode);
    updateMode();
}

function submitHiddenPost(url, actionValue) {
    var form = document.createElement("form");
    var csrfToken = getCsrfToken();
    var actionInput = document.createElement("input");
    form.method = "post";
    form.action = url;

    if (csrfToken) {
        var csrfField = document.createElement("input");
        csrfField.type = "hidden";
        csrfField.name = "csrfmiddlewaretoken";
        csrfField.value = csrfToken;
        form.appendChild(csrfField);
    }

    actionInput.type = "hidden";
    actionInput.name = "action";
    actionInput.value = actionValue;
    form.appendChild(actionInput);
    document.body.appendChild(form);
    form.submit();
}

function bindRevisionChoiceTriggers() {
    Array.prototype.forEach.call(document.querySelectorAll(".js-revision-choice-trigger"), function (trigger) {
        if (trigger.getAttribute("data-revision-choice-bound") === "true") {
            return;
        }
        trigger.setAttribute("data-revision-choice-bound", "true");
        trigger.addEventListener("click", function (event) {
            var openUrl = trigger.getAttribute("data-revision-choice-url-open") || "";
            var resetUrl = trigger.getAttribute("data-revision-choice-url-reset") || "";
            var title = trigger.getAttribute("data-revision-choice-title") || "";
            var messageTemplateId = trigger.getAttribute("data-revision-choice-message-template") || "";
            var openLabel = trigger.getAttribute("data-revision-choice-open-label") || "";
            var resetLabel = trigger.getAttribute("data-revision-choice-reset-label") || "";
            var cancelLabel = trigger.getAttribute("data-revision-choice-cancel-label") || "Cancel";
            var content = document.createElement("div");
            var text = document.createElement("p");
            var messageTemplate = messageTemplateId ? document.querySelector("#" + messageTemplateId) : null;
            var message = "";

            if (messageTemplate) {
                message = (messageTemplate.content ? messageTemplate.content.textContent : messageTemplate.textContent || "").trim();
            }
            if (!openUrl || !resetUrl) {
                return;
            }

            event.preventDefault();
            content.className = "revision-choice-modal-content";
            text.textContent = message;
            content.appendChild(text);
            openModal({
                tone: "attention",
                kicker: title,
                title: title,
                contentNode: content,
                cancelText: cancelLabel,
                extraActions: [
                    {
                        label: resetLabel,
                        className: "primary-button app-modal-action-discard",
                        onClick: function () {
                            submitHiddenPost(resetUrl, "reset");
                        }
                    },
                    {
                        label: openLabel,
                        className: "secondary-button app-modal-action-open",
                        onClick: function () {
                            window.location.href = openUrl;
                        }
                    }
                ]
            });
        });
    });
}

function getPostLinkPreviewEndpoint() {
    return "/blog/link-preview/";
}

function clearPostLinkPreviewHoverTimer() {
    if (postLinkPreviewHoverTimer) {
        window.clearTimeout(postLinkPreviewHoverTimer);
        postLinkPreviewHoverTimer = 0;
    }
}

function clearPostLinkPreviewHideTimer() {
    if (postLinkPreviewHideTimer) {
        window.clearTimeout(postLinkPreviewHideTimer);
        postLinkPreviewHideTimer = 0;
    }
}

function createPostLinkPreviewTooltip() {
    var tooltip = null;
    var body = null;

    if (postLinkPreviewTooltip) {
        return postLinkPreviewTooltip;
    }

    tooltip = document.createElement("div");
    body = document.createElement("div");
    tooltip.className = "post-link-preview-tooltip";
    tooltip.hidden = true;
    tooltip.setAttribute("data-post-link-preview-tooltip", "true");
    tooltip.setAttribute("role", "tooltip");
    body.className = "post-link-preview-tooltip-body";
    tooltip.appendChild(body);
    tooltip.addEventListener("mouseenter", clearPostLinkPreviewHideTimer);
    tooltip.addEventListener("mouseleave", schedulePostLinkPreviewHide);
    document.body.appendChild(tooltip);
    postLinkPreviewTooltip = tooltip;
    postLinkPreviewBody = body;
    return tooltip;
}

function positionPostLinkPreviewTooltip(anchorElement) {
    var tooltip = createPostLinkPreviewTooltip();
    var anchorRect = null;
    var tooltipRect = null;
    var top = 0;
    var left = 0;
    var center = 0;
    var minLeft = 0;
    var maxLeft = 0;

    if (!tooltip || !anchorElement) {
        return;
    }

    anchorRect = anchorElement.getBoundingClientRect();
    tooltip.hidden = false;
    tooltip.classList.add("is-above");
    tooltipRect = tooltip.getBoundingClientRect();
    top = window.scrollY + anchorRect.top - tooltipRect.height - 12;
    center = window.scrollX + anchorRect.left + (anchorRect.width / 2);
    left = center - (tooltipRect.width / 2);
    minLeft = window.scrollX + 12;
    maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - 12;
    left = Math.max(minLeft, Math.min(left, maxLeft));
    if (top < window.scrollY + 12) {
        top = window.scrollY + anchorRect.bottom + 12;
        tooltip.classList.remove("is-above");
    }
    tooltip.style.top = Math.max(window.scrollY + 12, top) + "px";
    tooltip.style.left = left + "px";
}

function hidePostLinkPreviewTooltip() {
    clearPostLinkPreviewHoverTimer();
    clearPostLinkPreviewHideTimer();
    postLinkPreviewRequestPath = "";
    if (!postLinkPreviewTooltip) {
        postLinkPreviewActiveLink = null;
        return;
    }
    postLinkPreviewTooltip.hidden = true;
    postLinkPreviewTooltip.classList.remove("is-loading", "is-empty", "is-above");
    postLinkPreviewTooltip.style.top = "";
    postLinkPreviewTooltip.style.left = "";
    if (postLinkPreviewBody) {
        postLinkPreviewBody.innerHTML = "";
    }
    postLinkPreviewActiveLink = null;
}

function schedulePostLinkPreviewHide() {
    clearPostLinkPreviewHideTimer();
    postLinkPreviewHideTimer = window.setTimeout(function () {
        var activeElement = document.activeElement;
        if (postLinkPreviewTooltip && !postLinkPreviewTooltip.hidden && postLinkPreviewTooltip.contains(activeElement)) {
            return;
        }
        if (postLinkPreviewActiveLink && activeElement === postLinkPreviewActiveLink) {
            return;
        }
        hidePostLinkPreviewTooltip();
    }, 120);
}

function isInternalPostLink(link) {
    var href = "";
    var parsed = null;
    var queryPost = "";

    if (!link) {
        return false;
    }
    href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) !== "/" || href.indexOf("//") === 0 || href.charAt(0) === "#") {
        return false;
    }
    try {
        parsed = new URL(link.href, window.location.origin);
    } catch (_error) {
        return false;
    }
    if (parsed.origin !== window.location.origin) {
        return false;
    }
    if (/^\/blog\/[^/]+\/?$/.test(parsed.pathname)) {
        return true;
    }
    queryPost = (parsed.searchParams.get("post") || "").trim();
    if (!queryPost) {
        return false;
    }
    return /^\/book\/[^/]+\/?$/.test(parsed.pathname) || /^\/book-share\/[^/]+\/?$/.test(parsed.pathname);
}

function getInternalPostLinkPath(link) {
    var parsed = null;
    var queryPost = "";
    if (!isInternalPostLink(link)) {
        return "";
    }
    try {
        parsed = new URL(link.href, window.location.origin);
    } catch (_error) {
        return "";
    }
    if (/^\/blog\/[^/]+\/?$/.test(parsed.pathname)) {
        return parsed.pathname;
    }
    queryPost = (parsed.searchParams.get("post") || "").trim();
    if (!queryPost) {
        return "";
    }
    return parsed.pathname + "?post=" + encodeURIComponent(queryPost);
}

function renderPostLinkPreviewTooltip(link, payload) {
    var tooltip = createPostLinkPreviewTooltip();
    if (!tooltip || !postLinkPreviewBody || !link || !payload || !payload.html) {
        hidePostLinkPreviewTooltip();
        return;
    }
    postLinkPreviewActiveLink = link;
    postLinkPreviewBody.innerHTML = payload.html;
    tooltip.classList.remove("is-loading", "is-empty");
    positionPostLinkPreviewTooltip(link);
}

function fetchPostLinkPreview(link, path) {
    var endpoint = getPostLinkPreviewEndpoint();
    var tooltip = createPostLinkPreviewTooltip();

    if (!endpoint || !tooltip || !postLinkPreviewBody || !link || !path) {
        return;
    }
    if (postLinkPreviewCache[path]) {
        renderPostLinkPreviewTooltip(link, postLinkPreviewCache[path]);
        return;
    }

    postLinkPreviewActiveLink = link;
    postLinkPreviewRequestPath = path;
    tooltip.hidden = false;
    tooltip.classList.add("is-loading");
    tooltip.classList.remove("is-empty", "is-above");
    postLinkPreviewBody.innerHTML = '<div class="post-link-preview-tooltip-status">Loading preview...</div>';
    positionPostLinkPreviewTooltip(link);

    fetch(endpoint + "?path=" + encodeURIComponent(path), {
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" }
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("preview request failed");
            }
            return response.json();
        })
        .then(function (payload) {
            if (postLinkPreviewRequestPath !== path || postLinkPreviewActiveLink !== link) {
                return;
            }
            if (!payload || !payload.ok || !payload.html) {
                hidePostLinkPreviewTooltip();
                return;
            }
            postLinkPreviewCache[path] = payload;
            renderPostLinkPreviewTooltip(link, payload);
        })
        .catch(function () {
            if (postLinkPreviewRequestPath === path && postLinkPreviewActiveLink === link) {
                hidePostLinkPreviewTooltip();
            }
        });
}

function showPostLinkPreview(link) {
    var path = getInternalPostLinkPath(link);
    clearPostLinkPreviewHoverTimer();
    clearPostLinkPreviewHideTimer();
    if (!path) {
        return;
    }
    if (postLinkPreviewActiveLink === link && postLinkPreviewTooltip && !postLinkPreviewTooltip.hidden) {
        positionPostLinkPreviewTooltip(link);
        return;
    }
    postLinkPreviewHoverTimer = window.setTimeout(function () {
        fetchPostLinkPreview(link, path);
    }, 500);
}

export function bindInternalPostLinkPreviews(rootNode) {
    if (!rootNode) {
        return;
    }
    Array.prototype.forEach.call(rootNode.querySelectorAll("a[href]"), function (link) {
        if (!isInternalPostLink(link) || link.getAttribute("data-post-link-preview-bound") === "true") {
            return;
        }
        link.setAttribute("data-post-link-preview-bound", "true");
        link.classList.add("internal-post-link");
        link.addEventListener("mouseenter", function () {
            showPostLinkPreview(link);
        });
        link.addEventListener("mouseleave", function () {
            clearPostLinkPreviewHoverTimer();
            schedulePostLinkPreviewHide();
        });
        link.addEventListener("focus", function () {
            showPostLinkPreview(link);
        });
        link.addEventListener("blur", function () {
            clearPostLinkPreviewHoverTimer();
            schedulePostLinkPreviewHide();
        });
    });
}

function initLinkPreviewCleanup() {
    document.addEventListener("click", function (event) {
        if (postLinkPreviewTooltip && !postLinkPreviewTooltip.hidden) {
            if (postLinkPreviewTooltip.contains(event.target)) {
                return;
            }
            if (!event.target.closest("a[data-post-link-preview-bound='true']")) {
                hidePostLinkPreviewTooltip();
            }
        }
    });
    window.addEventListener("resize", hidePostLinkPreviewTooltip);
    window.addEventListener("scroll", function () {
        hidePostLinkPreviewTooltip();
    }, true);
}

function scrollToCommentEditError() {
    var panels = document.querySelectorAll(
        "[data-comment-entry-panel]:not([hidden]), [data-comment-edit-panel]:not([hidden]), [data-reply-panel]:not([hidden])"
    );
    for (var i = 0; i < panels.length; i++) {
        var form = panels[i].querySelector("form");
        if (!form) continue;
        var errorEl = form.querySelector(".field-error");
        if (errorEl) {
            errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
        }
    }
}

var sharedInitialized = false;

export function initBlogShared() {
    if (sharedInitialized) {
        return;
    }
    sharedInitialized = true;
    bindConditionTooltips(document);
    initializeImportPostCards(document);
    initializeConditionalAccess();
    initializeEncryptedPostAccess();
    bindFeedbackWidgets();
    bindInlineShareControls();
    bindExternalShareEditors();
    bindRevisionChoiceTriggers();
    initializePostOutline();
    initializeBookOutline();
    initLinkPreviewCleanup();
    scrollToCommentEditError();
}
