document.addEventListener("DOMContentLoaded", function () {
    var toggleButtons = document.querySelectorAll("[data-password-toggle]");
    var sendCodeButton = document.querySelector("[data-send-code]");
    var forgotPasswordButton = document.querySelector("[data-forgot-password]");
    var csrfInput = document.querySelector("input[name='csrfmiddlewaretoken']");
    var appModal = document.querySelector("[data-app-modal]");
    var appModalDialog = document.querySelector("[data-app-modal-dialog]");
    var appModalKicker = document.querySelector("[data-app-modal-kicker]");
    var appModalTitle = document.querySelector("[data-app-modal-title]");
    var appModalMessage = document.querySelector("[data-app-modal-message]");
    var appModalCancelSlot = document.querySelector("[data-app-modal-cancel-slot]");
    var appModalConfirmSlot = document.querySelector("[data-app-modal-confirm-slot]");
    var appModalCloseButtons = document.querySelectorAll("[data-app-modal-close]");
    var userMenu = document.querySelector("[data-user-menu]");
    var userMenuTrigger = document.querySelector("[data-user-menu-trigger]");
    var userMenuDropdown = document.querySelector("[data-user-menu-dropdown]");
    var flashStack = document.querySelector("[data-flash-stack]");
    var globalSearchForm = document.querySelector("[data-global-search-form]");
    var globalSearchInput = document.querySelector("#id_global_search");
    var multiComboboxes = document.querySelectorAll("[data-multi-combobox]");
    var markdownEditorNodes = document.querySelectorAll("[data-markdown-editor='true']");
    var postEditorForm = document.querySelector("[data-post-editor-form]");
    var bookEditorForm = document.querySelector("[data-book-editor-form]");
    var markdownImageInput = null;
    var activeImageEditor = null;
    var tablePicker = null;
    var activeTableEditor = null;
    var colorPicker = null;
    var activeColorEditor = null;
    var emojiPicker = null;
    var activeEmojiEditor = null;
    var activeReferenceEditor = null;
    var toolbarHoverMenu = null;
    var toolbarHoverMenuTimer = 0;
    var tableContextMenu = null;
    var tableContextMenuState = null;
    var editorContextToolbar = null;
    var activeContextToolbarEditor = null;
    var editorContextSelectionState = null;
    var postMarkdownEditor = null;
    var markdownEditors = [];
    var markdownPreviewCounter = 0;
    var markdownPreviewRequestId = 0;
    var postLinkPreviewTooltip = null;
    var postLinkPreviewBody = null;
    var postLinkPreviewActiveLink = null;
    var postLinkPreviewHoverTimer = 0;
    var postLinkPreviewHideTimer = 0;
    var postLinkPreviewRequestPath = "";
    var postLinkPreviewCache = {};
    var markdownTextColors = [
        { className: "md-color-berry", label: "Berry", color: "#d9487d" },
        { className: "md-color-rose", label: "Rose", color: "#f25f7a" },
        { className: "md-color-orange", label: "Orange", color: "#ef8f32" },
        { className: "md-color-gold", label: "Gold", color: "#c79512" },
        { className: "md-color-green", label: "Green", color: "#1f9d68" },
        { className: "md-color-cyan", label: "Cyan", color: "#1493a5" },
        { className: "md-color-blue", label: "Blue", color: "#3c72f6" },
        { className: "md-color-purple", label: "Purple", color: "#7a56f4" }
    ];
    var markdownEmojis = ["😀", "😁", "😂", "😉", "😍", "🤔", "😎", "🥳", "👏", "🙌", "🔥", "✨", "🎉", "💡", "✅", "❗", "❤️", "👍", "👀", "🙏"];
    var modalState = {
        restoreFocus: null,
        onConfirm: null,
        onCancel: null,
        keepOpenOnConfirm: false,
        isConfirmPending: false,
    };
    var modalToneClasses = ["is-attention", "is-warning", "is-error"];
    var modalVariantClasses = ["is-table-dialog", "is-wide-dialog"];
    var deleteDefaultTitle = appModal ? appModal.getAttribute("data-delete-default-title") || "Delete item" : "Delete item";
    var removeDefaultTitle = appModal ? appModal.getAttribute("data-remove-default-title") || "Remove item" : "Remove item";
    var deleteDefaultMessage = appModal ? appModal.getAttribute("data-delete-default-message") || "Are you sure you want to continue? This action cannot be undone." : "Are you sure you want to continue? This action cannot be undone.";
    var deleteDefaultConfirm = appModal ? appModal.getAttribute("data-delete-default-confirm") || "Delete" : "Delete";
    var removeDefaultConfirm = appModal ? appModal.getAttribute("data-remove-default-confirm") || "Remove" : "Remove";
    var deleteDefaultCancel = appModal ? appModal.getAttribute("data-delete-default-cancel") || "Cancel" : "Cancel";
    var unsavedDefaultKicker = appModal ? appModal.getAttribute("data-unsaved-default-kicker") || "Unsaved changes" : "Unsaved changes";
    var unsavedDefaultTitle = appModal ? appModal.getAttribute("data-unsaved-default-title") || "Discard unsaved changes?" : "Discard unsaved changes?";
    var unsavedDefaultMessage = appModal ? appModal.getAttribute("data-unsaved-default-message") || "Your changes have not been saved yet. If you leave this page now, those changes will be lost." : "Your changes have not been saved yet. If you leave this page now, those changes will be lost.";
    var unsavedDefaultConfirm = appModal ? appModal.getAttribute("data-unsaved-default-confirm") || "Leave page" : "Leave page";
    var unsavedDefaultCancel = appModal ? appModal.getAttribute("data-unsaved-default-cancel") || "Keep editing" : "Keep editing";
    var unsavedGuards = [];
    var bypassUnsavedGuard = false;
    var pendingUnsavedNavigation = null;

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

    function markGuardClean(form) {
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
        openModal({
            tone: "attention",
            kicker: unsavedDefaultKicker,
            title: unsavedDefaultTitle,
            message: unsavedDefaultMessage,
            cancelText: unsavedDefaultCancel,
            confirmText: unsavedDefaultConfirm,
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

        if (!forms.length) {
            return;
        }

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

    function initializePostEditorAutosave() {
        var enabled = false;
        var intervalMs = 300000;

        if (!postEditorForm) {
            return;
        }

        enabled = (postEditorForm.getAttribute("data-autosave-enabled") || "false") === "true";
        intervalMs = parseInt(postEditorForm.getAttribute("data-autosave-interval-ms") || "300000", 10);

        if (!enabled || !intervalMs || intervalMs < 1000) {
            return;
        }

        window.setInterval(function () {
            storePostEditorDraft();
        }, intervalMs);
    }

    function closeModal() {
        if (!appModal) {
            return;
        }

        appModal.hidden = true;
        appModal.classList.remove("is-attention", "is-warning", "is-error");
        if (appModalDialog) {
            modalVariantClasses.forEach(function (className) {
                appModalDialog.classList.remove(className);
            });
        }
        document.body.classList.remove("modal-open");
        appModalKicker.textContent = "";
        appModalTitle.textContent = "";
        appModalMessage.textContent = "";
        appModalCancelSlot.innerHTML = "";
        appModalConfirmSlot.innerHTML = "";

        if (modalState.restoreFocus) {
            modalState.restoreFocus.focus();
        }

        modalState.restoreFocus = null;
        modalState.onConfirm = null;
        modalState.onCancel = null;
        modalState.keepOpenOnConfirm = false;
        modalState.isConfirmPending = false;
    }

    function createModalButton(className, label, onClick) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    function closeModalFromAction() {
        closeModal();
    }

    function openModal(options) {
        if (!appModal || !appModalDialog) {
            return;
        }

        closeModal();

        var tone = options.tone || "notice";
        modalState.restoreFocus = document.activeElement;
        modalState.onConfirm = options.onConfirm || null;
        modalState.onCancel = options.onCancel || null;
        modalState.keepOpenOnConfirm = Boolean(options.keepOpenOnConfirm);
        modalState.isConfirmPending = false;

        appModal.hidden = false;
        document.body.classList.add("modal-open");
        modalToneClasses.forEach(function (className) {
            appModal.classList.remove(className);
        });
        modalVariantClasses.forEach(function (className) {
            appModalDialog.classList.remove(className);
        });
        if (tone === "attention") {
            appModal.classList.add("is-attention");
        } else if (tone === "warning") {
            appModal.classList.add("is-warning");
        } else if (tone === "error") {
            appModal.classList.add("is-error");
        }
        if (options.dialogClass && modalVariantClasses.indexOf(options.dialogClass) !== -1) {
            appModalDialog.classList.add(options.dialogClass);
        }

        appModalKicker.textContent = options.kicker || "";
        appModalTitle.textContent = options.title || "";
        appModalMessage.textContent = options.message || "";

        if (options.contentNode) {
            appModalMessage.textContent = "";
            appModalMessage.appendChild(options.contentNode);
        }

        if (options.cancelText) {
            appModalCancelSlot.appendChild(
                createModalButton("app-modal-secondary-button", options.cancelText, function () {
                    if (modalState.onCancel) {
                        modalState.onCancel();
                    }
                    closeModal();
                })
            );
        }

        if (options.confirmText) {
            appModalConfirmSlot.appendChild(
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

        if (options.extraActions && options.extraActions.length) {
            options.extraActions.forEach(function (action) {
                if (!action || !action.label) {
                    return;
                }
                appModalConfirmSlot.appendChild(
                    createModalButton(action.className || "secondary-button", action.label, function () {
                        var actionResult = null;
                        if (typeof action.onClick === "function") {
                            actionResult = action.onClick();
                        }
                        if (!(actionResult && typeof actionResult.then === "function") && action.keepOpen !== true) {
                            closeModalFromAction();
                        }
                    })
                );
            });
        }

        window.requestAnimationFrame(function () {
            var confirmButton = appModalConfirmSlot.querySelector("button");
            var cancelButton = appModalCancelSlot.querySelector("button");
            (confirmButton || cancelButton || appModalDialog).focus();
        });
    }

    function normalizeText(value) {
        return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
    }

    function showInlineFlash(message, isSuccess) {
        if (!flashStack || !message) {
            return;
        }

        var notice = document.createElement("div");
        notice.className = "form-alert" + (isSuccess ? " form-alert-success" : "");
        notice.setAttribute("role", "alert");
        notice.textContent = message;
        flashStack.appendChild(notice);
        window.setTimeout(function () {
            if (notice.parentNode) {
                notice.parentNode.removeChild(notice);
            }
        }, 3200);
    }

    function updateFeedbackWidget(widget, payload) {
        if (!widget || !payload) {
            return;
        }

        var activeValue = payload.active_value || 0;
        var upCount = typeof payload.up_count === "number" ? payload.up_count : 0;
        var downCount = typeof payload.down_count === "number" ? payload.down_count : 0;

        Array.prototype.forEach.call(widget.querySelectorAll("[data-feedback-value]"), function (button) {
            var value = parseInt(button.getAttribute("data-feedback-value"), 10);
            var isActive = value === activeValue;
            button.classList.toggle("is-active", isActive);
            button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        var upNode = widget.querySelector("[data-feedback-count='up']");
        var downNode = widget.querySelector("[data-feedback-count='down']");
        if (upNode) {
            upNode.textContent = String(upCount);
        }
        if (downNode) {
            downNode.textContent = String(downCount);
        }
    }

    function bindFeedbackWidgets() {
        var csrfToken = getCsrfToken();
        Array.prototype.forEach.call(document.querySelectorAll("[data-feedback-widget][data-feedback-endpoint]"), function (widget) {
            Array.prototype.forEach.call(widget.querySelectorAll("[data-feedback-value]"), function (button) {
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

        if (!csrfToken) {
            return;
        }

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

        Array.prototype.forEach.call(document.querySelectorAll("[data-inline-share-trigger]"), function (trigger) {
            var root = trigger.closest(".editor-access-layout");
            var select = root ? root.querySelector("[data-share-expiry-select]") : null;
            var copyButton = root ? root.querySelector("[data-share-inline-copy]") : null;

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

            if (copyButton) {
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

    function getEncryptedPostFallbackUrl() {
        if (document.referrer && document.referrer !== window.location.href) {
            return document.referrer;
        }
        return "/";
    }

    function openEncryptedPostModal(config) {
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
            var confirmButton = appModalConfirmSlot.querySelector("button.primary-button");
            body.append("password", input.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            if (confirmButton) {
                confirmButton.disabled = true;
            }

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
                    errorNode.textContent = result.data.message || "Incorrect password.";
                    if (input) {
                        input.focus();
                        input.select();
                    }
                    return;
                }
                window.location.href = result.data.redirect_url || submitUrl;
            }).catch(function () {
                errorNode.hidden = false;
                errorNode.textContent = "Request failed.";
            }).finally(function () {
                if (confirmButton) {
                    confirmButton.disabled = false;
                }
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
            trigger.addEventListener("click", function (event) {
                event.preventDefault();
                openEncryptedPostModal({
                    url: trigger.getAttribute("data-encrypted-post-url") || "",
                    title: trigger.getAttribute("data-encrypted-post-title") || "",
                    kicker: trigger.getAttribute("data-encrypted-post-kicker") || "",
                    confirmText: trigger.getAttribute("data-encrypted-post-confirm") || "",
                    cancelText: trigger.getAttribute("data-encrypted-post-cancel") || "",
                    isDirect: false,
                    error: ""
                });
            });
        });

        if (pageModalConfig) {
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
            trigger.addEventListener("click", function (event) {
                var openUrl = trigger.getAttribute("data-revision-choice-url-open") || "";
                var resetUrl = trigger.getAttribute("data-revision-choice-url-reset") || "";
                var title = trigger.getAttribute("data-revision-choice-title") || "";
                var messageTemplateId = trigger.getAttribute("data-revision-choice-message-template") || "";
                var openLabel = trigger.getAttribute("data-revision-choice-open-label") || "";
                var resetLabel = trigger.getAttribute("data-revision-choice-reset-label") || "";
                var cancelLabel = trigger.getAttribute("data-revision-choice-cancel-label") || deleteDefaultCancel;
                var content = document.createElement("div");
                var text = document.createElement("p");
                var messageTemplate = messageTemplateId ? document.querySelector("#" + messageTemplateId) : null;
                var message = "";

                if (messageTemplate) {
                    message = (
                        messageTemplate.content ? messageTemplate.content.textContent : messageTemplate.textContent || ""
                    ).trim();
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

        return Boolean(
            button && (
                button.hasAttribute("data-delete-confirm-trigger") ||
                /delete\//i.test(formAction) ||
                /\b(delete|remove)\b/.test(buttonText) ||
                /删除/.test(buttonText) ||
                className.indexOf("danger") !== -1 ||
                className.indexOf("destructive") !== -1
            )
        );
    }

    function isDeleteSemanticForm(form) {
        var action = form && form.getAttribute("action") ? form.getAttribute("action") : "";

        return Boolean(form && (form.hasAttribute("data-delete-confirm-form") || /delete\//i.test(action)));
    }

    function getDeleteConfirmationText(button, form) {
        var source = button || form;
        var title = source ? source.getAttribute("data-delete-confirm-title") || "" : "";
        var message = source ? source.getAttribute("data-delete-confirm-message") || "" : "";
        var confirmText = source ? source.getAttribute("data-delete-confirm-button") || "" : "";
        var cancelText = source ? source.getAttribute("data-delete-cancel-button") || "" : "";
        var buttonText = button ? normalizeText(button.textContent) : "";

        if (!title) {
            if (/remove/.test(buttonText)) {
                title = removeDefaultTitle;
            } else {
                title = deleteDefaultTitle;
            }
        }

        if (!message) {
            message = deleteDefaultMessage;
        }

        if (!confirmText) {
            confirmText = /remove/.test(buttonText) ? removeDefaultConfirm : deleteDefaultConfirm;
        }

        if (!cancelText) {
            cancelText = deleteDefaultCancel;
        }

        return {
            title: title,
            message: message,
            confirmText: confirmText,
            cancelText: cancelText,
        };
    }

    function submitDeleteAction(button, form) {
        if (button && button.hasAttribute("data-cover-delete-button")) {
            storePostEditorDraft();
        }

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
            },
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
        if (!combobox) {
            return;
        }

        var trigger = combobox.querySelector("[data-multi-combobox-trigger]");
        var panel = combobox.querySelector("[data-multi-combobox-panel]");
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

        options.forEach(function (option) {
            if (option.checked) {
                checkedCount += 1;
            }
        });

        if (label) {
            label.textContent = getMultiComboboxLabel(combobox, checkedCount);
        }
    }

    function initializeMultiComboboxes() {
        multiComboboxes.forEach(function (combobox) {
            var trigger = combobox.querySelector("[data-multi-combobox-trigger]");
            var panel = combobox.querySelector("[data-multi-combobox-panel]");
            var options = combobox.querySelectorAll("[data-multi-combobox-option]");

            if (!trigger || !panel) {
                return;
            }

            updateMultiComboboxLabel(combobox);

            trigger.addEventListener("click", function () {
                var shouldOpen = panel.hidden;

                multiComboboxes.forEach(function (otherCombobox) {
                    if (otherCombobox !== combobox) {
                        closeMultiCombobox(otherCombobox);
                    }
                });

                panel.hidden = !shouldOpen;
                trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
                combobox.classList.toggle("is-open", shouldOpen);
            });

            options.forEach(function (option) {
                option.addEventListener("change", function () {
                    updateMultiComboboxLabel(combobox);
                });
            });
        });

        document.addEventListener("click", function (event) {
            multiComboboxes.forEach(function (combobox) {
                if (!combobox.contains(event.target)) {
                    closeMultiCombobox(combobox);
                }
            });
        });

        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape") {
                return;
            }

            multiComboboxes.forEach(function (combobox) {
                closeMultiCombobox(combobox);
            });
        });
    }

    function syncPostEditorVisibilityFields() {
        if (!postEditorForm) {
            return;
        }

        var visibilitySelect = postEditorForm.querySelector("#id_visibility");
        var passwordField = postEditorForm.querySelector("[data-post-password-field]");
        var shareField = postEditorForm.querySelector("[data-post-share-field]");
        var shareMessages = postEditorForm.querySelectorAll("[data-post-share-message]");
        var shareResult = postEditorForm.querySelector("[data-post-share-result]");
        var passwordInput = postEditorForm.querySelector("#id_access_password");
        var coverInput = postEditorForm.querySelector("#id_cover_image");
        var coverPreviewWrapper = postEditorForm.querySelector("[data-post-cover-preview-wrapper]");
        var coverPreviewImage = postEditorForm.querySelector("[data-post-cover-preview-image]");
        var coverUploadRow = postEditorForm.querySelector("[data-post-cover-upload-row]");
        var coverActions = postEditorForm.querySelector("[data-post-cover-actions]");
        var coverRemoveButton = postEditorForm.querySelector("[data-post-cover-remove]");
        var coverUndoButton = postEditorForm.querySelector("[data-post-cover-undo]");
        var coverRemoveFlag = postEditorForm.querySelector("[data-post-cover-remove-flag]");
        var existingCoverSrc = coverPreviewImage ? coverPreviewImage.getAttribute("src") || "" : "";
        var coverObjectUrl = "";

        if (!visibilitySelect || !passwordField) {
            return;
        }

        function applyVisibilityLayout() {
            var isEncrypted = visibilitySelect.value === "encrypted";
            var isPublic = visibilitySelect.value === "public";
            passwordField.hidden = !isEncrypted;
            if (shareField) {
                shareField.hidden = !isPublic;
            }
            Array.prototype.forEach.call(shareMessages || [], function (node) {
                node.hidden = !isPublic;
            });
            if (shareResult) {
                shareResult.hidden = !isPublic || shareResult.classList.contains("is-hidden");
            }
            if (passwordInput) {
                passwordInput.required = isEncrypted;
            }
        }

        function revokeCoverObjectUrl() {
            if (coverObjectUrl) {
                URL.revokeObjectURL(coverObjectUrl);
                coverObjectUrl = "";
            }
        }

        function setCoverMarkedForRemoval(marked) {
            var hasUpload = !!(coverInput && coverInput.files && coverInput.files.length);
            var hasExistingCover = !!existingCoverSrc;

            if (coverRemoveFlag) {
                coverRemoveFlag.value = marked ? "1" : "0";
            }
            if (coverPreviewWrapper) {
                coverPreviewWrapper.classList.toggle("is-hidden", marked || !hasExistingCover);
            }
            if (coverUploadRow) {
                coverUploadRow.classList.toggle("is-hidden", !marked && hasExistingCover && !hasUpload);
            }
            if (coverActions) {
                coverActions.hidden = !hasExistingCover && !hasUpload;
            }
            if (coverRemoveButton) {
                coverRemoveButton.classList.toggle("is-hidden", marked || (!hasExistingCover && !hasUpload));
            }
            if (coverUndoButton) {
                coverUndoButton.classList.toggle("is-hidden", !marked || !hasExistingCover);
            }
        }

        function syncCoverPreviewFromFile() {
            var file = coverInput && coverInput.files ? coverInput.files[0] : null;

            revokeCoverObjectUrl();
            if (!file || (file.type && file.type.indexOf("image/") !== 0)) {
                if (!existingCoverSrc) {
                    if (coverPreviewWrapper) {
                        coverPreviewWrapper.classList.add("is-hidden");
                    }
                    if (coverUploadRow) {
                        coverUploadRow.classList.remove("is-hidden");
                    }
                }
                return;
            }

            coverObjectUrl = URL.createObjectURL(file);
            if (coverPreviewImage) {
                coverPreviewImage.setAttribute("src", coverObjectUrl);
            }
            if (coverPreviewWrapper) {
                coverPreviewWrapper.classList.remove("is-hidden");
            }
            if (coverUploadRow) {
                coverUploadRow.classList.add("is-hidden");
            }
            if (coverUndoButton) {
                coverUndoButton.classList.add("is-hidden");
            }
            if (coverRemoveFlag) {
                coverRemoveFlag.value = "0";
            }
            if (coverActions) {
                coverActions.hidden = false;
            }
            if (coverRemoveButton) {
                coverRemoveButton.classList.remove("is-hidden");
            }
        }

        applyVisibilityLayout();
        visibilitySelect.addEventListener("change", applyVisibilityLayout);

        if (coverRemoveButton) {
            coverRemoveButton.addEventListener("click", function () {
                revokeCoverObjectUrl();
                if (coverInput) {
                    coverInput.value = "";
                }
                if (coverPreviewImage) {
                    coverPreviewImage.setAttribute("src", existingCoverSrc);
                }
                setCoverMarkedForRemoval(true);
            });
        }

        if (coverUndoButton) {
            coverUndoButton.addEventListener("click", function () {
                setCoverMarkedForRemoval(false);
            });
        }

        if (coverInput) {
            coverInput.addEventListener("change", syncCoverPreviewFromFile);
            window.addEventListener("beforeunload", revokeCoverObjectUrl);
        }

        setCoverMarkedForRemoval(false);
    }

    function focusHashTarget() {
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

        function getPanelWidth() {
            if (!mobilePanel) {
                return 300;
            }

            return Math.min(mobilePanel.offsetWidth || 300, Math.max(window.innerWidth - 32, 220));
        }

        function setPanelOpenDirection(direction) {
            if (!mobilePanel) {
                return;
            }

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

            if (!postShell) {
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
            var toggleSize = mobileToggle ? mobileToggle.offsetWidth || 48 : 48;
            var maxLeft = Math.max(margin, window.innerWidth - toggleSize - margin);
            var maxTop = Math.max(margin, window.innerHeight - toggleSize - margin);

            return {
                left: Math.min(Math.max(position.left, margin), maxLeft),
                top: Math.min(Math.max(position.top, margin), maxTop)
            };
        }

        function getDefaultCompactPosition() {
            var shellRect = null;
            var top = 0;
            var left = 0;

            if (postShell) {
                shellRect = postShell.getBoundingClientRect();
                top = Math.max(88, shellRect.top + 12);
                left = Math.min(window.innerWidth - 60, shellRect.right + 12);
            } else {
                top = 88;
                left = window.innerWidth - 60;
            }

            return clampCompactPosition({ left: left, top: top });
        }

        function loadCompactPosition() {
            var stored = null;

            try {
                stored = window.localStorage ? window.localStorage.getItem(outlineStorageKey) : null;
                if (!stored) {
                    return null;
                }
                stored = JSON.parse(stored);
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
            var shellRect = null;
            var top = 0;
            var left = 0;

            if (!outlineRoot || !mobilePanel || !postShell) {
                return;
            }

            shellRect = postShell.getBoundingClientRect();
            top = Math.max(88, shellRect.top);
            left = shellRect.right + outlineGap;
            setPanelOpenDirection("left");

            outlineRoot.style.top = Math.round(top) + "px";
            outlineRoot.style.left = Math.round(left) + "px";
        }

        function applyCompactPosition(position) {
            var nextPosition = clampCompactPosition(position || getDefaultCompactPosition());

            compactPosition = nextPosition;
            if (!outlineRoot) {
                return;
            }

            outlineRoot.style.top = Math.round(nextPosition.top) + "px";
            outlineRoot.style.left = Math.round(nextPosition.left) + "px";
        }

        function updateCompactPanelDirection() {
            var toggleRect = null;
            var panelWidth = 0;
            var spaceOnRight = 0;

            if (!mobileToggle || !mobilePanel) {
                return;
            }

            toggleRect = mobileToggle.getBoundingClientRect();
            panelWidth = getPanelWidth();
            spaceOnRight = window.innerWidth - toggleRect.right - 12;

            setPanelOpenDirection(spaceOnRight >= panelWidth ? "right" : "left");
        }

        function updateOutlineRootPosition() {
            if (!outlineRoot) {
                return;
            }

            if (isCompactOutlineMode()) {
                applyCompactPosition(compactPosition || loadCompactPosition() || getDefaultCompactPosition());
                updateCompactPanelDirection();
                return;
            }

            compactPosition = null;
            applyExpandedPosition();
        }

        function toggleDraggingState(isDragging) {
            if (!mobileToggle) {
                return;
            }

            mobileToggle.classList.toggle("is-dragging", isDragging);
        }

        function handleCompactPointerMove(event) {
            var nextPosition = null;

            if (compactPointerId !== event.pointerId || !outlineRoot || !mobileToggle) {
                return;
            }

            nextPosition = clampCompactPosition({
                left: event.clientX - compactDragOffsetX,
                top: event.clientY - compactDragOffsetY
            });
            applyCompactPosition(nextPosition);
        }

        function handleCompactPointerEnd(event) {
            if (compactPointerId !== event.pointerId || !mobileToggle) {
                return;
            }

            compactPointerId = null;
            toggleDraggingState(false);
            try {
                mobileToggle.releasePointerCapture(event.pointerId);
            } catch (_error) {
                return;
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
            if (!mobileToggle) {
                return;
            }

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
            if (!mobilePanel || !mobileToggle) {
                return;
            }

            mobilePanel.hidden = false;
            mobileToggle.setAttribute("aria-expanded", "true");
            updateMobileToggleLabel();
        }

        function closeMobileOutline() {
            if (!mobilePanel || !mobileToggle) {
                return;
            }

            mobilePanel.hidden = true;
            mobileToggle.setAttribute("aria-expanded", "false");
            updateMobileToggleLabel();
        }

        function syncOutlineDisplayMode() {
            if (!outlineRoot || !mobileToggle || !mobilePanel) {
                return;
            }

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

        if (!outlineRoot || !outlineScope || !postShell || !contentNode || !outlineNavs.length || !mobileToggle || !mobilePanel) {
            return;
        }

        if (headerTitle && (headerTitle.textContent || "").trim()) {
            headings.push(headerTitle);
        }
        Array.prototype.forEach.call(contentNode.querySelectorAll("h1, h2, h3"), function (heading) {
            if (!heading || !heading.textContent || !heading.textContent.trim()) {
                return;
            }
            headings.push(heading);
        });

        if (!headings.length) {
            return;
        }

        headings.forEach(function (heading, index) {
            var baseId = heading.id || slugifyHeadingText(heading.textContent) || "section-" + String(index + 1);
            var uniqueId = baseId;
            var duplicateIndex = 2;
            var level = heading.tagName.toLowerCase();

            while (headingIds[uniqueId] || document.getElementById(uniqueId) && document.getElementById(uniqueId) !== heading) {
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

    function initializeBookEditor() {
        if (!bookEditorForm) {
            return;
        }

        var visibilitySelect = bookEditorForm.querySelector("#id_visibility");
        var passwordField = bookEditorForm.querySelector("[data-book-password-field]");
        var shareField = bookEditorForm.querySelector("[data-book-share-field]");
        var shareMessages = bookEditorForm.querySelectorAll("[data-book-share-message]");
        var shareResult = bookEditorForm.querySelector("[data-book-share-result]");
        var passwordInput = bookEditorForm.querySelector("#id_access_password");
        var coverInput = bookEditorForm.querySelector("#id_cover_image");
        var coverInputShell = bookEditorForm.querySelector("[data-book-cover-input-shell]");
        var coverPreviewWrapper = bookEditorForm.querySelector("[data-book-cover-preview-wrapper]");
        var coverPreviewCard = bookEditorForm.querySelector("[data-book-cover-preview-card]");
        var coverPreviewImage = bookEditorForm.querySelector("[data-book-cover-preview-image]");
        var coverActions = bookEditorForm.querySelector("[data-book-cover-actions]");
        var coverRemoveButton = bookEditorForm.querySelector("[data-book-cover-remove]");
        var coverUndoButton = bookEditorForm.querySelector("[data-book-cover-undo]");
        var coverUploadRow = bookEditorForm.querySelector("[data-book-cover-upload-row]");
        var coverRemoveFlag = bookEditorForm.querySelector("[data-book-cover-remove-flag]");
        var structureInput = bookEditorForm.querySelector("#id_structure");
        var structureRoot = bookEditorForm.querySelector("[data-book-structure-root]");
        var structureDataNode = bookEditorForm.querySelector("#book-structure-data");
        var addGroupButton = bookEditorForm.querySelector("[data-book-add-group]");
        var addPostsButton = bookEditorForm.querySelector("[data-book-add-posts]");
        var postSelectionInputs = bookEditorForm.querySelector("[data-book-post-selection-inputs]");
        var chapterWorkbench = bookEditorForm.querySelector("[data-book-chapter-workbench]");
        var postOptionNodes = bookEditorForm.querySelectorAll("[data-book-post-option]");
        var structureData = [];
        var coverObjectUrl = "";
        var existingCoverSrc = coverPreviewImage ? coverPreviewImage.getAttribute("src") || "" : "";
        var postOptionMap = Object.create(null);
        var dragState = {
            path: [],
            position: "after"
        };
        function ensureBookContextMenu() {
            if (tableContextMenu) {
                return tableContextMenu;
            }

            tableContextMenu = document.createElement("div");
            tableContextMenu.className = "editor-table-context-menu";
            tableContextMenu.hidden = true;
            document.body.appendChild(tableContextMenu);
            return tableContextMenu;
        }

        function openBookContextMenu(event, actions, state) {
            openTableContextMenu(event, actions, state);
        }

        function getBookEditorString(name, fallback) {
            var value = chapterWorkbench ? chapterWorkbench.getAttribute(name) : "";
            return value || fallback;
        }

        function revokeCoverObjectUrl() {
            if (coverObjectUrl) {
                URL.revokeObjectURL(coverObjectUrl);
                coverObjectUrl = "";
            }
        }

        function setCoverPreview(url) {
            if (!coverPreviewCard || !coverPreviewImage || !coverInputShell || !coverPreviewWrapper || !coverUploadRow) {
                return;
            }
            if (url) {
                coverPreviewImage.setAttribute("src", url);
                coverPreviewWrapper.classList.remove("is-hidden");
                coverInputShell.classList.add("is-hidden");
                coverUploadRow.classList.add("is-hidden");
                return;
            }
            coverPreviewImage.setAttribute("src", "");
            coverPreviewWrapper.classList.add("is-hidden");
            coverInputShell.classList.remove("is-hidden");
            coverUploadRow.classList.remove("is-hidden");
        }

        function setCoverMarkedForRemoval(marked) {
            var hasUpload = !!(coverInput && coverInput.files && coverInput.files.length);
            var hasExistingCover = !!existingCoverSrc;

            if (coverRemoveFlag) {
                coverRemoveFlag.value = marked ? "1" : "0";
            }
            if (coverPreviewWrapper) {
                coverPreviewWrapper.classList.toggle("is-hidden", marked || !hasExistingCover);
            }
            if (coverInputShell) {
                coverInputShell.classList.toggle("is-hidden", !marked && hasExistingCover && !hasUpload);
            }
            if (coverUploadRow) {
                coverUploadRow.classList.toggle("is-hidden", !marked && hasExistingCover && !hasUpload);
            }
            if (coverActions) {
                coverActions.hidden = !hasExistingCover && !hasUpload;
            }
            if (coverRemoveButton) {
                coverRemoveButton.classList.toggle("is-hidden", marked || (!hasExistingCover && !hasUpload));
            }
            if (coverUndoButton) {
                coverUndoButton.classList.toggle("is-hidden", !marked || !hasExistingCover);
            }
        }

        function resetCoverInput() {
            revokeCoverObjectUrl();
            if (coverInput) {
                coverInput.value = "";
            }
            if (coverPreviewImage) {
                coverPreviewImage.setAttribute("src", existingCoverSrc);
            }
            setCoverMarkedForRemoval(true);
        }

        function syncCoverPreview() {
            if (!coverInput || !coverPreviewCard || !coverPreviewImage || !coverInput.files || !coverInput.files.length) {
                return;
            }
            revokeCoverObjectUrl();
            coverObjectUrl = URL.createObjectURL(coverInput.files[0]);
            if (coverRemoveFlag) {
                coverRemoveFlag.value = "0";
            }
            setCoverPreview(coverObjectUrl);
            if (coverUndoButton) {
                coverUndoButton.classList.add("is-hidden");
            }
            if (coverActions) {
                coverActions.hidden = false;
            }
            if (coverRemoveButton) {
                coverRemoveButton.classList.remove("is-hidden");
            }
        }

        function collectSelectedPostIds(nodes, bucket) {
            (nodes || []).forEach(function (node) {
                if (!node || typeof node !== "object") {
                    return;
                }
                if (node.type === "post") {
                    bucket.push(String(node.post_id));
                    return;
                }
                if (node.type === "group") {
                    collectSelectedPostIds(node.children || [], bucket);
                }
            });
        }

        function getSelectedPostIds() {
            var bucket = [];
            collectSelectedPostIds(structureData, bucket);
            return bucket;
        }

        function syncPostSelectionInput() {
            if (!postSelectionInputs) {
                return;
            }

            postSelectionInputs.innerHTML = "";
            getSelectedPostIds().forEach(function (postId) {
                var input = document.createElement("input");
                input.type = "hidden";
                input.name = "post_selection";
                input.value = postId;
                postSelectionInputs.appendChild(input);
            });
        }

        function syncPostOptionSelectionStates() {
            var selectedMap = Object.create(null);

            getSelectedPostIds().forEach(function (postId) {
                selectedMap[postId] = true;
            });

            Object.keys(postOptionMap).forEach(function (postId) {
                postOptionMap[postId].selected = Boolean(selectedMap[postId]);
            });
        }

        function getPostMeta(postId) {
            return postOptionMap[String(postId)] || null;
        }

        function removeDuplicatePosts(nodes, seen) {
            var nextNodes = [];

            (nodes || []).forEach(function (node) {
                if (!node || typeof node !== "object") {
                    return;
                }
                if (node.type === "post") {
                    var postId = String(node.post_id);
                    if (seen[postId]) {
                        return;
                    }
                    seen[postId] = true;
                    nextNodes.push({ type: "post", post_id: parseInt(node.post_id, 10) });
                    return;
                }
                if (node.type === "group") {
                    nextNodes.push({
                        type: "group",
                        title: node.title || "Group",
                        children: removeDuplicatePosts(node.children || [], seen)
                    });
                }
            });

            return nextNodes;
        }

        function syncVisibilityFields() {
            var isEncrypted = visibilitySelect && visibilitySelect.value === "encrypted";
            var isPublic = visibilitySelect && visibilitySelect.value === "public";
            if (passwordField) {
                passwordField.hidden = !isEncrypted;
            }
            if (passwordInput) {
                passwordInput.required = isEncrypted;
            }
            if (shareField) {
                shareField.hidden = !isPublic;
            }
            Array.prototype.forEach.call(shareMessages || [], function (node) {
                node.hidden = !isPublic;
            });
            if (shareResult) {
                shareResult.hidden = !isPublic || shareResult.classList.contains("is-hidden");
            }
        }

        function normalizeStructureTree(nodes) {
            return removeDuplicatePosts(nodes, Object.create(null));
        }

        function pruneStructure(nodes, selectedMap) {
            var nextNodes = [];
            (nodes || []).forEach(function (node) {
                if (!node || typeof node !== "object") {
                    return;
                }
                if (node.type === "post") {
                    if (!selectedMap || selectedMap[String(node.post_id)]) {
                        nextNodes.push({ type: "post", post_id: parseInt(node.post_id, 10) });
                    }
                    return;
                }
                if (node.type === "group") {
                    var children = pruneStructure(node.children || [], selectedMap);
                    nextNodes.push({ type: "group", title: node.title || "Group", children: children });
                }
            });
            return nextNodes;
        }

        function serializeStructure() {
            structureData = normalizeStructureTree(structureData);
            if (structureInput) {
                structureInput.value = JSON.stringify(structureData || []);
            }
            syncPostOptionSelectionStates();
            syncPostSelectionInput();
        }

        function getNodeAtPath(path) {
            var node = null;
            var currentNodes = structureData;

            (path || []).forEach(function (index) {
                node = currentNodes[index] || null;
                currentNodes = node && node.type === "group" ? (node.children || []) : [];
            });

            return node;
        }

        function pathsEqual(first, second) {
            return JSON.stringify(first || []) === JSON.stringify(second || []);
        }

        function isDescendantPath(parentPath, targetPath) {
            if (!parentPath || !targetPath || parentPath.length >= targetPath.length) {
                return false;
            }

            return parentPath.every(function (value, index) {
                return value === targetPath[index];
            });
        }

        function getParentArray(path) {
            var indexes = (path || []).slice(0, -1);
            var currentNodes = structureData;
            var isValid = true;

            indexes.forEach(function (index) {
                var node = currentNodes[index];
                if (!isValid || !node || node.type !== "group") {
                    isValid = false;
                    return;
                }
                currentNodes = node.children || (node.children = []);
            });

            return isValid ? currentNodes : null;
        }

        function removeNodeAtPath(path) {
            var parentArray = getParentArray(path);
            var index = path && path.length ? path[path.length - 1] : -1;
            if (!parentArray || index < 0 || index >= parentArray.length) {
                return null;
            }
            return parentArray.splice(index, 1)[0] || null;
        }

        function insertNodeAtTarget(node, targetPath, position) {
            var targetNode = getNodeAtPath(targetPath);
            var targetParent = getParentArray(targetPath);
            var targetIndex = targetPath[targetPath.length - 1];

            if (!targetPath.length) {
                structureData.push(node);
                return;
            }

            if (position === "inside" && targetNode && targetNode.type === "group") {
                (targetNode.children || (targetNode.children = [])).push(node);
                return;
            }

            if (!targetParent) {
                structureData.push(node);
                return;
            }

            targetParent.splice(position === "before" ? targetIndex : targetIndex + 1, 0, node);
        }

        function moveNode(path, direction) {
            var parentArray = getParentArray(path);
            var index = path && path.length ? path[path.length - 1] : -1;
            var targetIndex = direction === -1 ? index - 1 : index + 1;

            if (!parentArray || index < 0 || targetIndex < 0 || targetIndex >= parentArray.length) {
                return false;
            }

            parentArray.splice(targetIndex, 0, parentArray.splice(index, 1)[0]);
            return true;
        }

        function openGroupNameDialog(options) {
            var input = document.createElement("input");
            var hint = document.createElement("p");
            var initialValue = options && typeof options.initialValue === "string" ? options.initialValue : "";
            var title = options && options.title ? options.title : getBookEditorString("data-chapter-rename-title", "Rename group");
            var onConfirm = options && typeof options.onConfirm === "function" ? options.onConfirm : null;

            input.className = "input-control";
            input.value = initialValue;
            input.placeholder = getBookEditorString("data-chapter-rename-placeholder", "Group title");
            hint.className = "field-help";
            hint.textContent = getBookEditorString("data-chapter-rename-help", "Enter a new group name.");

            openModal({
                kicker: getBookEditorString("data-chapter-kicker", "Chapters"),
                title: title,
                contentNode: (function () {
                    var container = document.createElement("div");
                    container.className = "editor-modal-form";
                    container.appendChild(input);
                    container.appendChild(hint);
                    return container;
                }()),
                cancelText: getBookEditorString("data-chapter-cancel-label", "Cancel"),
                confirmText: getBookEditorString("data-chapter-save-label", "Save"),
                keepOpenOnConfirm: true,
                onConfirm: function () {
                    var value = (input.value || "").trim();

                    if (!value) {
                        input.focus();
                        return;
                    }

                    if (onConfirm) {
                        onConfirm(value);
                    }

                    closeModal();
                }
            });

            window.setTimeout(function () {
                input.focus();
                if (typeof input.select === "function") {
                    input.select();
                }
            }, 0);
        }

        function renameGroup(path) {
            var node = getNodeAtPath(path);

            if (!node || node.type !== "group") {
                return;
            }

            openGroupNameDialog({
                initialValue: node.title || "",
                title: getBookEditorString("data-chapter-rename-title", "Rename group"),
                onConfirm: function (value) {
                    node.title = value;
                    rerenderStructure();
                }
            });
        }

        function deleteNode(path) {
            var parentArray = getParentArray(path);
            var index = path && path.length ? path[path.length - 1] : -1;
            var node = parentArray && index > -1 ? parentArray[index] : null;

            if (!node) {
                return;
            }

            if (node.type === "group") {
                var children = pruneStructure(node.children || []);
                parentArray.splice.apply(parentArray, [index, 1].concat(children));
            } else {
                parentArray.splice(index, 1);
            }
        }

        function addPostsToStructure(postIds) {
            var existing = Object.create(null);

            getSelectedPostIds().forEach(function (postId) {
                existing[postId] = true;
            });

            (postIds || []).forEach(function (postId) {
                if (!postId || existing[String(postId)]) {
                    return;
                }
                existing[String(postId)] = true;
                structureData.push({ type: "post", post_id: parseInt(postId, 10) });
            });
        }

        function createWorkbenchRow(node, path, depth, parentArray) {
            var item = document.createElement("div");
            var row = document.createElement("div");
            var main = document.createElement("div");
            var title = document.createElement("div");
            var actions = document.createElement("div");
            var dragHandle = document.createElement("button");
            var leadingIcon = document.createElement("i");
            var text = document.createElement("span");
            var pathString = JSON.stringify(path);

            item.className = "chapter-workbench-item";
            row.className = "chapter-workbench-row";
            row.setAttribute("data-depth", String(depth));
            row.setAttribute("data-node-path", pathString);
            row.draggable = true;

            main.className = "chapter-workbench-main";
            title.className = "chapter-workbench-title";
            actions.className = "chapter-workbench-actions";
            dragHandle.type = "button";
            dragHandle.className = "chapter-workbench-drag-handle";
            dragHandle.setAttribute("aria-label", getBookEditorString("data-chapter-drag-label", "Drag"));
            dragHandle.setAttribute("title", getBookEditorString("data-chapter-drag-label", "Drag"));
            dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';

            leadingIcon.className = node.type === "group" ? "fa-solid fa-folder chapter-workbench-kind-icon" : "fa-regular fa-file-lines chapter-workbench-kind-icon";
            leadingIcon.setAttribute("aria-hidden", "true");
            text.className = "chapter-workbench-text";
            text.textContent = node.type === "group" ? (node.title || "Group") : ((getPostMeta(node.post_id) || {}).title || ("#" + node.post_id));

            title.appendChild(leadingIcon);
            title.appendChild(text);

            if (node.type === "post") {
                var postMeta = getPostMeta(node.post_id);
                if (postMeta && postMeta.visibility !== "public") {
                    var visibilityIcon = document.createElement("i");
                    if (postMeta.visibility === "encrypted") {
                        visibilityIcon.className = "fa-solid fa-lock chapter-workbench-visibility-icon chapter-workbench-visibility-encrypted";
                    } else if (postMeta.visibility === "book_only") {
                        visibilityIcon.className = "fa-solid fa-book-open-reader chapter-workbench-visibility-icon chapter-workbench-visibility-book-only";
                    } else {
                        visibilityIcon.className = "fa-solid fa-user chapter-workbench-visibility-icon chapter-workbench-visibility-private";
                    }
                    visibilityIcon.setAttribute("aria-hidden", "true");
                    title.appendChild(visibilityIcon);
                }
            }

            function createActionButton(iconClassName, label, handler) {
                var button = document.createElement("button");
                button.type = "button";
                button.className = "chapter-workbench-action-button";
                button.setAttribute("title", label);
                button.setAttribute("aria-label", label);
                button.innerHTML = '<i class="' + iconClassName + '" aria-hidden="true"></i>';
                button.addEventListener("click", function (event) {
                    event.stopPropagation();
                    handler();
                });
                actions.appendChild(button);
            }

            createActionButton("fa-solid fa-arrow-up", getBookEditorString("data-chapter-move-up-label", "Move up"), function () {
                if (moveNode(path, -1)) {
                    rerenderStructure();
                }
            });
            createActionButton("fa-solid fa-arrow-down", getBookEditorString("data-chapter-move-down-label", "Move down"), function () {
                if (moveNode(path, 1)) {
                    rerenderStructure();
                }
            });
            if (node.type === "group") {
                createActionButton("fa-solid fa-pen", getBookEditorString("data-chapter-rename-title", "Rename group"), function () {
                    renameGroup(path);
                });
            }
            createActionButton("fa-solid fa-trash", getBookEditorString("data-chapter-delete-label", "Delete"), function () {
                deleteNode(path);
                rerenderStructure();
            });

            row.addEventListener("contextmenu", function (event) {
                event.preventDefault();
                openBookContextMenu(
                    event,
                    [
                        {
                            label: getBookEditorString("data-chapter-move-up-label", "Move up"),
                            disabled: path[path.length - 1] < 1,
                            onClick: function () {
                                if (moveNode(path, -1)) {
                                    rerenderStructure();
                                }
                            }
                        },
                        {
                            label: getBookEditorString("data-chapter-move-down-label", "Move down"),
                            disabled: path[path.length - 1] >= parentArray.length - 1,
                            onClick: function () {
                                if (moveNode(path, 1)) {
                                    rerenderStructure();
                                }
                            }
                        }
                    ].concat(node.type === "group" ? [{
                        label: getBookEditorString("data-chapter-rename-title", "Rename group"),
                        onClick: function () {
                            renameGroup(path);
                        }
                    }] : []).concat([{
                        label: getBookEditorString("data-chapter-delete-label", "Delete"),
                        isDanger: true,
                        onClick: function () {
                            deleteNode(path);
                            rerenderStructure();
                        }
                    }]),
                    { path: path.slice() }
                );
            });

            row.addEventListener("dragstart", function (event) {
                dragState.path = path.slice();
                dragState.position = "after";
                row.classList.add("is-dragging");
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = "move";
                    try {
                        event.dataTransfer.setData("text/plain", pathString);
                    } catch (_error) {
                        return;
                    }
                }
            });

            row.addEventListener("dragend", function () {
                dragState.path = [];
                dragState.position = "after";
                Array.prototype.forEach.call(bookEditorForm.querySelectorAll(".chapter-workbench-row"), function (element) {
                    element.classList.remove("is-dragging", "is-drop-before", "is-drop-after", "is-drop-inside");
                });
            });

            row.addEventListener("dragover", function (event) {
                var rect = row.getBoundingClientRect();
                var offsetY = event.clientY - rect.top;
                var nextPosition = "after";

                event.preventDefault();
                if (node.type === "group" && offsetY > rect.height * 0.3 && offsetY < rect.height * 0.7) {
                    nextPosition = "inside";
                } else if (offsetY < rect.height / 2) {
                    nextPosition = "before";
                }

                dragState.position = nextPosition;
                Array.prototype.forEach.call(bookEditorForm.querySelectorAll(".chapter-workbench-row"), function (element) {
                    element.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside");
                });
                row.classList.add(nextPosition === "before" ? "is-drop-before" : (nextPosition === "inside" ? "is-drop-inside" : "is-drop-after"));
            });

            row.addEventListener("drop", function (event) {
                var movedNode = null;
                var draggedPath = dragState.path.slice();
                var targetPath = path.slice();
                var targetNode = getNodeAtPath(targetPath);

                event.preventDefault();
                if (!draggedPath.length || pathsEqual(targetPath, draggedPath) || isDescendantPath(draggedPath, targetPath)) {
                    return;
                }

                movedNode = removeNodeAtPath(draggedPath);
                if (!movedNode) {
                    return;
                }

                if (dragState.position === "inside" && targetNode && targetNode.type === "group") {
                    (targetNode.children || (targetNode.children = [])).push(movedNode);
                } else {
                    var adjustedTargetPath = targetPath.slice();
                    if (draggedPath.length === targetPath.length && draggedPath.slice(0, -1).every(function (value, index) { return value === targetPath[index]; }) && draggedPath[draggedPath.length - 1] < targetPath[targetPath.length - 1]) {
                        adjustedTargetPath[adjustedTargetPath.length - 1] -= 1;
                    }
                    insertNodeAtTarget(movedNode, adjustedTargetPath, dragState.position);
                }
                rerenderStructure();
            });

            main.style.paddingLeft = Math.max(0, depth * 1.1) + "rem";
            main.appendChild(dragHandle);
            main.appendChild(title);
            row.appendChild(main);
            row.appendChild(actions);
            item.appendChild(row);

            if (node.type === "group" && (node.children || []).length) {
                var children = document.createElement("div");
                children.className = "chapter-workbench-children";
                (node.children || []).forEach(function (child, childIndex) {
                    children.appendChild(createWorkbenchRow(child, path.concat(childIndex), depth + 1, node.children || []));
                });
                item.appendChild(children);
            }

            return item;
        }

        function rerenderStructure() {
            structureData = normalizeStructureTree(structureData);
            serializeStructure();

            if (!structureRoot) {
                return;
            }

            structureRoot.innerHTML = "";

            if (!structureData.length) {
                var emptyState = document.createElement("div");
                emptyState.className = "chapter-workbench-empty";
                emptyState.innerHTML = '<i class="fa-solid fa-book-open-reader" aria-hidden="true"></i><p>' + escapeHtml(getBookEditorString("data-chapter-empty-label", "No chapters yet. Add articles or groups to start building this book.")) + '</p>';
                structureRoot.appendChild(emptyState);
                return;
            }

            structureData.forEach(function (node, index) {
                structureRoot.appendChild(createWorkbenchRow(node, [index], 0, structureData));
            });
        }

    function openAddPostsDialog() {
        var searchUrl = getBookEditorString("data-reference-search-url", "");
        var container = document.createElement("div");
        var input = document.createElement("input");
        var results = document.createElement("div");
        var resultGrid = document.createElement("div");
        var pagination = document.createElement("div");
        var paginationStatus = document.createElement("div");
        var paginationActions = document.createElement("div");
        var previousButton = document.createElement("button");
        var nextButton = document.createElement("button");
        var empty = document.createElement("p");
        var selectedIds = Object.create(null);
        var requestId = 0;
        var activePage = 1;
        var latestQuery = "";

        if (!searchUrl) {
            return;
        }

            container.className = "editor-modal-form chapter-post-picker";
        input.className = "input-control";
        input.placeholder = getBookEditorString("data-chapter-search-placeholder", "Search posts");
        results.className = "chapter-post-picker-results";
        resultGrid.className = "post-grid editor-reference-grid chapter-post-picker-grid";
        pagination.className = "editor-dialog-pagination pagination-panel";
        paginationStatus.className = "pagination-status";
        paginationActions.className = "pagination-actions";
        previousButton.type = "button";
        previousButton.className = "secondary-button pagination-button";
        previousButton.textContent = "Previous";
        nextButton.type = "button";
        nextButton.className = "secondary-button pagination-button";
        nextButton.textContent = "Next";
        empty.className = "field-help";
        empty.textContent = getBookEditorString("data-chapter-no-posts-label", "No posts found.");
        paginationActions.appendChild(previousButton);
        paginationActions.appendChild(nextButton);
        pagination.appendChild(paginationStatus);
        pagination.appendChild(paginationActions);
        results.appendChild(resultGrid);
        container.appendChild(input);
        container.appendChild(results);
        container.appendChild(pagination);

        function updatePagination(paginationData, hasItems) {
            var page = paginationData && paginationData.page ? paginationData.page : 1;
            var totalPages = paginationData && paginationData.total_pages ? paginationData.total_pages : 1;
            var hasPrevious = Boolean(paginationData && paginationData.has_previous);
            var hasNext = Boolean(paginationData && paginationData.has_next);

            activePage = page;
            pagination.hidden = !hasItems && totalPages <= 1;
            paginationStatus.textContent = "Page: " + page + " / " + totalPages;
            previousButton.disabled = !hasPrevious;
            nextButton.disabled = !hasNext;
            previousButton.classList.toggle("is-disabled", !hasPrevious);
            nextButton.classList.toggle("is-disabled", !hasNext);
        }

        function renderItems(items) {
            resultGrid.innerHTML = "";
            results.classList.toggle("is-empty", !items.length);
            if (!items.length) {
                    if (!results.contains(empty)) {
                        results.appendChild(empty);
                    }
                    return;
                }
                if (results.contains(empty)) {
                    results.removeChild(empty);
                }

                items.forEach(function (item) {
                    var wrapper = document.createElement("div");
                    var card = null;
                    var trigger = null;
                    var toggle = document.createElement("button");
                    var meta = getPostMeta(item.id) || {
                        id: String(item.id),
                        title: item.title || "",
                        author: item.author || "",
                        visibility: item.visibility || "public",
                        selected: false
                    };

                    wrapper.innerHTML = item.html || "";
                    card = wrapper.firstElementChild;
                    trigger = wrapper.querySelector("[data-post-card-select]");
                    if (!card) {
                        return;
                    }

                    toggle.type = "button";
                    toggle.className = "chapter-post-picker-select" + (selectedIds[String(item.id)] || meta.selected ? " is-selected" : "");
                    toggle.textContent = meta.selected ? getBookEditorString("data-chapter-added-label", "Added") : (selectedIds[String(item.id)] ? getBookEditorString("data-chapter-selected-label", "Selected") : getBookEditorString("data-chapter-select-label", "Select"));
                    toggle.disabled = Boolean(meta.selected);
                    toggle.addEventListener("click", function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        var key = String(item.id);
                        if (meta.selected) {
                            return;
                        }
                        if (selectedIds[key]) {
                            delete selectedIds[key];
                            toggle.classList.remove("is-selected");
                            toggle.textContent = getBookEditorString("data-chapter-select-label", "Select");
                            return;
                        }
                        selectedIds[key] = true;
                        toggle.classList.add("is-selected");
                        toggle.textContent = getBookEditorString("data-chapter-selected-label", "Selected");
                    });
                    if (trigger) {
                        trigger.addEventListener("click", function (event) {
                            event.preventDefault();
                            toggle.click();
                        });
                    }
                    card.classList.add("chapter-post-picker-card");
                    card.appendChild(toggle);
                    resultGrid.appendChild(card);
                });
            }

            function fetchResults(query, page) {
                requestId += 1;
                var currentRequestId = requestId;
                var queryText = typeof query === "string" ? query : "";
                var targetPage = page || 1;
                latestQuery = queryText;

                fetch(searchUrl + "?q=" + encodeURIComponent(queryText) + "&page=" + encodeURIComponent(String(targetPage)), { credentials: "same-origin" })
                    .then(function (response) {
                        return response.json().catch(function () {
                            return { ok: false, items: [], pagination: null };
                        });
                    })
                    .then(function (payload) {
                        if (currentRequestId !== requestId) {
                            return;
                        }
                        var items = payload.ok ? (payload.items || []) : [];
                        renderItems(items);
                        updatePagination(payload.ok ? payload.pagination : null, items.length > 0);
                    })
                    .catch(function () {
                        if (currentRequestId !== requestId) {
                            return;
                        }
                        renderItems([]);
                        updatePagination(null, false);
                    });
            }

            input.addEventListener("input", function () {
                fetchResults(input.value, 1);
            });
            previousButton.addEventListener("click", function () {
                if (previousButton.disabled || activePage <= 1) {
                    return;
                }
                fetchResults(latestQuery, activePage - 1);
            });
            nextButton.addEventListener("click", function () {
                if (nextButton.disabled) {
                    return;
                }
                fetchResults(latestQuery, activePage + 1);
            });

            openModal({
                kicker: getBookEditorString("data-chapter-kicker", "Chapters"),
                title: getBookEditorString("data-chapter-add-posts-label", "Add articles"),
                contentNode: container,
                cancelText: getBookEditorString("data-chapter-cancel-label", "Cancel"),
                confirmText: getBookEditorString("data-chapter-add-selected-label", "Add selected"),
                onConfirm: function () {
                    addPostsToStructure(Object.keys(selectedIds));
                    rerenderStructure();
                },
                dialogClass: "is-wide-dialog"
            });

            fetchResults("", 1);
            window.setTimeout(function () {
                input.focus();
            }, 0);
        }

        try {
            structureData = JSON.parse((structureDataNode && structureDataNode.textContent) || "[]") || [];
        } catch (_error) {
            structureData = [];
        }

        Array.prototype.forEach.call(postOptionNodes, function (item) {
            var postId = item.getAttribute("data-post-id") || "";
            if (!postId) {
                return;
            }
            postOptionMap[postId] = {
                id: postId,
                title: item.getAttribute("data-post-title") || "",
                visibility: item.getAttribute("data-post-visibility") || "public",
                author: item.getAttribute("data-post-author") || "",
                selected: item.getAttribute("data-post-selected") === "true"
            };
        });

        structureData = normalizeStructureTree(structureData);
        if (!structureData.length) {
            Object.keys(postOptionMap).forEach(function (postId) {
                if (postOptionMap[postId].selected) {
                    structureData.push({ type: "post", post_id: parseInt(postId, 10) });
                }
            });
        }

        if (visibilitySelect) {
            syncVisibilityFields();
            visibilitySelect.addEventListener("change", syncVisibilityFields);
        }
        if (coverInput) {
            coverInput.addEventListener("change", function () {
                syncCoverPreview();
            });
        }
        if (coverUndoButton) {
            coverUndoButton.addEventListener("click", function () {
                setCoverMarkedForRemoval(false);
            });
        }
        if (coverRemoveButton) {
            coverRemoveButton.addEventListener("click", function () {
                resetCoverInput();
            });
        }
        setCoverMarkedForRemoval(false);
        ensureBookContextMenu();
        if (addPostsButton) {
            addPostsButton.addEventListener("click", function () {
                openAddPostsDialog();
            });
        }
        if (addGroupButton) {
            addGroupButton.addEventListener("click", function () {
                openGroupNameDialog({
                    initialValue: getBookEditorString("data-chapter-new-group-default", "New group"),
                    title: getBookEditorString("data-chapter-add-group-label", "Add group"),
                    onConfirm: function (value) {
                        structureData.push({ type: "group", title: value, children: [] });
                        rerenderStructure();
                    }
                });
            });
        }

        rerenderStructure();
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

        if (!dataNode || !outlineRoot || !outlineNavs.length) {
            return;
        }

        try {
            items = JSON.parse(dataNode.textContent || "[]") || [];
        } catch (_error) {
            items = [];
        }

        function getPanelWidth() {
            return Math.min((mobilePanel && mobilePanel.offsetWidth) || 300, Math.max(window.innerWidth - 32, 220));
        }

        function canShowExpandedPanel() {
            var rect = null;
            var panelWidth = getPanelWidth();
            var outerSpace = 0;

            if (!scope) {
                return false;
            }
            rect = scope.getBoundingClientRect();
            outerSpace = Math.min(rect.left, window.innerWidth - rect.right) - outlineGap;
            return outerSpace >= panelWidth && window.innerWidth >= expandedMinWidth;
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
            if (!scope) {
                return;
            }
            var rect = scope.getBoundingClientRect();
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
                    item.classList.add("book-outline-group-item");
                    var heading = document.createElement("div");
                    heading.className = "book-outline-group-title";
                    heading.textContent = node.title || "";
                    item.appendChild(heading);
                    item.appendChild(renderNodes(node.children || []));
                    list.appendChild(item);
                    return;
                }

                var link = document.createElement("a");
                var icon = null;
                var title = document.createElement("span");
                link.className = "post-outline-link" + (node.isCurrent ? " is-active" : "");
                link.classList.add("book-outline-link");
                link.href = node.url || "#";
                if (node.isCurrent) {
                    link.setAttribute("aria-current", "page");
                }
                title.className = "book-outline-link-text";
                title.textContent = node.title || "";
                if (node.isPrivate || node.isEncrypted || node.isBookOnly) {
                    icon = document.createElement("i");
                    if (node.isEncrypted) {
                        icon.className = "fa-solid fa-lock book-outline-status-icon book-outline-status-encrypted";
                    } else if (node.isBookOnly) {
                        icon.className = "fa-solid fa-book-open-reader book-outline-status-icon book-outline-status-book-only";
                    } else {
                        icon.className = "fa-solid fa-user book-outline-status-icon book-outline-status-private";
                    }
                    icon.setAttribute("aria-hidden", "true");
                    link.appendChild(icon);
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

    function getMarkdownUploadUrl() {
        if (activeImageEditor && activeImageEditor.element) {
            return activeImageEditor.element.getAttribute("data-upload-url") || "";
        }
        return markdownEditorNodes.length ? markdownEditorNodes[0].getAttribute("data-upload-url") || "" : "";
    }

    function getCsrfToken() {
        return csrfInput ? csrfInput.value : "";
    }

    function getPostEditorRecoveryKey() {
        if (!postEditorForm) {
            return "";
        }

        return "post-editor-recovery:" + (postEditorForm.getAttribute("data-post-id") || "new");
    }

    function storePostEditorDraft() {
        var storageKey = getPostEditorRecoveryKey();
        var fieldNames = ["title", "slug", "summary", "tag_names"];
        var payload = {};

        if (!storageKey) {
            return;
        }

        fieldNames.forEach(function (fieldName) {
            var field = postEditorForm.querySelector("[name='" + fieldName + "']");
            if (field) {
                payload[fieldName] = field.value || "";
            }
        });

        if (postMarkdownEditor) {
            payload.content = postMarkdownEditor.value() || "";
        } else {
            var contentField = postEditorForm.querySelector("[name='content']");
            payload.content = contentField ? contentField.value || "" : "";
        }

        try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (_error) {
            return;
        }
    }

    function restorePostEditorDraft() {
        var storageKey = getPostEditorRecoveryKey();
        var rawPayload = "";
        var payload = null;

        if (!storageKey) {
            return;
        }

        try {
            rawPayload = window.sessionStorage.getItem(storageKey) || "";
        } catch (_error) {
            return;
        }

        if (!rawPayload) {
            return;
        }

        try {
            payload = JSON.parse(rawPayload);
        } catch (_error) {
            window.sessionStorage.removeItem(storageKey);
            return;
        }

        ["title", "slug", "summary", "tag_names"].forEach(function (fieldName) {
            var field = postEditorForm.querySelector("[name='" + fieldName + "']");
            if (field && typeof payload[fieldName] === "string") {
                field.value = payload[fieldName];
            }
        });

        if (typeof payload.content === "string") {
            if (postMarkdownEditor) {
                postMarkdownEditor.value(payload.content);
            }

            if (markdownEditorNodes.length) {
                markdownEditorNodes[0].value = payload.content;
            }
        }

        window.sessionStorage.removeItem(storageKey);
    }

    function humanizeCalloutType(calloutType) {
        var labelMap = {
            note: "Note",
            tip: "Tip",
            important: "Important",
            caution: "Caution",
            warning: "Warning"
        };

        return labelMap[calloutType] || calloutType;
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
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
        tooltip.addEventListener("mouseenter", function () {
            clearPostLinkPreviewHideTimer();
        });
        tooltip.addEventListener("mouseleave", function () {
            schedulePostLinkPreviewHide();
        });

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
        var maxLeft = 0;

        if (!tooltip || !anchorElement) {
            return;
        }

        anchorRect = anchorElement.getBoundingClientRect();
        tooltip.hidden = false;
        tooltip.classList.add("is-above");

        tooltipRect = tooltip.getBoundingClientRect();
        top = window.scrollY + anchorRect.top - tooltipRect.height - 12;
        left = window.scrollX + anchorRect.left;
        maxLeft = window.scrollX + window.innerWidth - tooltipRect.width - 12;
        left = Math.max(window.scrollX + 12, Math.min(left, maxLeft));

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
        } catch (error) {
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
        } catch (error) {
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

    function bindInternalPostLinkPreviews(rootNode) {
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

    function positionPicker(picker, anchorElement) {
        var buttonRect = null;

        if (!picker || !anchorElement) {
            return;
        }

        buttonRect = anchorElement.getBoundingClientRect();
        picker.hidden = false;
        picker.style.top = window.scrollY + buttonRect.bottom + 10 + "px";
        picker.style.left = window.scrollX + Math.max(12, buttonRect.left) + "px";
    }

    function isPickerButtonClick(eventTarget, editor, toolbarItemName) {
        var toolbarButton = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;

        return Boolean(toolbarButton && (toolbarButton === eventTarget || toolbarButton.contains(eventTarget)));
    }

    function cloneCodeMirrorPosition(position) {
        if (!position) {
            return null;
        }

        return {
            line: position.line,
            ch: position.ch,
        };
    }

    function captureEditorSelection(editor) {
        var doc = null;

        if (!editor || !editor.codemirror) {
            return null;
        }

        doc = editor.codemirror.getDoc();
        return {
            from: cloneCodeMirrorPosition(doc.getCursor("from")),
            to: cloneCodeMirrorPosition(doc.getCursor("to")),
        };
    }

    function restoreEditorSelection(editor, selectionState) {
        var doc = null;

        if (!editor || !editor.codemirror || !selectionState || !selectionState.from || !selectionState.to) {
            return;
        }

        doc = editor.codemirror.getDoc();
        doc.setSelection(selectionState.from, selectionState.to);
        editor.codemirror.focus();
    }

    function restoreActiveContextEditorSelection(editor) {
        if (!editor || editor !== activeContextToolbarEditor || !editorContextSelectionState) {
            return;
        }

        restoreEditorSelection(editor, editorContextSelectionState);
    }

    function getEditorString(editor, attributeName, fallback) {
        if (!editor || !editor.element) {
            return fallback || "";
        }

        return editor.element.getAttribute(attributeName) || fallback || "";
    }

    function insertMarkdownLink(editor, displayName, url) {
        var label = (displayName || "").trim() || "Link";
        var href = (url || "").trim();

        if (!editor || !editor.codemirror || !href) {
            return;
        }

        editor.codemirror.replaceSelection("[" + label + "](" + href + ")");
        editor.codemirror.focus();
    }

    function insertMarkdownImageTemplate(editor) {
        if (!editor || !editor.codemirror) {
            return;
        }

        editor.codemirror.replaceSelection("![alt](url)");
        editor.codemirror.focus();
    }

    function buildMarkdownTableFromText(value) {
        var rows = (value || "")
            .split(/\r?\n/)
            .map(function (line) {
                var normalized = line.indexOf("|") >= 0 ? line.split("|") : line.split("\t");
                return normalized.map(function (cell) {
                    return cell.trim();
                });
            })
            .filter(function (row) {
                return row.some(function (cell) {
                    return cell !== "";
                });
            });
        var maxColumns = 0;

        if (!rows.length) {
            return "";
        }

        rows.forEach(function (row) {
            maxColumns = Math.max(maxColumns, row.length);
        });

        rows = rows.map(function (row) {
            var padded = row.slice();
            while (padded.length < maxColumns) {
                padded.push("");
            }
            return padded;
        });

        return [
            "| " + rows[0].join(" | ") + " |",
            "| " + rows[0].map(function () { return "---"; }).join(" | ") + " |"
        ]
            .concat(
                rows.slice(1).map(function (row) {
                    return "| " + row.join(" | ") + " |";
                })
            )
            .join("\n");
    }

    function buildMarkdownTableFromGrid(rows) {
        var normalizedRows = (rows || []).filter(function (row) {
            return Array.isArray(row) && row.length;
        });

        if (!normalizedRows.length) {
            return "";
        }

        return [
            "| " + normalizedRows[0].join(" | ") + " |",
            "| " + normalizedRows[0].map(function () { return "---"; }).join(" | ") + " |"
        ]
            .concat(
                normalizedRows.slice(1).map(function (row) {
                    return "| " + row.join(" | ") + " |";
                })
            )
            .join("\n");
    }

    function clearToolbarHoverMenuTimer() {
        if (toolbarHoverMenuTimer) {
            window.clearTimeout(toolbarHoverMenuTimer);
            toolbarHoverMenuTimer = 0;
        }
    }

    function ensureToolbarHoverMenu() {
        if (toolbarHoverMenu) {
            return toolbarHoverMenu;
        }

        toolbarHoverMenu = document.createElement("div");
        toolbarHoverMenu.className = "editor-toolbar-hover-menu";
        toolbarHoverMenu.hidden = true;
        toolbarHoverMenu.addEventListener("mouseenter", function () {
            clearToolbarHoverMenuTimer();
        });
        toolbarHoverMenu.addEventListener("mouseleave", function () {
            scheduleToolbarHoverMenuClose();
        });
        document.body.appendChild(toolbarHoverMenu);
        return toolbarHoverMenu;
    }

    function closeToolbarHoverMenu() {
        clearToolbarHoverMenuTimer();
        if (!toolbarHoverMenu) {
            return;
        }

        toolbarHoverMenu.hidden = true;
        toolbarHoverMenu.innerHTML = "";
        toolbarHoverMenu.removeAttribute("data-toolbar-hover-owner");
    }

    function ensureTableContextMenu() {
        if (tableContextMenu) {
            return tableContextMenu;
        }

        tableContextMenu = document.createElement("div");
        tableContextMenu.className = "editor-table-context-menu";
        tableContextMenu.hidden = true;
        document.body.appendChild(tableContextMenu);
        return tableContextMenu;
    }

    function closeTableContextMenu() {
        if (!tableContextMenu) {
            return;
        }

        tableContextMenu.hidden = true;
        tableContextMenu.innerHTML = "";
        tableContextMenuState = null;
    }

    function ensureEditorContextToolbar() {
        if (editorContextToolbar) {
            return editorContextToolbar;
        }

        editorContextToolbar = document.createElement("div");
        editorContextToolbar.className = "editor-context-toolbar";
        editorContextToolbar.hidden = true;
        document.body.appendChild(editorContextToolbar);
        return editorContextToolbar;
    }

    function closeEditorContextToolbar() {
        if (!editorContextToolbar) {
            return;
        }

        editorContextToolbar.hidden = true;
        editorContextToolbar.innerHTML = "";
        activeContextToolbarEditor = null;
        editorContextSelectionState = null;
    }

    function positionContextMenu(menu, event) {
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

    function openTableContextMenu(event, actions, state) {
        var menu = ensureTableContextMenu();

        if (!menu || !actions || !actions.length) {
            return;
        }

        menu.innerHTML = "";
        tableContextMenuState = state || null;

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
                closeTableContextMenu();
            });
            menu.appendChild(item);
        });

        menu.hidden = false;
        positionContextMenu(menu, event);
    }

    function scheduleToolbarHoverMenuClose() {
        clearToolbarHoverMenuTimer();
        toolbarHoverMenuTimer = window.setTimeout(function () {
            closeToolbarHoverMenu();
        }, 120);
    }

    function openToolbarHoverMenu(editor, toolbarItemName, actions) {
        var menu = ensureToolbarHoverMenu();
        var button = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;

        if (!menu || !button || !actions || !actions.length) {
            return;
        }

        clearToolbarHoverMenuTimer();
        menu.innerHTML = "";
        menu.setAttribute("data-toolbar-hover-owner", toolbarItemName);

        actions.forEach(function (action) {
            var item = document.createElement("button");
            var icon = document.createElement("i");
            var label = document.createElement("span");
            item.type = "button";
            item.className = "editor-toolbar-hover-action";
            item.setAttribute("title", action.label || "");
            item.setAttribute("aria-label", action.label || "");
            icon.className = action.iconClass || "fa-solid fa-circle";
            icon.setAttribute("aria-hidden", "true");
            label.className = "sr-only";
            label.textContent = action.label || "";
            item.appendChild(icon);
            item.appendChild(label);
            item.addEventListener("click", function () {
                if (typeof action.onClick === "function") {
                    action.onClick();
                }
                closeToolbarHoverMenu();
            });
            menu.appendChild(item);
        });

        positionPicker(menu, button);
    }

    function openEditorContextToolbar(event, editor) {
        var menu = ensureEditorContextToolbar();
        var actions = [];

        if (!menu || !editor || !editor.codemirror) {
            return;
        }

        actions = [
            {
                label: getEditorString(editor, "data-link-title", "Insert link"),
                iconClass: "fa-solid fa-link",
                onClick: function () {
                    restoreActiveContextEditorSelection(editor);
                    openLinkDialog(editor);
                }
            },
            {
                label: getEditorString(editor, "data-link-reference-label", "Reference internal post"),
                iconClass: "fa-solid fa-file-lines",
                onClick: function () {
                    restoreActiveContextEditorSelection(editor);
                    openInternalReferenceDialog(editor);
                }
            },
            {
                label: getEditorString(editor, "data-image-upload-label", "Upload image"),
                iconClass: "fa-solid fa-cloud-arrow-up",
                onClick: function () {
                    restoreActiveContextEditorSelection(editor);
                    openMarkdownImageUpload(editor);
                }
            },
            {
                label: getEditorString(editor, "data-table-title", "Insert table"),
                iconClass: "fa-solid fa-table",
                onClick: function () {
                    restoreActiveContextEditorSelection(editor);
                    openTableDialog(editor, 3, 3);
                }
            },
            {
                label: "Text color",
                iconClass: "fa-solid fa-palette",
                onClick: function (trigger) {
                    restoreActiveContextEditorSelection(editor);
                    openColorPicker(editor, trigger);
                }
            },
            {
                label: "Insert emoji",
                iconClass: "fa-solid fa-face-smile",
                onClick: function (trigger) {
                    restoreActiveContextEditorSelection(editor);
                    openEmojiPicker(editor, trigger);
                }
            }
        ];

        event.preventDefault();
        event.stopPropagation();
        closeTableContextMenu();
        closeTablePicker();
        closeToolbarHoverMenu();
        closeColorPicker();
        closeEmojiPicker();

        menu.innerHTML = "";
        activeContextToolbarEditor = editor;
        editorContextSelectionState = captureEditorSelection(editor);

        actions.forEach(function (action) {
            var button = document.createElement("button");
            var icon = document.createElement("i");
            var label = document.createElement("span");

            button.type = "button";
            button.className = "editor-context-toolbar-item";
            button.setAttribute("aria-label", action.label || "");
            button.setAttribute("title", action.label || "");
            button.addEventListener("click", function (clickEvent) {
                clickEvent.preventDefault();
                clickEvent.stopPropagation();
                if (typeof action.onClick === "function") {
                    action.onClick(button);
                }
                closeEditorContextToolbar();
            });

            icon.className = action.iconClass || "fa-solid fa-circle";
            icon.setAttribute("aria-hidden", "true");

            label.className = "editor-context-toolbar-label";
            label.textContent = action.label || "";

            button.appendChild(icon);
            button.appendChild(label);
            menu.appendChild(button);
        });

        menu.hidden = false;
        positionContextMenu(menu, event);
    }

    function bindToolbarHoverMenu(editor, toolbarItemName, actions) {
        var button = editor && editor.toolbarElements ? editor.toolbarElements[toolbarItemName] : null;

        if (!button || !actions || !actions.length) {
            return;
        }

        button.addEventListener("mouseenter", function () {
            openToolbarHoverMenu(editor, toolbarItemName, actions);
        });
        button.addEventListener("mouseleave", function () {
            scheduleToolbarHoverMenuClose();
        });
        button.addEventListener("focus", function () {
            openToolbarHoverMenu(editor, toolbarItemName, actions);
        });
        button.addEventListener("blur", function () {
            scheduleToolbarHoverMenuClose();
        });
    }

    function openInternalReferenceDialog(editor) {
        var searchUrl = getEditorString(editor, "data-reference-search-url", "");
        var container = document.createElement("div");
        var input = document.createElement("input");
        var results = document.createElement("div");
        var resultsGrid = document.createElement("div");
        var pagination = document.createElement("div");
        var paginationStatus = document.createElement("div");
        var paginationActions = document.createElement("div");
        var previousButton = document.createElement("button");
        var nextButton = document.createElement("button");
        var emptyLabel = getEditorString(editor, "data-reference-empty-label", "No posts found.");
        var title = getEditorString(editor, "data-reference-title", "Reference internal post");
        var kicker = getEditorString(editor, "data-reference-kicker", "Posts");
        var cancelLabel = getEditorString(editor, "data-link-cancel-label", "Cancel");
        var searchPlaceholder = getEditorString(editor, "data-reference-search-placeholder", "Search posts");
        var requestId = 0;
        var activePage = 1;
        var latestQuery = "";

        if (!searchUrl) {
            return;
        }

        activeReferenceEditor = editor;
        container.className = "editor-modal-form editor-reference-dialog";
        input.className = "input-control";
        input.placeholder = searchPlaceholder;
        results.className = "editor-reference-results";
        resultsGrid.className = "post-grid editor-reference-grid";
        pagination.className = "editor-dialog-pagination pagination-panel";
        paginationStatus.className = "pagination-status";
        paginationActions.className = "pagination-actions";
        previousButton.type = "button";
        previousButton.className = "secondary-button pagination-button";
        previousButton.textContent = "Previous";
        nextButton.type = "button";
        nextButton.className = "secondary-button pagination-button";
        nextButton.textContent = "Next";
        paginationActions.appendChild(previousButton);
        paginationActions.appendChild(nextButton);
        pagination.appendChild(paginationStatus);
        pagination.appendChild(paginationActions);
        results.appendChild(resultsGrid);
        container.appendChild(input);
        container.appendChild(results);
        container.appendChild(pagination);

        function updatePagination(paginationData, hasItems) {
            var page = paginationData && paginationData.page ? paginationData.page : 1;
            var totalPages = paginationData && paginationData.total_pages ? paginationData.total_pages : 1;
            var hasPrevious = Boolean(paginationData && paginationData.has_previous);
            var hasNext = Boolean(paginationData && paginationData.has_next);

            activePage = page;
            pagination.hidden = !hasItems && totalPages <= 1;
            paginationStatus.textContent = "Page: " + page + " / " + totalPages;
            previousButton.disabled = !hasPrevious;
            nextButton.disabled = !hasNext;
            previousButton.classList.toggle("is-disabled", !hasPrevious);
            nextButton.classList.toggle("is-disabled", !hasNext);
        }

        function renderResults(items) {
            results.innerHTML = "";
            if (!items.length) {
                resultsGrid.hidden = true;
                var empty = document.createElement("p");
                empty.className = "field-help";
                empty.textContent = emptyLabel;
                results.appendChild(empty);
                return;
            }

            resultsGrid.hidden = false;
            results.appendChild(resultsGrid);
            resultsGrid.innerHTML = "";

            items.forEach(function (item) {
                var wrapper = document.createElement("div");
                var card = null;
                var trigger = null;

                wrapper.innerHTML = item.html || "";
                card = wrapper.firstElementChild;
                trigger = wrapper.querySelector("[data-post-card-select]");
                if (!card || !trigger) {
                    return;
                }

                trigger.addEventListener("click", function () {
                    insertMarkdownLink(activeReferenceEditor, item.title, item.url);
                    closeModal();
                });
                resultsGrid.appendChild(card);
            });
        }

        function fetchResults(query, page) {
            requestId += 1;
            var currentRequestId = requestId;
            var queryText = typeof query === "string" ? query : "";
            var targetPage = page || 1;
            latestQuery = queryText;

            fetch(searchUrl + "?q=" + encodeURIComponent(queryText) + "&page=" + encodeURIComponent(String(targetPage)), { credentials: "same-origin" })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, items: [], pagination: null };
                    });
                })
                .then(function (payload) {
                    if (currentRequestId !== requestId) {
                        return;
                    }
                    var items = payload.ok ? (payload.items || []) : [];
                    renderResults(items);
                    updatePagination(payload.ok ? payload.pagination : null, items.length > 0);
                })
                .catch(function () {
                    if (currentRequestId !== requestId) {
                        return;
                    }
                    renderResults([]);
                    updatePagination(null, false);
                });
        }

        input.addEventListener("input", function () {
            fetchResults(input.value, 1);
        });
        previousButton.addEventListener("click", function () {
            if (previousButton.disabled || activePage <= 1) {
                return;
            }
            fetchResults(latestQuery, activePage - 1);
        });
        nextButton.addEventListener("click", function () {
            if (nextButton.disabled) {
                return;
            }
            fetchResults(latestQuery, activePage + 1);
        });

        openModal({
            kicker: kicker,
            title: title,
            contentNode: container,
            cancelText: cancelLabel,
            dialogClass: "is-wide-dialog",
        });

        fetchResults("", 1);
        window.setTimeout(function () {
            input.focus();
        }, 0);
    }

    function openLinkDialog(editor) {
        var container = document.createElement("div");
        var nameInput = document.createElement("input");
        var urlInput = document.createElement("input");
        var hint = document.createElement("p");

        container.className = "editor-modal-form";
        nameInput.className = "input-control";
        nameInput.placeholder = getEditorString(editor, "data-link-display-name-label", "Display name");
        urlInput.className = "input-control";
        urlInput.placeholder = getEditorString(editor, "data-link-url-label", "URL");
        hint.className = "field-help";
        hint.textContent = getEditorString(editor, "data-link-help", "Enter display text and the target URL.");
        container.appendChild(nameInput);
        container.appendChild(urlInput);
        container.appendChild(hint);

        openModal({
            kicker: getEditorString(editor, "data-link-kicker", "Markdown"),
            title: getEditorString(editor, "data-link-title", "Insert link"),
            contentNode: container,
            cancelText: getEditorString(editor, "data-link-cancel-label", "Cancel"),
            confirmText: getEditorString(editor, "data-link-confirm-label", "Insert"),
            onConfirm: function () {
                insertMarkdownLink(editor, nameInput.value, urlInput.value);
            }
        });

        window.setTimeout(function () {
            nameInput.focus();
        }, 0);
    }

    function openTableDialog(editor, rowCount, columnCount) {
        var rows = [];
        var rowsTotal = Math.max(2, rowCount || 3);
        var columnsTotal = Math.max(1, columnCount || 3);
        var container = document.createElement("div");
        var summary = document.createElement("div");
        var tableShell = document.createElement("div");
        var helper = document.createElement("p");
        var tableHelpPrimary = getEditorString(editor, "data-table-help-context-label", "Right-click a cell to insert or remove rows and columns.");
        var tableHelpSecondary = getEditorString(editor, "data-table-help-paste-label", "Use tabs or | to paste cells, one row per line.");
        var contextLabels = {
            insertRowAbove: getEditorString(editor, "data-table-insert-row-above-label", "Insert row above"),
            insertRowBelow: getEditorString(editor, "data-table-insert-row-below-label", "Insert row below"),
            insertColumnLeft: getEditorString(editor, "data-table-insert-column-left-label", "Insert column left"),
            insertColumnRight: getEditorString(editor, "data-table-insert-column-right-label", "Insert column right"),
            removeRow: getEditorString(editor, "data-table-remove-row-label", "Remove row"),
            removeColumn: getEditorString(editor, "data-table-remove-column-label", "Remove column")
        };

        function focusCell(targetRowIndex, targetColumnIndex) {
            window.requestAnimationFrame(function () {
                var selector = '[data-table-row-index="' + targetRowIndex + '"][data-table-column-index="' + targetColumnIndex + '"]';
                var input = tableShell.querySelector(selector);
                if (input) {
                    input.focus();
                    if (typeof input.select === "function") {
                        input.select();
                    }
                }
            });
        }

        function insertRowAt(rowIndex) {
            rows.splice(rowIndex, 0, createEmptyRow(rows[0].length));
            renderGrid();
            focusCell(rowIndex, 0);
        }

        function insertColumnAt(columnIndex) {
            rows.forEach(function (row) {
                row.splice(columnIndex, 0, "");
            });
            renderGrid();
            focusCell(0, columnIndex);
        }

        function removeRowAt(rowIndex) {
            if (rows.length <= 2) {
                return;
            }
            rows.splice(rowIndex, 1);
            renderGrid();
            focusCell(Math.min(rowIndex, rows.length - 1), 0);
        }

        function removeColumnAt(columnIndex) {
            if (rows[0].length <= 1) {
                return;
            }
            rows.forEach(function (row) {
                row.splice(columnIndex, 1);
            });
            renderGrid();
            focusCell(0, Math.min(columnIndex, rows[0].length - 1));
        }

        function openCellContextMenu(event, rowIndex, columnIndex) {
            event.preventDefault();
            event.stopPropagation();
            openTableContextMenu(
                event,
                [
                    {
                        label: contextLabels.insertRowAbove,
                        onClick: function () {
                            insertRowAt(rowIndex);
                        }
                    },
                    {
                        label: contextLabels.insertRowBelow,
                        onClick: function () {
                            insertRowAt(rowIndex + 1);
                        }
                    },
                    {
                        label: contextLabels.insertColumnLeft,
                        onClick: function () {
                            insertColumnAt(columnIndex);
                        }
                    },
                    {
                        label: contextLabels.insertColumnRight,
                        onClick: function () {
                            insertColumnAt(columnIndex + 1);
                        }
                    },
                    {
                        label: contextLabels.removeRow,
                        disabled: rows.length <= 2,
                        isDanger: true,
                        onClick: function () {
                            removeRowAt(rowIndex);
                        }
                    },
                    {
                        label: contextLabels.removeColumn,
                        disabled: rows[0].length <= 1,
                        isDanger: true,
                        onClick: function () {
                            removeColumnAt(columnIndex);
                        }
                    }
                ],
                { rowIndex: rowIndex, columnIndex: columnIndex }
            );
        }

        function createEmptyRow(size) {
            var row = [];
            var index = 0;
            for (index = 0; index < size; index += 1) {
                row.push("");
            }
            return row;
        }

        function renderGrid() {
            var table = document.createElement("table");
            var thead = document.createElement("thead");
            var tbody = document.createElement("tbody");
            var headerRow = document.createElement("tr");

            table.className = "editor-table-dialog-grid";
            tableShell.innerHTML = "";

            rows[0].forEach(function (_cell, columnIndex) {
                var headerCell = document.createElement("th");
                var input = document.createElement("input");
                input.type = "text";
                input.className = "input-control editor-table-dialog-input editor-table-dialog-input-header";
                input.setAttribute("data-table-row-index", "0");
                input.setAttribute("data-table-column-index", String(columnIndex));
                input.placeholder = "Header " + (columnIndex + 1);
                input.value = rows[0][columnIndex];
                input.addEventListener("input", function () {
                    rows[0][columnIndex] = input.value;
                });
                headerCell.addEventListener("contextmenu", function (event) {
                    openCellContextMenu(event, 0, columnIndex);
                });
                input.addEventListener("contextmenu", function (event) {
                    openCellContextMenu(event, 0, columnIndex);
                });
                headerCell.appendChild(input);
                headerRow.appendChild(headerCell);
            });
            thead.appendChild(headerRow);

            rows.slice(1).forEach(function (row, rowIndex) {
                var bodyRow = document.createElement("tr");
                row.forEach(function (_cell, columnIndex) {
                    var bodyCell = document.createElement("td");
                    var input = document.createElement("input");
                    input.type = "text";
                    input.className = "input-control editor-table-dialog-input";
                    input.setAttribute("data-table-row-index", String(rowIndex + 1));
                    input.setAttribute("data-table-column-index", String(columnIndex));
                    input.value = rows[rowIndex + 1][columnIndex];
                    input.addEventListener("input", function () {
                        rows[rowIndex + 1][columnIndex] = input.value;
                    });
                    bodyCell.addEventListener("contextmenu", function (event) {
                        openCellContextMenu(event, rowIndex + 1, columnIndex);
                    });
                    input.addEventListener("contextmenu", function (event) {
                        openCellContextMenu(event, rowIndex + 1, columnIndex);
                    });
                    bodyCell.appendChild(input);
                    bodyRow.appendChild(bodyCell);
                });
                tbody.appendChild(bodyRow);
            });

            table.appendChild(thead);
            table.appendChild(tbody);
            tableShell.appendChild(table);
            summary.textContent = rows.length + " x " + rows[0].length;

            if (tableContextMenuState) {
                focusCell(
                    Math.min(tableContextMenuState.rowIndex, rows.length - 1),
                    Math.min(tableContextMenuState.columnIndex, rows[0].length - 1)
                );
            }
        }

        while (rows.length < rowsTotal) {
            rows.push(createEmptyRow(columnsTotal));
        }

        container.className = "editor-modal-form editor-table-dialog";
        summary.className = "editor-table-dialog-summary";
        tableShell.className = "editor-table-dialog-shell";
        helper.className = "field-help";
        helper.innerHTML = escapeHtml(tableHelpPrimary) + "<br>" + escapeHtml(tableHelpSecondary);
        container.appendChild(summary);
        container.appendChild(tableShell);
        container.appendChild(helper);

        renderGrid();

        openModal({
            kicker: getEditorString(editor, "data-table-kicker", "Markdown"),
            title: getEditorString(editor, "data-table-title", "Insert table"),
            dialogClass: "is-table-dialog",
            contentNode: container,
            cancelText: getEditorString(editor, "data-link-cancel-label", "Cancel"),
            confirmText: getEditorString(editor, "data-table-confirm-label", "Insert"),
            onCancel: function () {
                closeTableContextMenu();
            },
            onConfirm: function () {
                closeTableContextMenu();
                var markdown = buildMarkdownTableFromGrid(rows);

                if (!markdown || !editor || !editor.codemirror) {
                    return;
                }

                editor.codemirror.replaceSelection(markdown);
                editor.codemirror.focus();
            }
        });

        window.setTimeout(function () {
            var firstInput = tableShell.querySelector("input");
            if (firstInput) {
                firstInput.focus();
            }
        }, 0);
    }

    function createTablePicker() {
        var picker = null;
        var summary = null;
        var grid = null;
        var maxRows = 6;
        var maxColumns = 6;
        var row = 0;
        var column = 0;

        if (tablePicker) {
            return tablePicker;
        }

        picker = document.createElement("div");
        summary = document.createElement("div");
        grid = document.createElement("div");
        picker.className = "editor-table-picker";
        picker.hidden = true;
        picker.setAttribute("data-editor-table-picker", "true");
        summary.className = "editor-table-picker-summary";
        summary.textContent = "Select table size";
        grid.className = "editor-table-picker-grid";

        function updateTablePickerState(rowCount, columnCount) {
            summary.textContent = rowCount + " x " + columnCount;

            Array.prototype.forEach.call(grid.children, function (cell) {
                var cellRow = Number(cell.getAttribute("data-row") || "0");
                var cellColumn = Number(cell.getAttribute("data-column") || "0");
                var isActive = cellRow <= rowCount && cellColumn <= columnCount;
                cell.classList.toggle("is-active", isActive);
            });
        }

        for (row = 1; row <= maxRows; row += 1) {
            for (column = 1; column <= maxColumns; column += 1) {
                var cell = document.createElement("button");
                cell.type = "button";
                cell.className = "editor-table-picker-cell";
                cell.setAttribute("data-row", String(row));
                cell.setAttribute("data-column", String(column));
                cell.setAttribute("aria-label", row + " x " + column);
                cell.addEventListener("mouseenter", function () {
                    updateTablePickerState(Number(this.getAttribute("data-row")), Number(this.getAttribute("data-column")));
                });
                cell.addEventListener("focus", function () {
                    updateTablePickerState(Number(this.getAttribute("data-row")), Number(this.getAttribute("data-column")));
                });
                cell.addEventListener("click", function () {
                    var selectedEditor = activeTableEditor;
                    var selectedRows = Number(this.getAttribute("data-row"));
                    var selectedColumns = Number(this.getAttribute("data-column"));
                    closeTablePicker();
                    openTableDialog(selectedEditor, selectedRows, selectedColumns);
                });
                grid.appendChild(cell);
            }
        }

        picker.addEventListener("mouseleave", function () {
            summary.textContent = "Select table size";
            Array.prototype.forEach.call(grid.children, function (cell) {
                cell.classList.remove("is-active");
            });
        });

        picker.appendChild(summary);
        picker.appendChild(grid);
        document.body.appendChild(picker);
        tablePicker = picker;
        return tablePicker;
    }

    function closeTablePicker() {
        if (!tablePicker) {
            return;
        }

        tablePicker.hidden = true;
        activeTableEditor = null;
    }

    function wrapSelectionWithColor(editor, colorClass) {
        var doc = null;
        var selection = "";
        var placeholder = "Colored text";
        var cursor = null;
        var prefix = '<span class="' + colorClass + '">';

        if (!editor || !editor.codemirror || !colorClass) {
            return;
        }

        doc = editor.codemirror.getDoc();
        selection = doc.getSelection();
        cursor = doc.getCursor("from");
        doc.replaceSelection(prefix + escapeHtml(selection || placeholder) + "</span>");

        if (!selection) {
            doc.setSelection(
                { line: cursor.line, ch: cursor.ch + prefix.length },
                { line: cursor.line, ch: cursor.ch + prefix.length + placeholder.length }
            );
        }

        editor.codemirror.focus();
    }

    function insertEmoji(editor, emoji) {
        if (!editor || !editor.codemirror || !emoji) {
            return;
        }

        editor.codemirror.replaceSelection(emoji);
        editor.codemirror.focus();
    }

    function renderMarkdownHtml(plainText, markdownRenderer) {
        return markdownRenderer(plainText || "");
    }

    function renderMarkdownPreviewFallback(plainText, markdownRenderer) {
        return renderMarkdownPreview(plainText, markdownRenderer);
    }

    function requestRenderedMarkdown(previewElement, plainText, previewUrl, fallbackRenderer) {
        var requestId = 0;
        var csrfToken = getCsrfToken();
        var body = null;

        if (!previewElement || !previewUrl || !csrfToken) {
            previewElement.innerHTML = renderMarkdownPreviewFallback(plainText, fallbackRenderer);
            enhanceMarkdownContainer(previewElement);
            return;
        }

        requestId = markdownPreviewRequestId + 1;
        markdownPreviewRequestId = requestId;
        previewElement.setAttribute("data-markdown-preview-request-id", String(requestId));

        body = new URLSearchParams();
        body.append("content", plainText || "");
        body.append("csrfmiddlewaretoken", csrfToken);

        fetch(previewUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: body.toString(),
            credentials: "same-origin"
        }).then(function (response) {
            return response.json().catch(function () {
                return { ok: false, html: "" };
            }).then(function (data) {
                return {
                    ok: response.ok && data.ok,
                    html: data.html || ""
                };
            });
        }).then(function (result) {
            if (previewElement.getAttribute("data-markdown-preview-request-id") !== String(requestId)) {
                return;
            }

            if (!result.ok) {
                throw new Error("Markdown preview request failed.");
            }

            previewElement.innerHTML = result.html;
            enhanceMarkdownContainer(previewElement);
        }).catch(function () {
            if (previewElement.getAttribute("data-markdown-preview-request-id") !== String(requestId)) {
                return;
            }

            previewElement.innerHTML = renderMarkdownPreviewFallback(plainText, fallbackRenderer);
            enhanceMarkdownContainer(previewElement);
        });
    }

    function normalizeNestedTables(plainText) {
        var lines = (plainText || "").split(/\r?\n/);
        var normalizedLines = [];
        var index = 0;

        while (index < lines.length) {
            var line = lines[index];
            var listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+.*$/);

            normalizedLines.push(line);

            if (!listMatch) {
                index += 1;
                continue;
            }

            var listIndent = listMatch[1].length;
            var tableLines = [];
            var lookAhead = index + 1;

            while (lookAhead < lines.length) {
                var nextLine = lines[lookAhead];
                var stripped = nextLine.trim();
                var nextIndent = nextLine.length - nextLine.replace(/^\s*/, "").length;

                if (!stripped || nextIndent <= listIndent || stripped.charAt(0) !== "|") {
                    break;
                }

                tableLines.push(nextLine);
                lookAhead += 1;
            }

            if (tableLines.length >= 2) {
                normalizedLines.push("");
                Array.prototype.push.apply(normalizedLines, tableLines);
                index = lookAhead;
                continue;
            }

            index += 1;
        }

        return normalizedLines.join("\n");
    }

    function normalizeIndentedTables(plainText) {
        return (plainText || "").split(/\r?\n/).map(function (line) {
            return line.indexOf("    |") === 0 ? line.slice(4) : line;
        }).join("\n");
    }

    function hasListSyntax(plainText) {
        return /^\s*(?:[-+*]|\d+\.)\s+/m.test(plainText || "");
    }

    function parsePipeTable(tableLines) {
        function splitRow(row) {
            var stripped = row.trim();
            if (stripped.charAt(0) === "|") {
                stripped = stripped.slice(1);
            }
            if (stripped.charAt(stripped.length - 1) === "|") {
                stripped = stripped.slice(0, -1);
            }
            return stripped.split("|").map(function (cell) {
                return cell.trim();
            });
        }

        var separatorRe = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
        var headers = [];
        var rows = [];

        if (!tableLines || tableLines.length < 2 || !separatorRe.test(tableLines[1])) {
            return "";
        }

        headers = splitRow(tableLines[0]);
        rows = tableLines.slice(2).map(splitRow);

        return '<table><thead><tr>' + headers.map(function (header) {
            return '<th>' + escapeHtml(header) + '</th>';
        }).join("") + '</tr></thead><tbody>' + rows.map(function (row) {
            var padded = row.slice();
            while (padded.length < headers.length) {
                padded.push("");
            }
            return '<tr>' + padded.slice(0, headers.length).map(function (cell) {
                return '<td>' + escapeHtml(cell) + '</td>';
            }).join("") + '</tr>';
        }).join("") + '</tbody></table>';
    }

    function renderInlineMarkdown(text, markdownRenderer) {
        var rendered = renderMarkdownHtml(text || "", markdownRenderer);
        if (rendered.indexOf("<p>") === 0 && rendered.slice(-4) === "</p>") {
            return rendered.slice(3, -4);
        }
        return rendered;
    }

    function buildListItemHtml(bodyLines, markdownRenderer) {
        var paragraphLines = bodyLines.length ? [bodyLines[0]] : [];
        var extraBlocks = [];
        var index = 1;

        while (index < bodyLines.length) {
            var current = bodyLines[index];
            if (!current.trim()) {
                index += 1;
                continue;
            }

            if (current.trim().charAt(0) === "|") {
                var tableLines = [];
                var tableHtml = "";

                while (index < bodyLines.length && bodyLines[index].trim().charAt(0) === "|") {
                    tableLines.push(bodyLines[index]);
                    index += 1;
                }

                tableHtml = parsePipeTable(tableLines);
                if (tableHtml) {
                    extraBlocks.push(tableHtml);
                    continue;
                }

                extraBlocks.push(renderMarkdownHtml(tableLines.join("\n"), markdownRenderer));
                continue;
            }

            paragraphLines.push(current);
            index += 1;
        }

        return '<li>' + renderInlineMarkdown(paragraphLines.join("\n").trim(), markdownRenderer) + extraBlocks.join("") + '</li>';
    }

    function renderListBlocks(text, markdownRenderer) {
        var lines = (text || "").split(/\r?\n/);
        var renderedLines = [];
        var index = 0;

        while (index < lines.length) {
            var line = lines[index];
            var listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+(.*)$/);
            if (!listMatch) {
                renderedLines.push(line);
                index += 1;
                continue;
            }

            var listIndent = listMatch[1];
            var marker = listMatch[2];
            var listTag = /\.$/.test(marker) ? "ol" : "ul";
            var items = [];

            while (index < lines.length) {
                var itemMatch = lines[index].match(new RegExp("^" + listIndent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([-+*]|\\d+\\.)\\s+(.*)$"));
                if (!itemMatch) {
                    break;
                }

                var bodyLines = [itemMatch[2]];
                index += 1;
                while (index < lines.length) {
                    var candidate = lines[index];
                    var candidateIndent = candidate.length - candidate.replace(/^\s*/, "").length;
                    if (!candidate.trim()) {
                        bodyLines.push("");
                        index += 1;
                        continue;
                    }
                    if (candidateIndent <= listIndent.length) {
                        break;
                    }
                    bodyLines.push(candidate.slice(listIndent.length + 4));
                    index += 1;
                }

                items.push(buildListItemHtml(bodyLines, markdownRenderer));
            }

            renderedLines.push("<" + listTag + ">" + items.join("") + "</" + listTag + ">");
        }

        return renderedLines.join("\n");
    }

    function collectIndentedBlock(lines, startIndex, baseIndent) {
        var blockLines = [];
        var cursor = startIndex;

        while (cursor < lines.length) {
            var candidate = lines[cursor];
            if (!candidate.trim()) {
                blockLines.push("");
                cursor += 1;
                continue;
            }

            var indent = candidate.length - candidate.replace(/^\s*/, "").length;
            if (indent < baseIndent) {
                break;
            }

            blockLines.push(candidate.slice(baseIndent));
            cursor += 1;
        }

        while (blockLines.length && !blockLines[0].trim()) {
            blockLines.shift();
        }
        while (blockLines.length && !blockLines[blockLines.length - 1].trim()) {
            blockLines.pop();
        }

        return {
            lines: blockLines,
            nextIndex: cursor,
        };
    }

    function parseAdmonitionLine(line) {
        var match = line.match(/^\s*\?\?\?(\+)?\s+(note|tip|warning)(?:\s+"([^"]+)")?\s*$/i);

        if (!match) {
            return null;
        }

        return {
            isOpen: Boolean(match[1]),
            type: match[2].toLowerCase(),
            title: match[3] || "",
        };
    }

    function renderMarkdownPreview(plainText, markdownRenderer) {
        var lines = (plainText || "").split(/\r?\n/);
        var chunks = [];
        var markdownBuffer = [];
        var index = 0;

        function renderNormalizedMarkdown(text) {
            var normalized = normalizeNestedTables(text);
            if (hasListSyntax(normalized)) {
                return renderListBlocks(normalized, markdownRenderer);
            }
            return renderMarkdownHtml(normalizeIndentedTables(normalized), markdownRenderer);
        }

        function flushMarkdownBuffer() {
            if (!markdownBuffer.length) {
                return;
            }

            chunks.push(renderNormalizedMarkdown(markdownBuffer.join("\n")));
            markdownBuffer = [];
        }

        function renderTabs(tabItems) {
            var tabGroupId = "markdown-preview-tabs-" + markdownPreviewCounter;
            var navHtml = [];
            var panelHtml = [];

            markdownPreviewCounter += 1;

            tabItems.forEach(function (tabItem, tabIndex) {
                var isActive = tabIndex === 0;
                var targetId = tabGroupId + "-panel-" + tabIndex;
                navHtml.push(
                    '<button class="markdown-tab-button' + (isActive ? ' is-active' : '') + '" type="button" ' +
                    'data-tab-group="' + tabGroupId + '" data-tab-target="' + targetId + '" ' +
                    'aria-selected="' + (isActive ? 'true' : 'false') + '">' + escapeHtml(tabItem.title) + '</button>'
                );
                panelHtml.push(
                    '<section class="markdown-tab-panel' + (isActive ? ' is-active' : '') + '" ' +
                    'data-tab-panel="' + targetId + '" data-tab-group="' + tabGroupId + '"' +
                    (isActive ? '' : ' hidden') + '>' + renderNormalizedMarkdown(tabItem.content) + '</section>'
                );
            });

            return '<div class="markdown-tabs"><div class="markdown-tabs-nav">' + navHtml.join("") + '</div>' +
                '<div class="markdown-tabs-panels">' + panelHtml.join("") + '</div></div>';
        }

        function renderAdmonition(admonitionType, contentLines, title, isOpen) {
            return '<details class="markdown-admonition markdown-admonition-' + admonitionType + '"' + (isOpen ? ' open' : '') + '>' +
                '<summary class="markdown-admonition-summary">' + escapeHtml(title || humanizeCalloutType(admonitionType)) + '</summary>' +
                '<div class="markdown-admonition-body">' + renderNormalizedMarkdown(contentLines.join("\n")) + '</div>' +
                '</details>';
        }

        while (index < lines.length) {
            var line = lines[index];
            var calloutMatch = line.match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*(.*)$/i);
            var tabsMatch = line.match(/^\s*===\s+"([^"]+)"\s*$/);
            var admonitionMatch = parseAdmonitionLine(line);

            if (tabsMatch) {
                var tabItems = [];

                flushMarkdownBuffer();

                while (index < lines.length) {
                    var currentTabMatch = lines[index].match(/^\s*===\s+"([^"]+)"\s*$/);
                    var tabBlock = null;
                    if (!currentTabMatch) {
                        break;
                    }

                    tabBlock = collectIndentedBlock(lines, index + 1, 4);
                    tabItems.push({
                        title: currentTabMatch[1],
                        content: tabBlock.lines.join("\n"),
                    });
                    index = tabBlock.nextIndex;
                }

                if (tabItems.length) {
                    chunks.push(renderTabs(tabItems));
                }
                continue;
            }

            if (admonitionMatch) {
                var admonitionBlock = collectIndentedBlock(lines, index + 1, 4);

                flushMarkdownBuffer();
                chunks.push(renderAdmonition(admonitionMatch.type, admonitionBlock.lines, admonitionMatch.title, admonitionMatch.isOpen));
                index = admonitionBlock.nextIndex;
                continue;
            }

            if (!calloutMatch) {
                markdownBuffer.push(line);
                index += 1;
                continue;
            }

            flushMarkdownBuffer();

            var calloutType = calloutMatch[1].toLowerCase();
            var calloutLines = [];
            var inlineText = (calloutMatch[2] || "").trim();

            if (inlineText) {
                calloutLines.push(inlineText);
            }

            index += 1;
            while (index < lines.length) {
                var quotedMatch = lines[index].match(/^\s*>\s?(.*)$/);
                if (!quotedMatch) {
                    break;
                }

                calloutLines.push(quotedMatch[1]);
                index += 1;
            }

            chunks.push(
                '<blockquote class="markdown-callout markdown-callout-' + calloutType + '">' +
                '<p class="markdown-callout-title">' + humanizeCalloutType(calloutType) + '</p>' +
                renderNormalizedMarkdown(calloutLines.join("\n").trim()) +
                "</blockquote>"
            );
        }

        flushMarkdownBuffer();
        return chunks.join("");
    }

    function renderMathInContainer(container) {
        if (!container || !window.renderMathInElement) {
            return;
        }

        window.renderMathInElement(container, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\(", right: "\\)", display: false }
            ],
            throwOnError: false,
        });
    }

    function bindMarkdownTabs(rootNode) {
        if (!rootNode || rootNode.getAttribute("data-markdown-tabs-bound") === "true") {
            return;
        }

        rootNode.setAttribute("data-markdown-tabs-bound", "true");
        rootNode.addEventListener("click", function (event) {
            var button = event.target.closest(".markdown-tab-button");
            var targetId = "";
            var groupId = "";

            if (!button || !rootNode.contains(button)) {
                return;
            }

            targetId = button.getAttribute("data-tab-target") || "";
            groupId = button.getAttribute("data-tab-group") || "";

            Array.prototype.forEach.call(rootNode.querySelectorAll('.markdown-tab-button[data-tab-group="' + groupId + '"]'), function (tabButton) {
                var isActive = tabButton === button;
                tabButton.classList.toggle("is-active", isActive);
                tabButton.setAttribute("aria-selected", isActive ? "true" : "false");
            });

            Array.prototype.forEach.call(rootNode.querySelectorAll('.markdown-tab-panel[data-tab-group="' + groupId + '"]'), function (panel) {
                var isActive = panel.getAttribute("data-tab-panel") === targetId;
                panel.classList.toggle("is-active", isActive);
                panel.hidden = !isActive;
            });
        });
    }

    function copyTextToClipboard(value) {
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
            } catch (error) {
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

    function enhanceCodeCopyBlocks(rootNode) {
        var copyLabel = "";
        var copiedLabel = "";
        var failedLabel = "";

        if (!rootNode || rootNode.getAttribute("data-code-copy-enabled") !== "true") {
            return;
        }

        copyLabel = rootNode.getAttribute("data-code-copy-label") || "Copy";
        copiedLabel = rootNode.getAttribute("data-code-copied-label") || "Copied";
        failedLabel = rootNode.getAttribute("data-code-copy-failed-label") || "Failed";

        Array.prototype.forEach.call(rootNode.querySelectorAll("pre"), function (preNode) {
            var button = null;
            var codeNode = null;
            var codeText = "";
            var layoutNode = null;
            var resetTimer = null;

            function hasVisibleLineContent(lineModel) {
                return lineModel.nodes.length > 0;
            }

            function splitNodeIntoLines(node) {
                var childLines = null;
                var isHighlightedNode = false;
                var lines = [{nodes: [], highlighted: false}];
                var lastLine = null;
                var index = 0;
                var clone = null;

                if (!node) {
                    return lines;
                }

                if (node.nodeType === window.Node.TEXT_NODE) {
                    return (node.textContent || "").replace(/\r\n?/g, "\n").split("\n").map(function (part) {
                        return {
                            nodes: part ? [document.createTextNode(part)] : [],
                            highlighted: false,
                        };
                    });
                }

                if (node.nodeType !== window.Node.ELEMENT_NODE) {
                    return lines;
                }

                isHighlightedNode = node.classList.contains("hll");

                Array.prototype.forEach.call(node.childNodes, function (childNode) {
                    childLines = splitNodeIntoLines(childNode);
                    lastLine = lines[lines.length - 1];
                    Array.prototype.push.apply(lastLine.nodes, childLines[0].nodes);
                    lastLine.highlighted = lastLine.highlighted || childLines[0].highlighted;

                    for (index = 1; index < childLines.length; index += 1) {
                        lines.push(childLines[index]);
                    }
                });

                return lines.map(function (lineModel) {
                    if (!lineModel.nodes.length) {
                        return {
                            nodes: [],
                            highlighted: lineModel.highlighted || isHighlightedNode,
                        };
                    }

                    clone = node.cloneNode(false);
                    Array.prototype.forEach.call(lineModel.nodes, function (lineNode) {
                        clone.appendChild(lineNode);
                    });

                    return {
                        nodes: [clone],
                        highlighted: lineModel.highlighted || isHighlightedNode,
                    };
                });
            }

            function buildCodeLineModels(sourceCodeNode, rawText) {
                var lines = [{nodes: [], highlighted: false}];
                var childLines = null;
                var lastLine = null;
                var normalizedText = (rawText || "").replace(/\r\n?/g, "\n");
                var index = 0;

                Array.prototype.forEach.call(sourceCodeNode.childNodes, function (childNode) {
                    childLines = splitNodeIntoLines(childNode);
                    lastLine = lines[lines.length - 1];
                    Array.prototype.push.apply(lastLine.nodes, childLines[0].nodes);
                    lastLine.highlighted = lastLine.highlighted || childLines[0].highlighted;

                    for (index = 1; index < childLines.length; index += 1) {
                        lines.push(childLines[index]);
                    }
                });

                if (normalizedText.slice(-1) === "\n" && lines.length > 1 && !hasVisibleLineContent(lines[lines.length - 1])) {
                    lines.pop();
                }

                return lines.length ? lines : [{nodes: [], highlighted: false}];
            }

            function buildCodeBlockLayout(sourceCodeNode, rawText) {
                var lineModels = buildCodeLineModels(sourceCodeNode, rawText);
                var fragment = document.createDocumentFragment();
                var lineWrapper = null;
                var lineNumberNode = null;
                var lineContentNode = null;
                var index = 0;

                layoutNode = document.createElement("span");
                layoutNode.className = "code-block-layout";

                for (index = 0; index < lineModels.length; index += 1) {
                    lineWrapper = document.createElement("span");
                    lineWrapper.className = "code-line" + (lineModels[index].highlighted ? " is-highlighted" : "");

                    lineNumberNode = document.createElement("span");
                    lineNumberNode.className = "code-line-number";
                    lineNumberNode.setAttribute("aria-hidden", "true");
                    lineNumberNode.textContent = String(index + 1);

                    lineContentNode = document.createElement("span");
                    lineContentNode.className = "code-line-content";
                    Array.prototype.forEach.call(lineModels[index].nodes, function (lineNode) {
                        lineContentNode.appendChild(lineNode);
                    });

                    lineWrapper.appendChild(lineNumberNode);
                    lineWrapper.appendChild(lineContentNode);
                    fragment.appendChild(lineWrapper);
                }

                layoutNode.appendChild(fragment);
                return layoutNode;
            }

            function setButtonIcon(state) {
                var iconClassName = "fa-regular fa-copy";

                if (state === "copied") {
                    iconClassName = "fa-solid fa-check";
                } else if (state === "error") {
                    iconClassName = "fa-solid fa-xmark";
                }

                button.innerHTML = '<i class="' + iconClassName + '" aria-hidden="true"></i>';
            }

            if (preNode.getAttribute("data-code-copy-ready") === "true") {
                return;
            }

            codeNode = preNode.querySelector("code");
            codeText = codeNode ? (codeNode.textContent || "") : (preNode.textContent || "");

            if (codeNode && !preNode.querySelector(".code-block-layout")) {
                layoutNode = buildCodeBlockLayout(codeNode, codeText);
                preNode.insertBefore(layoutNode, codeNode);
                codeNode.remove();
            }

            function getCodeText() {
                return codeText;
            }

            function updateButtonState(label, stateClassName) {
                var iconState = "default";

                button.classList.remove("is-copied", "is-error");
                if (stateClassName) {
                    button.classList.add(stateClassName);
                }
                if (stateClassName === "is-copied") {
                    iconState = "copied";
                } else if (stateClassName === "is-error") {
                    iconState = "error";
                }
                setButtonIcon(iconState);
                button.setAttribute("aria-label", label);
                button.setAttribute("title", label);
            }

            preNode.setAttribute("data-code-copy-ready", "true");
            button = document.createElement("button");
            button.type = "button";
            button.className = "code-copy-button";
            updateButtonState(copyLabel, "");

            button.addEventListener("click", function () {
                var codeText = getCodeText();

                if (!codeText) {
                    return;
                }

                button.disabled = true;
                window.clearTimeout(resetTimer);

                copyTextToClipboard(codeText)
                    .then(function () {
                        updateButtonState(copiedLabel, "is-copied");
                    })
                    .catch(function () {
                        updateButtonState(failedLabel, "is-error");
                    })
                    .then(function () {
                        resetTimer = window.setTimeout(function () {
                            updateButtonState(copyLabel, "");
                            button.disabled = false;
                        }, 1800);
                    });
            });

            preNode.appendChild(button);
        });
    }

    function enhanceMarkdownContainer(rootNode) {
        if (!rootNode) {
            return;
        }

        bindMarkdownTabs(rootNode);
        renderMathInContainer(rootNode);
        enhanceCodeCopyBlocks(rootNode);
        bindInternalPostLinkPreviews(rootNode);
    }

    function createColorPicker() {
        var picker = null;
        var summary = null;
        var palette = null;

        if (colorPicker) {
            return colorPicker;
        }

        picker = document.createElement("div");
        summary = document.createElement("div");
        palette = document.createElement("div");

        picker.className = "editor-color-picker";
        picker.hidden = true;
        picker.setAttribute("data-editor-color-picker", "true");

        summary.className = "editor-color-picker-summary";
        summary.textContent = "Text color";

        palette.className = "editor-color-picker-grid";

        markdownTextColors.forEach(function (colorItem) {
            var button = document.createElement("button");
            var swatch = document.createElement("span");
            var label = document.createElement("span");

            button.type = "button";
            button.className = "editor-color-picker-swatch";
            button.setAttribute("aria-label", colorItem.label);
            button.setAttribute("title", colorItem.label);
            button.addEventListener("click", function () {
                wrapSelectionWithColor(activeColorEditor, colorItem.className);
                picker.hidden = true;
                activeColorEditor = null;
            });

            swatch.className = "editor-color-picker-dot";
            swatch.style.background = colorItem.color;

            label.className = "editor-color-picker-label";
            label.textContent = colorItem.label;

            button.appendChild(swatch);
            button.appendChild(label);
            palette.appendChild(button);
        });

        picker.appendChild(summary);
        picker.appendChild(palette);
        document.body.appendChild(picker);
        colorPicker = picker;
        return colorPicker;
    }

    function createEmojiPicker() {
        var picker = null;
        var summary = null;
        var grid = null;

        if (emojiPicker) {
            return emojiPicker;
        }

        picker = document.createElement("div");
        summary = document.createElement("div");
        grid = document.createElement("div");

        picker.className = "editor-emoji-picker";
        picker.hidden = true;
        picker.setAttribute("data-editor-emoji-picker", "true");

        summary.className = "editor-emoji-picker-summary";
        summary.textContent = "Insert emoji";

        grid.className = "editor-emoji-picker-grid";

        markdownEmojis.forEach(function (emoji) {
            var button = document.createElement("button");

            button.type = "button";
            button.className = "editor-emoji-picker-item";
            button.setAttribute("aria-label", emoji);
            button.textContent = emoji;
            button.addEventListener("click", function () {
                insertEmoji(activeEmojiEditor, emoji);
                picker.hidden = true;
                activeEmojiEditor = null;
            });
            grid.appendChild(button);
        });

        picker.appendChild(summary);
        picker.appendChild(grid);
        document.body.appendChild(picker);
        emojiPicker = picker;
        return emojiPicker;
    }

    function closeColorPicker() {
        if (!colorPicker) {
            return;
        }

        colorPicker.hidden = true;
        activeColorEditor = null;
    }

    function closeEmojiPicker() {
        if (!emojiPicker) {
            return;
        }

        emojiPicker.hidden = true;
        activeEmojiEditor = null;
    }

    function openTablePicker(editor, anchorElement) {
        var picker = createTablePicker();
        var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["table-grid"] : null);

        if (!picker || !toolbarButton) {
            return;
        }

        if (!picker.hidden && activeTableEditor === editor) {
            closeTablePicker();
            return;
        }

        closeColorPicker();
        closeEmojiPicker();
        closeToolbarHoverMenu();
        positionPicker(picker, toolbarButton);
        activeTableEditor = editor;
    }

    function openColorPicker(editor, anchorElement) {
        var picker = createColorPicker();
        var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["text-color"] : null);

        if (!picker || !toolbarButton) {
            return;
        }

        if (!picker.hidden && activeColorEditor === editor) {
            closeColorPicker();
            return;
        }

        closeEmojiPicker();
        positionPicker(picker, toolbarButton);
        activeColorEditor = editor;
    }

    function openEmojiPicker(editor, anchorElement) {
        var picker = createEmojiPicker();
        var toolbarButton = anchorElement || (editor && editor.toolbarElements ? editor.toolbarElements["emoji-picker"] : null);

        if (!picker || !toolbarButton) {
            return;
        }

        if (!picker.hidden && activeEmojiEditor === editor) {
            closeEmojiPicker();
            return;
        }

        closeColorPicker();
        positionPicker(picker, toolbarButton);
        activeEmojiEditor = editor;
    }

    function ensureMarkdownImageInput() {
        if (markdownImageInput) {
            return markdownImageInput;
        }

        markdownImageInput = document.createElement("input");
        markdownImageInput.type = "file";
        markdownImageInput.accept = "image/*";
        markdownImageInput.hidden = true;
        markdownImageInput.addEventListener("change", function () {
            var selectedFile = this.files && this.files[0] ? this.files[0] : null;
            var uploadUrl = getMarkdownUploadUrl();
            var csrfToken = getCsrfToken();
            var editor = activeImageEditor;

            if (!selectedFile || !uploadUrl || !editor || !editor.codemirror) {
                this.value = "";
                activeImageEditor = null;
                return;
            }

            var requestBody = new FormData();
            requestBody.append("image", selectedFile);
            if (csrfToken) {
                requestBody.append("csrfmiddlewaretoken", csrfToken);
            }

            fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: requestBody
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { success: 0, message: "Image upload failed." };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.success === 1 && data.file && data.file.url,
                            message: data.message || "",
                            url: data.file && data.file.url ? data.file.url : ""
                        };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        openModal({
                            tone: "error",
                            kicker: "Image upload",
                            title: "Image upload failed",
                            message: result.message || "Please try again.",
                            confirmText: "OK",
                        });
                        return;
                    }

                    var imageLabel = selectedFile.name.replace(/\.[^.]+$/, "") || "image";
                    editor.codemirror.replaceSelection("![" + imageLabel + "](" + result.url + ")");
                    editor.codemirror.focus();
                })
                .catch(function () {
                    openModal({
                        tone: "error",
                        kicker: "Image upload",
                        title: "Image upload failed",
                        message: "Please try again.",
                        confirmText: "OK",
                    });
                })
                .finally(function () {
                    markdownImageInput.value = "";
                    activeImageEditor = null;
                });
        });
        document.body.appendChild(markdownImageInput);
        return markdownImageInput;
    }

    function openMarkdownImagePicker(editor) {
        insertMarkdownImageTemplate(editor);
    }

    function openMarkdownImageUpload(editor) {
        var imageInput = ensureMarkdownImageInput();

        if (!imageInput) {
            return;
        }

        restoreActiveContextEditorSelection(editor);
        activeImageEditor = editor;
        imageInput.click();
    }

    function attachEditorHoverMenus(editor) {
        bindToolbarHoverMenu(editor, "link", [
            {
                label: getEditorString(editor, "data-link-reference-label", "Reference internal post"),
                iconClass: "fa-solid fa-file-lines",
                onClick: function () {
                    openInternalReferenceDialog(editor);
                }
            }
        ]);

        bindToolbarHoverMenu(editor, "image-upload", [
            {
                label: getEditorString(editor, "data-image-upload-label", "Upload image"),
                iconClass: "fa-solid fa-cloud-arrow-up",
                onClick: function () {
                    openMarkdownImageUpload(editor);
                }
            }
        ]);
    }

    appModalCloseButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            if (modalState.onCancel) {
                modalState.onCancel();
            }
            closeModal();
        });
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && appModal && !appModal.hidden) {
            if (modalState.onCancel) {
                modalState.onCancel();
            }
            closeModal();
        }

        if (event.key === "Escape") {
            closeTableContextMenu();
            closeEditorContextToolbar();
            closeTablePicker();
            closeToolbarHoverMenu();
            closeColorPicker();
            closeEmojiPicker();
            hidePostLinkPreviewTooltip();
        }
    });

    document.addEventListener("click", function (event) {
        if (tableContextMenu && !tableContextMenu.hidden) {
            if (tableContextMenu.contains(event.target)) {
                return;
            }

            closeTableContextMenu();
        }

        if (editorContextToolbar && !editorContextToolbar.hidden) {
            if (editorContextToolbar.contains(event.target)) {
                return;
            }

            closeEditorContextToolbar();
        }

        if (tablePicker && !tablePicker.hidden) {
            if (tablePicker.contains(event.target)) {
                return;
            }

            if (!isPickerButtonClick(event.target, activeTableEditor, "table-grid")) {
                closeTablePicker();
            }
        }

        if (toolbarHoverMenu && !toolbarHoverMenu.hidden) {
            if (toolbarHoverMenu.contains(event.target)) {
                return;
            }

            if (!event.target.closest(".editor-toolbar")) {
                closeToolbarHoverMenu();
            }
        }

        if (colorPicker && !colorPicker.hidden) {
            if (colorPicker.contains(event.target)) {
                return;
            }

            if (!isPickerButtonClick(event.target, activeColorEditor, "text-color")) {
                closeColorPicker();
            }
        }

        if (emojiPicker && !emojiPicker.hidden) {
            if (emojiPicker.contains(event.target)) {
                return;
            }

            if (!isPickerButtonClick(event.target, activeEmojiEditor, "emoji-picker")) {
                closeEmojiPicker();
            }
        }

        if (postLinkPreviewTooltip && !postLinkPreviewTooltip.hidden) {
            if (postLinkPreviewTooltip.contains(event.target)) {
                return;
            }

            if (!event.target.closest("a[data-post-link-preview-bound='true']")) {
                hidePostLinkPreviewTooltip();
            }
        }
    });

    window.addEventListener("resize", function () {
        closeTableContextMenu();
        closeEditorContextToolbar();
        closeTablePicker();
        closeToolbarHoverMenu();
        closeColorPicker();
        closeEmojiPicker();
        hidePostLinkPreviewTooltip();
    });
    window.addEventListener("scroll", function () {
        closeTableContextMenu();
        closeEditorContextToolbar();
        closeTablePicker();
        closeToolbarHoverMenu();
        closeColorPicker();
        closeEmojiPicker();
        hidePostLinkPreviewTooltip();
    }, true);

    if (userMenu && userMenuTrigger && userMenuDropdown) {
        userMenuTrigger.addEventListener("click", function () {
            var shouldOpen = userMenuDropdown.hidden;
            userMenuDropdown.hidden = !shouldOpen;
            userMenuTrigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
        });

        document.addEventListener("click", function (event) {
            if (!userMenu.contains(event.target)) {
                closeUserMenu();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeUserMenu();
            }
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
    initializeUnsavedChangesGuards();
    syncPostEditorVisibilityFields();
    initializeEncryptedPostAccess();

    initializeToastAlerts();
    initializePostOutline();

    focusHashTarget();
    window.addEventListener("hashchange", focusHashTarget);

    document.addEventListener("click", function (event) {
        var submitTrigger = event.target.closest("button, input[type='submit']");
        if (!isDeleteSemanticButton(submitTrigger)) {
            return;
        }

        var triggerForm = submitTrigger.form || submitTrigger.closest("form");
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

    toggleButtons.forEach(function (toggleButton) {
        var targetSelector = toggleButton.getAttribute("data-target");
        var passwordInput = targetSelector ? document.querySelector(targetSelector) : null;

        if (!passwordInput) {
            return;
        }

        var showLabel = toggleButton.getAttribute("data-show-label") || "";
        var hideLabel = toggleButton.getAttribute("data-hide-label") || "";
        var srOnlyLabel = toggleButton.querySelector(".sr-only");

        toggleButton.addEventListener("click", function () {
            var isPassword = passwordInput.getAttribute("type") === "password";
            var nextLabel = isPassword ? hideLabel : showLabel;

            passwordInput.setAttribute("type", isPassword ? "text" : "password");
            toggleButton.classList.toggle("is-visible", isPassword);
            toggleButton.setAttribute("aria-label", nextLabel);
            toggleButton.setAttribute("aria-pressed", isPassword ? "true" : "false");

            if (srOnlyLabel) {
                srOnlyLabel.textContent = nextLabel;
            }
        });
    });

    if (sendCodeButton) {
        var emailInput = document.querySelector(sendCodeButton.getAttribute("data-email-input") || "");
        var messageNode = document.querySelector("[data-send-code-message]");
        var sendCodeUrl = sendCodeButton.getAttribute("data-url");
        var defaultLabel = sendCodeButton.getAttribute("data-default-label") || "";
        var waitLabel = sendCodeButton.getAttribute("data-wait-label") || "Resend in %(seconds)s s";
        var fallbackError = sendCodeButton.getAttribute("data-fallback-error") || "";
        var waitSeconds = Number(sendCodeButton.getAttribute("data-wait-seconds") || "60");
        var csrfToken = csrfInput ? csrfInput.value : "";
        var countdownTimer = null;

        function setMessage(text, isError) {
            if (!messageNode) {
                return;
            }

            messageNode.textContent = text || "";
            messageNode.classList.toggle("is-error", Boolean(isError));
        }

        function startCountdown(secondsLeft) {
            var remaining = secondsLeft;

            sendCodeButton.disabled = true;
            sendCodeButton.textContent = waitLabel.replace("%(seconds)s", remaining);

            countdownTimer = window.setInterval(function () {
                remaining -= 1;
                if (remaining <= 0) {
                    window.clearInterval(countdownTimer);
                    countdownTimer = null;
                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                    return;
                }

                sendCodeButton.textContent = waitLabel.replace("%(seconds)s", remaining);
            }, 1000);
        }

        sendCodeButton.addEventListener("click", function () {
            if (!emailInput || !sendCodeUrl || !csrfToken) {
                return;
            }

            if (countdownTimer) {
                return;
            }

            sendCodeButton.disabled = true;
            setMessage("");

            var body = new URLSearchParams();
            body.append("email", emailInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(sendCodeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString()
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: defaultLabel };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.ok,
                            status: response.status,
                            message: data.message || ""
                        };
                    });
                })
                .then(function (result) {
                    setMessage(result.message, !result.ok);
                    if (result.ok) {
                        startCountdown(waitSeconds);
                        return;
                    }

                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                })
                .catch(function () {
                    setMessage(fallbackError, true);
                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                });
        });
    }

    if (forgotPasswordButton) {
        var usernameInput = document.querySelector(forgotPasswordButton.getAttribute("data-username-input") || "");
        var forgotPasswordUrl = forgotPasswordButton.getAttribute("data-url");
        var forgotPasswordSuccessTitle = forgotPasswordButton.getAttribute("data-success-title") || "";
        var forgotPasswordSuccess = forgotPasswordButton.getAttribute("data-success-message") || "";
        var forgotPasswordErrorTitle = forgotPasswordButton.getAttribute("data-error-title") || "";
        var forgotPasswordFallback = forgotPasswordButton.getAttribute("data-fallback-error") || "";
        var forgotPasswordConfirmText = forgotPasswordButton.getAttribute("data-confirm-text") || "";
        var csrfToken = csrfInput ? csrfInput.value : "";
        var passwordInput = document.querySelector("#id_password");

        forgotPasswordButton.addEventListener("click", function () {
            if (!usernameInput || !forgotPasswordUrl || !csrfToken) {
                return;
            }

            if (!usernameInput.value.trim()) {
                return;
            }

            forgotPasswordButton.disabled = true;

            var body = new URLSearchParams();
            body.append("username", usernameInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(forgotPasswordUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString()
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: forgotPasswordFallback };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.ok,
                            message: data.message || ""
                        };
                    });
                })
                .then(function (result) {
                    if (result.ok) {
                        if (passwordInput) {
                            passwordInput.value = "";
                        }
                        openModal({
                            tone: "notice",
                            kicker: forgotPasswordSuccessTitle,
                            title: forgotPasswordSuccessTitle,
                            message: result.message || forgotPasswordSuccess,
                            confirmText: forgotPasswordConfirmText,
                        });
                    } else if (result.message) {
                        openModal({
                            tone: "error",
                            kicker: forgotPasswordErrorTitle,
                            title: forgotPasswordErrorTitle,
                            message: result.message,
                            confirmText: forgotPasswordConfirmText,
                        });
                    }
                    forgotPasswordButton.disabled = false;
                })
                .catch(function () {
                    openModal({
                        tone: "error",
                        kicker: forgotPasswordErrorTitle,
                        title: forgotPasswordErrorTitle,
                        message: forgotPasswordFallback,
                        confirmText: forgotPasswordConfirmText,
                    });
                    forgotPasswordButton.disabled = false;
                });
        });
    }

    function initializeMarkdownEditor(node) {
        var editor = null;
        var previewUrl = "";
        var previewTimer = 0;
        var initialValue = "";
        var editorSurface = null;

        if (!node || !window.EasyMDE) {
            return null;
        }

        previewUrl = node.getAttribute("data-preview-url") || "";
        initialValue = node.value || "";

        editor = new EasyMDE({
            element: node,
            autoDownloadFontAwesome: false,
            forceSync: true,
            spellChecker: false,
            sideBySideFullscreen: false,
            status: ["lines", "words"],
            previewClass: ["blog-markdown-content"],
            previewRender: function (plainText, preview) {
                var fallbackHtml = renderMarkdownPreviewFallback(plainText, editor.markdown.bind(editor));

                if (!preview) {
                    return fallbackHtml;
                }

                preview.innerHTML = fallbackHtml;
                enhanceMarkdownContainer(preview);

                if (previewTimer) {
                    window.clearTimeout(previewTimer);
                }

                previewTimer = window.setTimeout(function () {
                    requestRenderedMarkdown(preview, plainText, previewUrl, editor.markdown.bind(editor));
                }, 220);

                return preview.innerHTML;
            },
            toolbar: [
                "bold",
                "italic",
                "heading",
                {
                    name: "text-color",
                    action: openColorPicker,
                    className: "fa fa-palette no-disable",
                    title: "Text Color"
                },
                "|",
                "quote",
                "unordered-list",
                "ordered-list",
                {
                    name: "table-grid",
                    action: openTablePicker,
                    className: "fa fa-table no-disable",
                    title: "Insert Table"
                },
                "|",
                {
                    name: "link",
                    action: openLinkDialog,
                    className: "fa fa-link no-disable",
                    title: "Insert Link"
                },
                {
                    name: "image-upload",
                    action: openMarkdownImagePicker,
                    className: "fa fa-image no-disable",
                    title: "Insert Image"
                },
                {
                    name: "emoji-picker",
                    action: openEmojiPicker,
                    className: "fa fa-face-smile no-disable",
                    title: "Insert Emoji"
                },
                "code",
                "|",
                "side-by-side",
                "guide"
            ],
            renderingConfig: {
                singleLineBreaks: false,
                codeSyntaxHighlighting: false
            }
        });

        markdownEditors.push(editor);
        if (editor.codemirror && editor.codemirror.getValue() !== initialValue) {
            editor.codemirror.setValue(initialValue);
        }
        if (postEditorForm && postEditorForm.contains(node)) {
            postMarkdownEditor = editor;
        }
        attachEditorHoverMenus(editor);

        editorSurface = editor.codemirror && typeof editor.codemirror.getWrapperElement === "function"
            ? editor.codemirror.getWrapperElement()
            : null;

        if (editorSurface) {
            editorSurface.addEventListener("contextmenu", function (event) {
                openEditorContextToolbar(event, editor);
            });
        }

        return editor;
    }

    function findMarkdownEditorByTextarea(textarea) {
        if (!textarea) {
            return null;
        }
        return markdownEditors.find(function (candidate) {
            return candidate.element === textarea;
        }) || null;
    }

    function syncEditorFromTextarea(textarea) {
        var editorInstance = findMarkdownEditorByTextarea(textarea);

        if (!editorInstance || !editorInstance.codemirror) {
            return null;
        }

        if (editorInstance.codemirror.getValue() !== textarea.value) {
            editorInstance.codemirror.setValue(textarea.value || "");
        }

        editorInstance.codemirror.refresh();
        return editorInstance;
    }

    Array.prototype.forEach.call(markdownEditorNodes, function (node) {
        initializeMarkdownEditor(node);
    });

    window.setTimeout(function () {
        var previews = document.querySelectorAll(".editor-preview, .editor-preview-side");
        Array.prototype.forEach.call(previews, function (preview) {
            enhanceMarkdownContainer(preview);
        });
    }, 0);

    function getThreadRepliesContainer(node) {
        var thread = node ? node.closest(".comment-thread") : null;
        return thread ? thread.querySelector("[data-thread-replies]") : null;
    }

    function setThreadExpanded(thread, expanded) {
        var replies = thread ? thread.querySelector("[data-thread-replies]") : null;
        var toggle = thread ? thread.querySelector("[data-thread-toggle]") : null;
        var expandText = toggle ? toggle.getAttribute("data-expand-text") || "" : "";
        var collapseText = toggle ? toggle.getAttribute("data-collapse-text") || "" : "";

        if (!replies || !toggle) {
            return;
        }

        replies.hidden = !expanded;
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        toggle.textContent = expanded ? collapseText : expandText;
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-thread-toggle]"), function (button) {
        button.addEventListener("click", function () {
            var thread = button.closest(".comment-thread");
            var expanded = button.getAttribute("aria-expanded") === "true";

            setThreadExpanded(thread, !expanded);
        });
    });
    
    Array.prototype.forEach.call(document.querySelectorAll("[data-reply-toggle]"), function (button) {
        button.addEventListener("click", function () {
            var commentId = button.getAttribute("data-comment-id") || "";
            var panel = document.querySelector("[data-reply-panel='" + commentId + "']");
            var textarea = panel ? panel.querySelector("textarea[data-markdown-editor='true']") : null;
            var isHidden = !panel || panel.hidden;
            var replies = getThreadRepliesContainer(button);
            var thread = button.closest(".comment-thread");

            if (!panel) {
                return;
            }

            if (replies && thread) {
                setThreadExpanded(thread, true);
            }

            panel.hidden = !isHidden;
            button.setAttribute("aria-expanded", isHidden ? "true" : "false");

            if (isHidden && textarea) {
                window.setTimeout(function () {
                    var editorInstance = syncEditorFromTextarea(textarea);
                    if (editorInstance && editorInstance.codemirror) {
                        editorInstance.codemirror.focus();
                    } else {
                        textarea.focus();
                    }
                }, 0);
            }
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-edit-toggle]"), function (button) {
        button.addEventListener("click", function () {
            var commentId = button.getAttribute("data-comment-id") || "";
            var panel = document.querySelector("[data-comment-edit-panel='" + commentId + "']");
            var textarea = panel ? panel.querySelector("textarea[data-markdown-editor='true']") : null;
            var isHidden = !panel || panel.hidden;
            var replies = getThreadRepliesContainer(button);
            var thread = button.closest(".comment-thread");

            if (!panel) {
                return;
            }

            if (replies && thread) {
                setThreadExpanded(thread, true);
            }

            panel.hidden = !isHidden;
            button.setAttribute("aria-expanded", isHidden ? "true" : "false");

            if (isHidden && textarea) {
                window.setTimeout(function () {
                    var editorInstance = syncEditorFromTextarea(textarea);
                    if (editorInstance && editorInstance.codemirror) {
                        editorInstance.codemirror.focus();
                    } else {
                        textarea.focus();
                    }
                }, 0);
            }
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-entry-toggle]"), function (button) {
        button.addEventListener("click", function () {
            var panel = document.querySelector("[data-comment-entry-panel]");
            var textarea = panel ? panel.querySelector("textarea[data-markdown-editor='true']") : null;
            var isHidden = !panel || panel.hidden;

            if (!panel) {
                return;
            }

            panel.hidden = !isHidden;
            button.setAttribute("aria-expanded", isHidden ? "true" : "false");

            if (isHidden && textarea) {
                window.setTimeout(function () {
                    var editorInstance = syncEditorFromTextarea(textarea);
                    if (editorInstance && editorInstance.codemirror) {
                        editorInstance.codemirror.focus();
                    } else {
                        textarea.focus();
                    }
                }, 0);
            }
        });
    });

    bindFeedbackWidgets();
    bindInlineShareControls();
    bindRevisionChoiceTriggers();
    initializeBookEditor();
    initializeBookOutline();

    Array.prototype.forEach.call(document.querySelectorAll(".blog-markdown-content"), function (container) {
        enhanceMarkdownContainer(container);
    });

    if (postEditorForm) {
        restorePostEditorDraft();
        initializePostEditorAutosave();
    }
});
