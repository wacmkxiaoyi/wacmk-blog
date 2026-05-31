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

var modalState = {
    restoreFocus: null,
    onConfirm: null,
    onCancel: null,
    keepOpenOnConfirm: false,
    isConfirmPending: false
};

function getModalElements() {
    var appModal = document.querySelector("[data-app-modal]");
    return {
        appModal: appModal,
        appModalDialog: document.querySelector("[data-app-modal-dialog]"),
        appModalKicker: document.querySelector("[data-app-modal-kicker]"),
        appModalTitle: document.querySelector("[data-app-modal-title]"),
        appModalMessage: document.querySelector("[data-app-modal-message]"),
        appModalCancelSlot: document.querySelector("[data-app-modal-cancel-slot]"),
        appModalConfirmSlot: document.querySelector("[data-app-modal-confirm-slot]"),
        appModalCloseButtons: document.querySelectorAll("[data-app-modal-close]")
    };
}

function getModalDefaults() {
    var appModal = getModalElements().appModal;
    return {
        toneClasses: ["is-attention", "is-warning", "is-error"],
        variantClasses: ["is-table-dialog", "is-wide-dialog"],
        deleteDefaultTitle: appModal ? appModal.getAttribute("data-delete-default-title") || "Delete item" : "Delete item",
        removeDefaultTitle: appModal ? appModal.getAttribute("data-remove-default-title") || "Remove item" : "Remove item",
        deleteDefaultMessage: appModal ? appModal.getAttribute("data-delete-default-message") || "Are you sure you want to continue? This action cannot be undone." : "Are you sure you want to continue? This action cannot be undone.",
        deleteDefaultConfirm: appModal ? appModal.getAttribute("data-delete-default-confirm") || "Delete" : "Delete",
        removeDefaultConfirm: appModal ? appModal.getAttribute("data-remove-default-confirm") || "Remove" : "Remove",
        deleteDefaultCancel: appModal ? appModal.getAttribute("data-delete-default-cancel") || "Cancel" : "Cancel",
        unsavedDefaultKicker: appModal ? appModal.getAttribute("data-unsaved-default-kicker") || "Unsaved changes" : "Unsaved changes",
        unsavedDefaultTitle: appModal ? appModal.getAttribute("data-unsaved-default-title") || "Discard unsaved changes?" : "Discard unsaved changes?",
        unsavedDefaultMessage: appModal ? appModal.getAttribute("data-unsaved-default-message") || "Your changes have not been saved yet. If you leave this page now, those changes will be lost." : "Your changes have not been saved yet. If you leave this page now, those changes will be lost.",
        unsavedDefaultConfirm: appModal ? appModal.getAttribute("data-unsaved-default-confirm") || "Leave page" : "Leave page",
        unsavedDefaultCancel: appModal ? appModal.getAttribute("data-unsaved-default-cancel") || "Keep editing" : "Keep editing"
    };
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
    return input ? input.value : "";
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

function createModalButton(className, label, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

function isModalOpen() {
    var elements = getModalElements();
    return Boolean(elements.appModal && !elements.appModal.hidden);
}

function cancelActiveModal() {
    if (!isModalOpen()) {
        return;
    }

    if (modalState.onCancel) {
        modalState.onCancel();
    }
    closeModal();
}

function findPrimaryModalAction() {
    var elements = getModalElements();
    var confirmButton = null;

    if (elements.appModalConfirmSlot) {
        confirmButton = elements.appModalConfirmSlot.querySelector("button:not([disabled])");
    }
    if (confirmButton) {
        return confirmButton;
    }
    if (elements.appModalCancelSlot) {
        return elements.appModalCancelSlot.querySelector("button:not([disabled])");
    }
    return null;
}

function confirmActiveModal() {
    var actionButton = null;

    if (!isModalOpen()) {
        return;
    }

    actionButton = findPrimaryModalAction();
    if (actionButton) {
        actionButton.click();
    }
}

function shouldIgnoreModalEnter(event) {
    var target = event.target;
    var tagName = "";

    if (!target || !(target instanceof HTMLElement)) {
        return false;
    }

    if (target.closest("[data-app-modal-confirm-slot] button, [data-app-modal-cancel-slot] button")) {
        return true;
    }

    tagName = target.tagName;
    return tagName === "TEXTAREA" || target.isContentEditable;
}

export function closeModal() {
    var elements = getModalElements();
    var defaults = getModalDefaults();

    if (!elements.appModal) {
        return;
    }

    elements.appModal.hidden = true;
    defaults.toneClasses.forEach(function (className) {
        elements.appModal.classList.remove(className);
    });
    if (elements.appModalDialog) {
        defaults.variantClasses.forEach(function (className) {
            elements.appModalDialog.classList.remove(className);
        });
    }
    document.body.classList.remove("modal-open");
    if (elements.appModalKicker) {
        elements.appModalKicker.textContent = "";
    }
    if (elements.appModalTitle) {
        elements.appModalTitle.textContent = "";
    }
    if (elements.appModalMessage) {
        elements.appModalMessage.textContent = "";
    }
    if (elements.appModalCancelSlot) {
        elements.appModalCancelSlot.innerHTML = "";
    }
    if (elements.appModalConfirmSlot) {
        elements.appModalConfirmSlot.innerHTML = "";
    }

    if (modalState.restoreFocus && typeof modalState.restoreFocus.focus === "function") {
        modalState.restoreFocus.focus();
    }

    modalState.restoreFocus = null;
    modalState.onConfirm = null;
    modalState.onCancel = null;
    modalState.keepOpenOnConfirm = false;
    modalState.isConfirmPending = false;
}

export function openModal(options) {
    var elements = getModalElements();
    var defaults = getModalDefaults();
    var tone = "notice";

    initModal();
    if (!elements.appModal || !elements.appModalDialog) {
        return;
    }

    if (isModalOpen()) {
        cancelActiveModal();
    } else {
        closeModal();
    }
    tone = options && options.tone ? options.tone : "notice";
    modalState.restoreFocus = document.activeElement;
    modalState.onConfirm = options && options.onConfirm ? options.onConfirm : null;
    modalState.onCancel = options && options.onCancel ? options.onCancel : null;
    modalState.keepOpenOnConfirm = Boolean(options && options.keepOpenOnConfirm);
    modalState.isConfirmPending = false;

    elements.appModal.hidden = false;
    document.body.classList.add("modal-open");
    defaults.toneClasses.forEach(function (className) {
        elements.appModal.classList.remove(className);
    });
    defaults.variantClasses.forEach(function (className) {
        elements.appModalDialog.classList.remove(className);
    });

    if (tone === "attention") {
        elements.appModal.classList.add("is-attention");
    } else if (tone === "warning") {
        elements.appModal.classList.add("is-warning");
    } else if (tone === "error") {
        elements.appModal.classList.add("is-error");
    }
    if (options && options.dialogClass && defaults.variantClasses.indexOf(options.dialogClass) !== -1) {
        elements.appModalDialog.classList.add(options.dialogClass);
    }

    if (elements.appModalKicker) {
        elements.appModalKicker.textContent = options && options.kicker ? options.kicker : "";
    }
    if (elements.appModalTitle) {
        elements.appModalTitle.textContent = options && options.title ? options.title : "";
    }
    if (elements.appModalMessage) {
        elements.appModalMessage.textContent = options && options.message ? options.message : "";
        if (options && options.contentNode) {
            elements.appModalMessage.textContent = "";
            elements.appModalMessage.appendChild(options.contentNode);
        }
    }

    if (options && options.cancelText && elements.appModalCancelSlot) {
        elements.appModalCancelSlot.appendChild(
            createModalButton("app-modal-secondary-button", options.cancelText, function () {
                if (modalState.onCancel) {
                    modalState.onCancel();
                }
                closeModal();
            })
        );
    }

    if (options && options.confirmText && elements.appModalConfirmSlot) {
        elements.appModalConfirmSlot.appendChild(
            createModalButton("primary-button", options.confirmText, function () {
                var confirmResult = null;

                if (modalState.isConfirmPending) {
                    return;
                }

                if (modalState.onConfirm) {
                    confirmResult = modalState.onConfirm();
                }

                if (confirmResult && typeof confirmResult.then === "function") {
                    modalState.isConfirmPending = true;
                    confirmResult.finally(function () {
                        modalState.isConfirmPending = false;
                    });
                }

                if (!modalState.keepOpenOnConfirm) {
                    closeModal();
                }
            })
        );
    }

    if (options && options.extraActions && options.extraActions.length && elements.appModalConfirmSlot) {
        options.extraActions.forEach(function (action) {
            if (!action || !action.label) {
                return;
            }

            elements.appModalConfirmSlot.appendChild(
                createModalButton(action.className || "secondary-button", action.label, function () {
                    var actionResult = null;
                    if (typeof action.onClick === "function") {
                        actionResult = action.onClick();
                    }
                    if (!(actionResult && typeof actionResult.then === "function") && action.keepOpen !== true) {
                        closeModal();
                    }
                })
            );
        });
    }

    window.requestAnimationFrame(function () {
        var confirmButton = elements.appModalConfirmSlot ? elements.appModalConfirmSlot.querySelector("button") : null;
        var cancelButton = elements.appModalCancelSlot ? elements.appModalCancelSlot.querySelector("button") : null;
        (confirmButton || cancelButton || elements.appModalDialog).focus();
    });
}

function initModal() {
    var elements = getModalElements();

    if (modalInitialized || !elements.appModal) {
        return;
    }

    modalInitialized = true;
    Array.prototype.forEach.call(elements.appModalCloseButtons || [], function (button) {
        button.addEventListener("click", function () {
            cancelActiveModal();
        });
    });
    elements.appModal.addEventListener("click", function (event) {
        if (!isModalOpen() || !elements.appModalDialog) {
            return;
        }
        if (elements.appModalDialog.contains(event.target)) {
            return;
        }
        cancelActiveModal();
    });
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
        if (event.key === "Escape") {
            cancelActiveModal();
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
    window.addEventListener("resize", closeActionMenu);
    window.addEventListener("scroll", function () {
        closeActionMenu();
    }, true);
}
