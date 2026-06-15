var modalInitialized = false;
var baseInitialized = false;
var flashStack = null;
var userMenu = null;
var userMenuTrigger = null;
var userMenuDropdown = null;
var globalSearchForm = null;
var globalSearchInput = null;
var multiComboboxes = [];
var actionMenu = null;
var unsavedGuards = [];
var bypassUnsavedGuard = false;
var pendingUnsavedNavigation = null;
var modalHost = null;
var modalTemplate = null;
var modalIdCounter = 0;
var modalStack = [];

function getModalHost() {
    if (modalHost && document.body && document.body.contains(modalHost)) {
        return modalHost;
    }
    modalHost = document.querySelector("[data-app-modal-host]");
    return modalHost;
}

function getModalTemplate() {
    var host = getModalHost();
    if (modalTemplate && host && host.contains(modalTemplate)) {
        return modalTemplate;
    }
    modalTemplate = host ? host.querySelector("[data-app-modal-template]") : null;
    return modalTemplate;
}

function getModalDefaults() {
    var host = getModalHost();
    return {
        toneClasses: ["is-attention", "is-warning", "is-error"],
        variantClasses: ["is-table-dialog", "is-wide-dialog", "is-medium-dialog", "is-attachment-browser-dialog"],
        deleteDefaultTitle: host ? host.getAttribute("data-delete-default-title") || "Delete item" : "Delete item",
        removeDefaultTitle: host ? host.getAttribute("data-remove-default-title") || "Remove item" : "Remove item",
        deleteDefaultMessage: host ? host.getAttribute("data-delete-default-message") || "Are you sure you want to continue? This action cannot be undone." : "Are you sure you want to continue? This action cannot be undone.",
        deleteDefaultConfirm: host ? host.getAttribute("data-delete-default-confirm") || "Delete" : "Delete",
        removeDefaultConfirm: host ? host.getAttribute("data-remove-default-confirm") || "Remove" : "Remove",
        deleteDefaultCancel: host ? host.getAttribute("data-delete-default-cancel") || "Cancel" : "Cancel",
        unsavedDefaultKicker: host ? host.getAttribute("data-unsaved-default-kicker") || "Unsaved changes" : "Unsaved changes",
        unsavedDefaultTitle: host ? host.getAttribute("data-unsaved-default-title") || "Discard unsaved changes?" : "Discard unsaved changes?",
        unsavedDefaultMessage: host ? host.getAttribute("data-unsaved-default-message") || "Your changes have not been saved yet. If you leave this page now, those changes will be lost." : "Your changes have not been saved yet. If you leave this page now, those changes will be lost.",
        unsavedDefaultConfirm: host ? host.getAttribute("data-unsaved-default-confirm") || "Leave page" : "Leave page",
        unsavedDefaultCancel: host ? host.getAttribute("data-unsaved-default-cancel") || "Keep editing" : "Keep editing"
    };
}

function getModalFrameElements(root) {
    if (!root) {
        return null;
    }
    return {
        root: root,
        dialog: root.querySelector("[data-app-modal-dialog]"),
        kicker: root.querySelector("[data-app-modal-kicker]"),
        title: root.querySelector("[data-app-modal-title]"),
        message: root.querySelector("[data-app-modal-message]"),
        actions: root.querySelector("[data-app-modal-actions]"),
        cancelSlot: root.querySelector("[data-app-modal-cancel-slot]"),
        confirmSlot: root.querySelector("[data-app-modal-confirm-slot]")
    };
}

function getTopModalFrame() {
    if (!modalStack.length) {
        return null;
    }
    return modalStack[modalStack.length - 1];
}

function findModalFrameByHandle(handle) {
    if (!handle) {
        return getTopModalFrame();
    }
    if (handle.__modalFrame) {
        return handle.__modalFrame;
    }
    if (typeof handle === "number") {
        return modalStack.find(function (frame) {
            return frame.id === handle;
        }) || null;
    }
    return null;
}

function updateBodyModalState() {
    var host = getModalHost();
    if (!document.body) {
        return;
    }
    document.body.classList.toggle("modal-open", modalStack.length > 0);
    if (host) {
        host.hidden = modalStack.length < 1;
    }
}

function updateModalLayerState() {
    modalStack.forEach(function (frame, index) {
        var isTop = index === modalStack.length - 1;
        if (!frame.root) {
            return;
        }
        frame.root.hidden = false;
        frame.root.classList.toggle("is-inactive", !isTop);
        frame.root.style.zIndex = String(1000 + index);
        frame.root.setAttribute("aria-hidden", isTop ? "false" : "true");
    });
    updateBodyModalState();
}

function restoreFrameContent(frame) {
    if (!frame || !frame.contentRecord || !frame.contentRecord.node) {
        return;
    }
    var node = frame.contentRecord.node;
    var parent = frame.contentRecord.parent;
    var nextSibling = frame.contentRecord.nextSibling;
    if (!parent || !node) {
        return;
    }
    if (nextSibling && nextSibling.parentNode === parent) {
        parent.insertBefore(node, nextSibling);
        return;
    }
    parent.appendChild(node);
}

function focusFrame(frame) {
    var elements = null;
    var confirmButton = null;
    var cancelButton = null;
    if (!frame || !frame.elements) {
        return;
    }
    elements = frame.elements;
    confirmButton = elements.confirmSlot ? elements.confirmSlot.querySelector("button:not([disabled]):not([hidden])") : null;
    cancelButton = elements.cancelSlot ? elements.cancelSlot.querySelector("button:not([disabled]):not([hidden])") : null;
    window.requestAnimationFrame(function () {
        (confirmButton || cancelButton || elements.dialog || elements.root).focus();
    });
}

function applyFrameTone(frame, tone) {
    var defaults = getModalDefaults();
    if (!frame || !frame.root) {
        return;
    }
    defaults.toneClasses.forEach(function (className) {
        frame.root.classList.remove(className);
    });
    if (tone === "attention") {
        frame.root.classList.add("is-attention");
    } else if (tone === "warning") {
        frame.root.classList.add("is-warning");
    } else if (tone === "error") {
        frame.root.classList.add("is-error");
    }
}

function applyFrameDialogClass(frame, dialogClass) {
    var defaults = getModalDefaults();
    if (!frame || !frame.elements || !frame.elements.dialog) {
        return;
    }
    defaults.variantClasses.forEach(function (className) {
        frame.elements.dialog.classList.remove(className);
    });
    if (dialogClass && defaults.variantClasses.indexOf(dialogClass) !== -1) {
        frame.elements.dialog.classList.add(dialogClass);
    }
}

function createModalButton(className, label, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

function triggerFrameCancel(frame, reason) {
    if (!frame || frame.isClosing) {
        return;
    }
    if (typeof frame.onCancel === "function") {
        frame.onCancel(frame.api, reason || "cancel");
    }
}

function destroyModalFrame(frame, options) {
    var config = options || {};
    var index = modalStack.indexOf(frame);
    var focusTarget = null;
    if (!frame || frame.isClosing || index === -1) {
        return;
    }
    frame.isClosing = true;
    modalStack.splice(index, 1);
    restoreFrameContent(frame);
    if (frame.root && frame.root.parentNode) {
        frame.root.parentNode.removeChild(frame.root);
    }
    updateModalLayerState();
    if (!config.skipFocusRestore) {
        if (modalStack.length) {
            focusFrame(getTopModalFrame());
        } else {
            focusTarget = frame.restoreFocus;
            if (focusTarget && document.body && document.body.contains(focusTarget) && typeof focusTarget.focus === "function") {
                focusTarget.focus();
            }
        }
    }
    frame.isClosing = false;
}

function closeFrame(frame, options) {
    destroyModalFrame(frame, options);
}

function cancelFrame(frame, reason) {
    if (!frame || frame.isClosing) {
        return;
    }
    triggerFrameCancel(frame, reason || "cancel");
    if (frame.isClosing) {
        return;
    }
    destroyModalFrame(frame);
}

function runConfirmFrame(frame) {
    var confirmResult = null;
    if (!frame || frame.isClosing || frame.isConfirmPending) {
        return;
    }
    if (typeof frame.onConfirm === "function") {
        confirmResult = frame.onConfirm(frame.api);
    }
    if (confirmResult && typeof confirmResult.then === "function") {
        frame.isConfirmPending = true;
        confirmResult.finally(function () {
            frame.isConfirmPending = false;
        });
    }
    if (!frame.keepOpenOnConfirm) {
        destroyModalFrame(frame, { skipFocusRestore: true });
    }
}

function createModalApi(frame) {
    return {
        __modalFrame: frame,
        id: frame.id,
        close: function () {
            closeFrame(frame);
        },
        cancel: function (reason) {
            cancelFrame(frame, reason || "cancel");
        },
        confirm: function () {
            runConfirmFrame(frame);
        },
        setTitle: function (value) {
            if (frame.elements && frame.elements.title) {
                frame.elements.title.textContent = value || "";
            }
        },
        setKicker: function (value) {
            if (frame.elements && frame.elements.kicker) {
                frame.elements.kicker.textContent = value || "";
            }
        },
        setMessage: function (value) {
            if (frame.elements && frame.elements.message) {
                frame.elements.message.textContent = value || "";
            }
        },
        setConfirmDisabled: function (disabled) {
            var button = this.getPrimaryButton();
            if (!button) {
                return;
            }
            button.disabled = Boolean(disabled);
            button.classList.toggle("is-disabled", Boolean(disabled));
        },
        getPrimaryButton: function () {
            return frame.elements && frame.elements.confirmSlot ? frame.elements.confirmSlot.querySelector("button.primary-button, button") : null;
        },
        getElements: function () {
            return frame.elements;
        },
        getRoot: function () {
            return frame.root;
        },
        setActions: function (builder) {
            renderFrameActions(frame, builder);
        },
        isOpen: function () {
            return modalStack.indexOf(frame) !== -1;
        }
    };
}

function renderFrameActions(frame, builder) {
    var result = null;
    var cancelText = "";
    var confirmText = "";
    var extraActions = [];
    if (!frame || !frame.elements) {
        return;
    }
    if (typeof builder === "function") {
        result = builder(frame.api) || {};
    } else {
        result = builder || {};
    }
    cancelText = result.cancelText !== undefined ? result.cancelText : frame.cancelText;
    confirmText = result.confirmText !== undefined ? result.confirmText : frame.confirmText;
    extraActions = result.extraActions !== undefined ? result.extraActions : frame.extraActions;
    frame.cancelText = cancelText;
    frame.confirmText = confirmText;
    frame.extraActions = Array.isArray(extraActions) ? extraActions : [];
    if (frame.elements.cancelSlot) {
        frame.elements.cancelSlot.innerHTML = "";
    }
    if (frame.elements.confirmSlot) {
        frame.elements.confirmSlot.innerHTML = "";
    }
    if (cancelText && frame.elements.cancelSlot) {
        frame.elements.cancelSlot.appendChild(
            createModalButton("app-modal-secondary-button", cancelText, function () {
                cancelFrame(frame, "cancel-button");
            })
        );
    }
    if (confirmText && frame.elements.confirmSlot) {
        frame.elements.confirmSlot.appendChild(
            createModalButton("primary-button", confirmText, function () {
                runConfirmFrame(frame);
            })
        );
    }
    if (frame.extraActions.length && frame.elements.confirmSlot) {
        frame.extraActions.forEach(function (action) {
            if (!action || !action.label) {
                return;
            }
            frame.elements.confirmSlot.appendChild(
                createModalButton(action.className || "secondary-button", action.label, function () {
                    var actionResult = null;
                    if (typeof action.onClick === "function") {
                        actionResult = action.onClick(frame.api);
                    }
                    if (!(actionResult && typeof actionResult.then === "function") && action.keepOpen !== true) {
                        closeFrame(frame);
                    }
                })
            );
        });
    }
}

function createModalFrame(options) {
    var template = getModalTemplate();
    var frameRoot = null;
    var elements = null;
    var frame = null;
    var titleId = "app-modal-title-" + String(modalIdCounter + 1);
    var messageId = "app-modal-message-" + String(modalIdCounter + 1);
    var contentNode = options && options.contentNode ? options.contentNode : null;
    var messageText = options && options.message ? options.message : "";
    if (!template) {
        return null;
    }
    frameRoot = template.cloneNode(true);
    frameRoot.hidden = false;
    frameRoot.removeAttribute("data-app-modal-template");
    elements = getModalFrameElements(frameRoot);
    if (!elements || !elements.dialog) {
        return null;
    }
    modalIdCounter += 1;
    elements.dialog.setAttribute("aria-labelledby", titleId);
    elements.dialog.setAttribute("aria-describedby", messageId);
    if (elements.title) {
        elements.title.id = titleId;
    }
    if (elements.message) {
        elements.message.id = messageId;
    }
    frame = {
        id: modalIdCounter,
        root: frameRoot,
        elements: elements,
        restoreFocus: document.activeElement,
        onConfirm: options && options.onConfirm ? options.onConfirm : null,
        onCancel: options && options.onCancel ? options.onCancel : null,
        keepOpenOnConfirm: Boolean(options && options.keepOpenOnConfirm),
        isConfirmPending: false,
        closeOnEsc: options && options.closeOnEsc !== false,
        closeOnBackdrop: options && options.closeOnBackdrop !== false,
        cancelText: options && options.cancelText ? options.cancelText : "",
        confirmText: options && options.confirmText ? options.confirmText : "",
        extraActions: options && options.extraActions ? options.extraActions.slice() : [],
        contentRecord: contentNode ? {
            node: contentNode,
            parent: contentNode.parentNode,
            nextSibling: contentNode.nextSibling
        } : null,
        isClosing: false,
        api: null
    };
    frame.api = createModalApi(frame);
    frameRoot.__modalApi = frame.api;
    applyFrameTone(frame, options && options.tone ? options.tone : "notice");
    applyFrameDialogClass(frame, options && options.dialogClass ? options.dialogClass : "");
    if (elements.kicker) {
        elements.kicker.textContent = options && options.kicker ? options.kicker : "";
    }
    if (elements.title) {
        elements.title.textContent = options && options.title ? options.title : "";
    }
    if (elements.message) {
        elements.message.textContent = messageText || "";
        if (contentNode) {
            elements.message.textContent = "";
            elements.message.appendChild(contentNode);
        }
    }
    renderFrameActions(frame);
    return frame;
}

function findPrimaryModalAction() {
    var frame = getTopModalFrame();
    var confirmButton = null;
    if (!frame || !frame.elements) {
        return null;
    }
    if (frame.elements.confirmSlot) {
        confirmButton = frame.elements.confirmSlot.querySelector("button:not([disabled]):not([hidden])");
    }
    if (confirmButton) {
        return confirmButton;
    }
    if (frame.elements.cancelSlot) {
        return frame.elements.cancelSlot.querySelector("button:not([disabled]):not([hidden])");
    }
    return null;
}

function shouldIgnoreModalEnter(event) {
    var frame = getTopModalFrame();
    var target = event.target;
    var tagName = "";
    if (!frame || !frame.root || !target || !(target instanceof HTMLElement) || !frame.root.contains(target)) {
        return false;
    }
    if (target.closest("[data-app-modal-confirm-slot] button, [data-app-modal-cancel-slot] button")) {
        return true;
    }
    tagName = target.tagName;
    return tagName === "TEXTAREA" || target.isContentEditable;
}

function confirmActiveModal() {
    var actionButton = null;
    if (!modalStack.length) {
        return;
    }
    actionButton = findPrimaryModalAction();
    if (actionButton) {
        actionButton.click();
    }
}

function isModalOpen() {
    return modalStack.length > 0;
}

function normalizeCloseReason(reason) {
    return reason || "cancel";
}

function cancelActiveModal(reason) {
    var topFrame = getTopModalFrame();
    if (!topFrame) {
        return;
    }
    cancelFrame(topFrame, normalizeCloseReason(reason));
}

function closeFramesForReplace() {
    while (modalStack.length) {
        cancelFrame(getTopModalFrame(), "replace");
    }
}

function initModal() {
    if (modalInitialized || !getModalHost() || !getModalTemplate()) {
        return;
    }
    modalInitialized = true;
}

export function onReady(callback) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", callback, { once: true });
        return;
    }
    callback();
}

export function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function getCsrfToken() {
    var input = document.querySelector("input[name='csrfmiddlewaretoken']");
    if (input) {
        return input.value;
    }
    var match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
}

export function copyTextToClipboard(value) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        return navigator.clipboard.writeText(value);
    }
    return new Promise(function (resolve, reject) {
        var textarea = document.createElement("textarea");
        var succeeded = false;
        textarea.value = value;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            succeeded = document.execCommand("copy");
        } catch (_error) {
            succeeded = false;
        }
        document.body.removeChild(textarea);
        if (succeeded) {
            resolve();
            return;
        }
        reject(new Error("Copy command failed."));
    });
}

export function getTopModal() {
    var topFrame = getTopModalFrame();
    return topFrame ? topFrame.api : null;
}

export function getTopModalRoot() {
    var topFrame = getTopModalFrame();
    return topFrame ? topFrame.root : null;
}

export function closeModal(handle) {
    var frame = findModalFrameByHandle(handle);
    if (!frame) {
        return;
    }
    closeFrame(frame);
}

export function openModal(options) {
    var host = null;
    var frame = null;
    var mode = options && options.mode ? options.mode : "push";
    initModal();
    host = getModalHost();
    if (!host) {
        return null;
    }
    if (mode === "replace") {
        closeFramesForReplace();
    }
    frame = createModalFrame(options || {});
    if (!frame) {
        return null;
    }
    host.appendChild(frame.root);
    modalStack.push(frame);
    updateModalLayerState();
    focusFrame(frame);
    return frame.api;
}

function getAlertSeverity(alertNode) {
    if (!alertNode) {
        return "default";
    }
    if (alertNode.classList.contains("form-alert-danger") || alertNode.classList.contains("form-alert-error")) {
        return "error";
    }
    if (alertNode.classList.contains("form-alert-warning")) {
        return "warning";
    }
    if (alertNode.classList.contains("form-alert-success")) {
        return "success";
    }
    return "default";
}

function getAlertDuration(alertNode) {
    var severity = getAlertSeverity(alertNode);
    if (severity === "success") {
        return 2600;
    }
    if (severity === "warning") {
        return 5600;
    }
    if (severity === "error") {
        return 7600;
    }
    return 4600;
}

function dismissToast(alertNode) {
    if (!alertNode || alertNode.classList.contains("is-hiding")) {
        return;
    }
    alertNode.classList.add("is-hiding");
    window.setTimeout(function () {
        if (alertNode.parentNode) {
            alertNode.parentNode.removeChild(alertNode);
        }
    }, 240);
}

function decorateToast(alertNode) {
    var messageHtml = alertNode.innerHTML;
    var messageNode = document.createElement("div");
    var closeButton = document.createElement("button");
    messageNode.className = "form-alert-message";
    messageNode.innerHTML = messageHtml;
    closeButton.type = "button";
    closeButton.className = "form-alert-close";
    closeButton.setAttribute("aria-label", "Close notification");
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", function () {
        dismissToast(alertNode);
    });
    alertNode.innerHTML = "";
    alertNode.appendChild(messageNode);
    alertNode.appendChild(closeButton);
}

export function showInlineFlash(message, isSuccess) {
    var notice = null;
    if (!flashStack || !message) {
        return;
    }
    notice = document.createElement("div");
    notice.className = "form-alert" + (isSuccess ? " form-alert-success" : "");
    notice.setAttribute("role", "alert");
    notice.textContent = message;
    flashStack.appendChild(notice);
    decorateToast(notice);
    window.setTimeout(function () {
        dismissToast(notice);
    }, getAlertDuration(notice));
}

function initializeToastAlerts() {
    if (!flashStack) {
        return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(".form-alert"), function (alertNode) {
        if (alertNode.closest(".app-modal") || alertNode.closest("[data-flash-stack]") === flashStack) {
            return;
        }
        flashStack.appendChild(alertNode);
    });
    Array.prototype.forEach.call(flashStack.querySelectorAll(".form-alert"), function (alertNode) {
        if (!alertNode.hasAttribute("data-toast-ready")) {
            alertNode.setAttribute("data-toast-ready", "true");
            decorateToast(alertNode);
        }
        window.setTimeout(function () {
            dismissToast(alertNode);
        }, getAlertDuration(alertNode));
    });
}

function getFormFieldValue(field) {
    if (!field) {
        return "";
    }
    if (field.type === "checkbox" || field.type === "radio") {
        return field.checked ? "1" : "0";
    }
    if (field.tagName === "SELECT" && field.multiple) {
        return Array.prototype.map.call(field.options, function (option) {
            return option.selected ? option.value : "";
        }).join("|");
    }
    if (field.type === "file") {
        return field.files && field.files.length ? Array.prototype.map.call(field.files, function (file) {
            return [file.name, file.size, file.type].join(":");
        }).join("|") : "";
    }
    return field.value || "";
}

function captureFormState(form) {
    var state = {};
    if (!form) {
        return state;
    }
    Array.prototype.forEach.call(form.elements || [], function (field, index) {
        var key = field.name || field.id || (field.tagName + ":" + String(index));
        state[key] = getFormFieldValue(field);
    });
    return state;
}

function serializeFormState(state) {
    return JSON.stringify(state || {});
}

export function markGuardClean(form) {
    var guard = null;
    unsavedGuards.some(function (candidate) {
        if (candidate.form === form) {
            guard = candidate;
            return true;
        }
        return false;
    });
    if (!guard) {
        return;
    }
    guard.initialState = serializeFormState(captureFormState(form));
    guard.isDirty = false;
}

function refreshUnsavedGuardState(form) {
    var guard = null;
    unsavedGuards.some(function (candidate) {
        if (candidate.form === form) {
            guard = candidate;
            return true;
        }
        return false;
    });
    if (!guard) {
        return false;
    }
    guard.isDirty = guard.initialState !== serializeFormState(captureFormState(form));
    return guard.isDirty;
}

function hasUnsavedChanges() {
    return unsavedGuards.some(function (guard) {
        return refreshUnsavedGuardState(guard.form);
    });
}

function openUnsavedChangesConfirmation(onConfirm) {
    var defaults = getModalDefaults();
    openModal({
        tone: "attention",
        kicker: defaults.unsavedDefaultKicker,
        title: defaults.unsavedDefaultTitle,
        message: defaults.unsavedDefaultMessage,
        cancelText: defaults.unsavedDefaultCancel,
        confirmText: defaults.unsavedDefaultConfirm,
        onConfirm: function () {
            bypassUnsavedGuard = true;
            if (typeof onConfirm === "function") {
                onConfirm();
            }
        },
        onCancel: function () {
            pendingUnsavedNavigation = null;
        }
    });
}

function attemptUnsavedNavigation(onConfirm) {
    pendingUnsavedNavigation = onConfirm;
    openUnsavedChangesConfirmation(function () {
        var callback = pendingUnsavedNavigation;
        pendingUnsavedNavigation = null;
        if (typeof callback === "function") {
            callback();
        }
        window.setTimeout(function () {
            bypassUnsavedGuard = false;
        }, 0);
    });
}

function initializeUnsavedChangesGuards() {
    var forms = document.querySelectorAll("form[data-unsaved-guard]");
    Array.prototype.forEach.call(forms, function (form) {
        unsavedGuards.push({
            form: form,
            initialState: serializeFormState(captureFormState(form)),
            isDirty: false
        });
        form.addEventListener("input", function () {
            refreshUnsavedGuardState(form);
        });
        form.addEventListener("change", function () {
            refreshUnsavedGuardState(form);
        });
        form.addEventListener("submit", function (event) {
            bypassUnsavedGuard = true;
            window.setTimeout(function () {
                if (event.defaultPrevented) {
                    bypassUnsavedGuard = false;
                    return;
                }
                markGuardClean(form);
            }, 0);
        });
    });
    document.addEventListener("click", function (event) {
        var link = event.target.closest("a[href]");
        var href = "";
        var isModifiedClick = false;
        if (!link || bypassUnsavedGuard || !hasUnsavedChanges()) {
            return;
        }
        href = link.getAttribute("href") || "";
        isModifiedClick = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
        if (!href || href.charAt(0) === "#" || link.hasAttribute("download") || link.target === "_blank" || isModifiedClick) {
            return;
        }
        if (link.origin !== window.location.origin || href.indexOf("javascript:") === 0) {
            return;
        }
        event.preventDefault();
        attemptUnsavedNavigation(function () {
            window.location.assign(link.href);
        });
    });
    window.addEventListener("beforeunload", function (event) {
        if (bypassUnsavedGuard || !hasUnsavedChanges()) {
            return;
        }
        event.preventDefault();
        event.returnValue = "";
    });
}

function isDeleteSemanticButton(button) {
    var formAction = button && button.getAttribute("formaction") ? button.getAttribute("formaction") : "";
    var buttonText = button ? normalizeText(button.textContent) : "";
    var className = button && typeof button.className === "string" ? button.className.toLowerCase() : "";
    if (button && (
        button.hasAttribute("data-site-setting-remove-toggle") ||
        button.hasAttribute("data-site-setting-undo") ||
        button.hasAttribute("data-post-cover-remove") ||
        button.hasAttribute("data-book-cover-remove") ||
        button.hasAttribute("data-profile-avatar-remove") ||
        button.hasAttribute("data-profile-avatar-undo") ||
        button.hasAttribute("data-manage-user-avatar-remove") ||
        button.hasAttribute("data-manage-user-avatar-undo")
    )) {
        return false;
    }
    return Boolean(button && (
        button.hasAttribute("data-delete-confirm-trigger") ||
        /delete\//i.test(formAction) ||
        /\b(delete|remove)\b/.test(buttonText) ||
        /删除/.test(buttonText) ||
        className.indexOf("danger") !== -1 ||
        className.indexOf("destructive") !== -1
    ));
}

function isDeleteSemanticForm(form) {
    var action = form && form.getAttribute("action") ? form.getAttribute("action") : "";
    return Boolean(form && (form.hasAttribute("data-delete-confirm-form") || /delete\//i.test(action)));
}

function getDeleteConfirmationText(button, form) {
    var defaults = getModalDefaults();
    var source = button || form;
    var title = source ? source.getAttribute("data-delete-confirm-title") || "" : "";
    var message = source ? source.getAttribute("data-delete-confirm-message") || "" : "";
    var confirmText = source ? source.getAttribute("data-delete-confirm-button") || "" : "";
    var cancelText = source ? source.getAttribute("data-delete-cancel-button") || "" : "";
    var buttonText = button ? normalizeText(button.textContent) : "";
    if (!title) {
        title = /remove/.test(buttonText) ? defaults.removeDefaultTitle : defaults.deleteDefaultTitle;
    }
    if (!message) {
        message = defaults.deleteDefaultMessage;
    }
    if (!confirmText) {
        confirmText = /remove/.test(buttonText) ? defaults.removeDefaultConfirm : defaults.deleteDefaultConfirm;
    }
    if (!cancelText) {
        cancelText = defaults.deleteDefaultCancel;
    }
    return {
        title: title,
        message: message,
        confirmText: confirmText,
        cancelText: cancelText
    };
}

function submitDeleteAction(button, form) {
    if (!form) {
        return;
    }
    form.setAttribute("data-delete-confirm-approved", "true");
    if (typeof form.requestSubmit === "function") {
        if (button) {
            form.requestSubmit(button);
        } else {
            form.requestSubmit();
        }
        return;
    }
    form.submit();
}

function openDeleteConfirmation(button, form) {
    var confirmationText = getDeleteConfirmationText(button, form);
    openModal({
        tone: "error",
        kicker: confirmationText.title,
        title: confirmationText.title,
        message: confirmationText.message,
        cancelText: confirmationText.cancelText,
        confirmText: confirmationText.confirmText,
        onConfirm: function () {
            submitDeleteAction(button, form);
        }
    });
}

function initializeDeleteConfirmations() {
    document.addEventListener("click", function (event) {
        var submitTrigger = event.target.closest("button, input[type='submit']");
        var triggerForm = null;
        if (!isDeleteSemanticButton(submitTrigger)) {
            return;
        }
        triggerForm = submitTrigger.form || submitTrigger.closest("form");
        if (!triggerForm) {
            return;
        }
        event.preventDefault();
        openDeleteConfirmation(submitTrigger, triggerForm);
    });
    document.addEventListener("submit", function (event) {
        var deleteForm = event.target;
        if (!isDeleteSemanticForm(deleteForm)) {
            return;
        }
        if (deleteForm.hasAttribute("data-delete-confirm-approved")) {
            deleteForm.removeAttribute("data-delete-confirm-approved");
            return;
        }
        event.preventDefault();
        openDeleteConfirmation(null, deleteForm);
    });
}

function closeUserMenu() {
    if (!userMenuDropdown || !userMenuTrigger) {
        return;
    }
    userMenuDropdown.hidden = true;
    userMenuTrigger.setAttribute("aria-expanded", "false");
}

function getMultiComboboxLabel(combobox, checkedCount) {
    var emptyLabel = combobox.getAttribute("data-empty-label") || "";
    var singularLabel = combobox.getAttribute("data-selected-singular") || "";
    var pluralLabel = combobox.getAttribute("data-selected-plural") || "";
    if (checkedCount < 1) {
        return emptyLabel;
    }
    if (checkedCount === 1) {
        return singularLabel.replace("%(count)s", checkedCount);
    }
    return pluralLabel.replace("%(count)s", checkedCount);
}

function closeMultiCombobox(combobox) {
    var trigger = combobox ? combobox.querySelector("[data-multi-combobox-trigger]") : null;
    var panel = combobox ? combobox.querySelector("[data-multi-combobox-panel]") : null;
    if (!trigger || !panel) {
        return;
    }
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    combobox.classList.remove("is-open");
}

function updateMultiComboboxLabel(combobox) {
    var label = combobox.querySelector("[data-multi-combobox-label]");
    var options = combobox.querySelectorAll("[data-multi-combobox-option]");
    var checkedCount = 0;
    Array.prototype.forEach.call(options, function (option) {
        if (option.checked) {
            checkedCount += 1;
        }
    });
    if (label) {
        label.textContent = getMultiComboboxLabel(combobox, checkedCount);
    }
}

function initializeMultiComboboxes() {
    Array.prototype.forEach.call(multiComboboxes, function (combobox) {
        var trigger = combobox.querySelector("[data-multi-combobox-trigger]");
        var panel = combobox.querySelector("[data-multi-combobox-panel]");
        var options = combobox.querySelectorAll("[data-multi-combobox-option]");
        if (!trigger || !panel) {
            return;
        }
        updateMultiComboboxLabel(combobox);
        trigger.addEventListener("click", function () {
            var shouldOpen = panel.hidden;
            Array.prototype.forEach.call(multiComboboxes, function (otherCombobox) {
                if (otherCombobox !== combobox) {
                    closeMultiCombobox(otherCombobox);
                }
            });
            panel.hidden = !shouldOpen;
            trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
            combobox.classList.toggle("is-open", shouldOpen);
        });
        Array.prototype.forEach.call(options, function (option) {
            option.addEventListener("change", function () {
                updateMultiComboboxLabel(combobox);
            });
        });
    });
}

export function focusHashTarget() {
    var hash = window.location.hash || "";
    var target = null;
    if (!hash || hash === "#") {
        return;
    }
    try {
        target = document.querySelector(hash);
    } catch (_error) {
        return;
    }
    if (!target || typeof target.focus !== "function") {
        return;
    }
    window.requestAnimationFrame(function () {
        target.focus();
    });
}

function initializeGlobalUi() {
    if (userMenu && userMenuTrigger && userMenuDropdown) {
        userMenuTrigger.addEventListener("click", function () {
            var shouldOpen = userMenuDropdown.hidden;
            userMenuDropdown.hidden = !shouldOpen;
            userMenuTrigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        });
    }
    if (globalSearchForm && globalSearchInput) {
        globalSearchForm.addEventListener("submit", function (event) {
            if (!globalSearchInput.value.trim()) {
                event.preventDefault();
            }
        });
    }
    if (multiComboboxes.length) {
        initializeMultiComboboxes();
    }
}

function ensureActionMenu() {
    if (actionMenu) {
        return actionMenu;
    }
    actionMenu = document.createElement("div");
    actionMenu.className = "editor-table-context-menu";
    actionMenu.hidden = true;
    document.body.appendChild(actionMenu);
    return actionMenu;
}

function positionMenu(menu, event) {
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var spacing = 12;
    var left = event.clientX;
    var top = event.clientY;
    var menuWidth = menu.offsetWidth;
    var menuHeight = menu.offsetHeight;
    if (left + menuWidth + spacing > viewportWidth) {
        left = Math.max(spacing, viewportWidth - menuWidth - spacing);
    }
    if (top + menuHeight + spacing > viewportHeight) {
        top = Math.max(spacing, viewportHeight - menuHeight - spacing);
    }
    menu.style.left = left + "px";
    menu.style.top = top + "px";
}

export function closeActionMenu() {
    if (!actionMenu) {
        return;
    }
    actionMenu.hidden = true;
    actionMenu.innerHTML = "";
}

export function openActionMenu(event, actions) {
    var menu = ensureActionMenu();
    if (!menu || !actions || !actions.length) {
        return;
    }
    menu.innerHTML = "";
    actions.forEach(function (action) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "editor-table-context-menu-item" + (action.isDanger ? " is-danger" : "");
        item.textContent = action.label || "";
        item.disabled = Boolean(action.disabled);
        item.addEventListener("click", function () {
            if (item.disabled) {
                return;
            }
            if (typeof action.onClick === "function") {
                action.onClick();
            }
            closeActionMenu();
        });
        menu.appendChild(item);
    });
    menu.hidden = false;
    positionMenu(menu, event);
}

export function initBaseApp() {
    if (baseInitialized) {
        return;
    }
    baseInitialized = true;
    flashStack = document.querySelector("[data-flash-stack]");
    userMenu = document.querySelector("[data-user-menu]");
    userMenuTrigger = document.querySelector("[data-user-menu-trigger]");
    userMenuDropdown = document.querySelector("[data-user-menu-dropdown]");
    globalSearchForm = document.querySelector("[data-global-search-form]");
    globalSearchInput = document.querySelector("#id_global_search");
    multiComboboxes = document.querySelectorAll("[data-multi-combobox]");
    initModal();
    initializeToastAlerts();
    initializeUnsavedChangesGuards();
    initializeDeleteConfirmations();
    initializeGlobalUi();
    focusHashTarget();
    window.addEventListener("hashchange", focusHashTarget);
    document.addEventListener("click", function (event) {
        if (actionMenu && !actionMenu.hidden && !actionMenu.contains(event.target)) {
            closeActionMenu();
        }
        if (userMenu && !userMenu.contains(event.target)) {
            closeUserMenu();
        }
        Array.prototype.forEach.call(multiComboboxes, function (combobox) {
            if (!combobox.contains(event.target)) {
                closeMultiCombobox(combobox);
            }
        });
    });
    document.addEventListener("keydown", function (event) {
        var topFrame = getTopModalFrame();
        if (event.key === "Escape") {
            if (topFrame && topFrame.closeOnEsc) {
                event.preventDefault();
                cancelActiveModal("escape");
            }
            closeActionMenu();
            closeUserMenu();
            Array.prototype.forEach.call(multiComboboxes, function (combobox) {
                closeMultiCombobox(combobox);
            });
            return;
        }
        if (
            event.key === "Enter" &&
            isModalOpen() &&
            !event.defaultPrevented &&
            !event.isComposing &&
            !shouldIgnoreModalEnter(event)
        ) {
            event.preventDefault();
            confirmActiveModal();
        }
    });
    document.addEventListener("click", function (event) {
        var topFrame = getTopModalFrame();
        var closeTrigger = null;
        if (!topFrame || !topFrame.root || !topFrame.root.contains(event.target)) {
            return;
        }
        closeTrigger = event.target.closest("[data-app-modal-close]");
        if (!closeTrigger) {
            return;
        }
        if (closeTrigger.getAttribute("data-app-modal-close") === "backdrop" && !topFrame.closeOnBackdrop) {
            return;
        }
        event.preventDefault();
        cancelActiveModal(closeTrigger.getAttribute("data-app-modal-close") || "cancel");
    });
    window.addEventListener("resize", closeActionMenu);
    window.addEventListener("scroll", function () {
        closeActionMenu();
    }, true);
}
