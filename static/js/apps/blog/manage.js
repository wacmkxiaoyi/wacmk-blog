import { closeModal, escapeHtml, getCsrfToken, markGuardClean, openActionMenu, openModal, showInlineFlash } from "../../core/app.js";
import { appendAccessDisplay, bindConditionTooltips, bindStarWidgets } from "./shared.js";
import { getPrimaryPostMarkdownEditor } from "./editor.js";

function parseConditionRules(value) {
    var parsed = null;
    try {
        parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function createAccessLayoutController(config) {
    var form = config && config.form ? config.form : null;
    var visibilitySelect = config && config.visibilitySelect ? config.visibilitySelect : null;
    var conditionInput = config && config.conditionInput ? config.conditionInput : null;
    var accessScopeField = config && config.accessScopeField ? config.accessScopeField : null;
    var accessScopeSelect = config && config.accessScopeSelect ? config.accessScopeSelect : null;
    var vipPermissionField = config && config.vipPermissionField ? config.vipPermissionField : null;
    var vipPermissionSelect = config && config.vipPermissionSelect ? config.vipPermissionSelect : null;
    var vipConditionEditorField = config && config.vipConditionEditorField ? config.vipConditionEditorField : null;
    var shareField = config && config.shareField ? config.shareField : null;
    var shareMessages = config && config.shareMessages ? config.shareMessages : [];
    var shareResult = config && config.shareResult ? config.shareResult : null;

    function applyLayout() {
        var rules = parseConditionRules(conditionInput ? conditionInput.value : "[]");
        var isPublic = visibilitySelect && visibilitySelect.value === "public" && !rules.length;
        var isConditionalOrPrivate = visibilitySelect && (visibilitySelect.value === "conditional" || visibilitySelect.value === "private");
        var isStandalone = accessScopeSelect && accessScopeSelect.value === "standalone";
        var vipConditional = vipPermissionSelect && vipPermissionSelect.value === "conditional";

        if (shareField) {
            shareField.hidden = !isPublic;
        }
        Array.prototype.forEach.call(shareMessages || [], function (node) {
            node.hidden = !isPublic;
        });
        if (shareResult) {
            shareResult.hidden = !isPublic || shareResult.classList.contains("is-hidden");
        }
        if (accessScopeField) {
            accessScopeField.hidden = !isConditionalOrPrivate;
            if (isPublic && accessScopeSelect) {
                accessScopeSelect.value = "unified";
                isStandalone = false;
            }
        }
        if (vipPermissionField) {
            vipPermissionField.hidden = !isStandalone;
        }
        if (vipConditionEditorField) {
            vipConditionEditorField.hidden = !isStandalone || !vipConditional;
        }
    }

    if (visibilitySelect) {
        visibilitySelect.addEventListener("change", applyLayout);
    }
    if (accessScopeSelect) {
        accessScopeSelect.addEventListener("change", applyLayout);
    }
    if (vipPermissionSelect) {
        vipPermissionSelect.addEventListener("change", applyLayout);
    }
    if (form) {
        form.addEventListener("input", function (event) {
            if (event.target && (event.target === conditionInput || event.target.id === "id_condition_rules" || event.target.id === "id_vip_condition_rules")) {
                applyLayout();
            }
        });
    }

    return {
        applyLayout: applyLayout
    };
}

function parseJsonObject(value, fallbackValue) {
    var parsed = null;

    if (typeof value !== "string" || value.trim() === "") {
        return fallbackValue;
    }

    try {
        parsed = JSON.parse(value);
    } catch (_error) {
        return fallbackValue;
    }

    return parsed && typeof parsed === "object" ? parsed : fallbackValue;
}

function buildPostMeta(item, fallbackMeta) {
    var fallback = fallbackMeta || {};

    return {
        id: String((item && item.id) != null ? item.id : (fallback.id || "")),
        title: item && item.title ? item.title : (fallback.title || ""),
        author: item && item.author ? item.author : (fallback.author || ""),
        accessDisplay: item && item.accessDisplay ? item.accessDisplay : (fallback.accessDisplay || null),
        visibility: item && item.visibility ? item.visibility : (fallback.visibility || "public"),
        visibilityPresentation: item && item.visibilityPresentation ? item.visibilityPresentation : (fallback.visibilityPresentation || null),
        selected: typeof fallback.selected === "boolean" ? fallback.selected : false,
        showVipBadge: item && item.showVipBadge != null ? item.showVipBadge : (fallback.showVipBadge || false),
        vipConditionSummaryItems: item && item.vipConditionSummaryItems ? item.vipConditionSummaryItems : (fallback.vipConditionSummaryItems || null),
        vipVisibilityPresentation: item && item.vipVisibilityPresentation ? item.vipVisibilityPresentation : (fallback.vipVisibilityPresentation || null)
    };
}

export function initializeConditionEditorsWithin(rootNode) {
    var scope = rootNode || document;

    Array.prototype.forEach.call(scope.querySelectorAll("[data-condition-editor], [data-vip-condition-editor]"), function (editor) {
        var inputId = editor.getAttribute("data-condition-input-id") || "";
        var form = editor.closest("form");
        var hiddenInput = inputId
            ? ((form ? form.querySelector("[id='" + inputId + "']") : null) || document.getElementById(inputId))
            : null;
        var isVipEditor = editor.hasAttribute("data-vip-condition-editor");
        var visibilityInputId = editor.getAttribute("data-condition-visibility-input-id") || "";
        var visibilitySelect = isVipEditor
            ? (form ? form.querySelector("#" + (visibilityInputId || "id_vip_access_permission")) : null)
            : (form ? form.querySelector("#" + (visibilityInputId || "id_visibility")) : null);
        var fieldWrapper = editor.closest("[data-condition-editor-field]");
        var maxMessage = editor.getAttribute("data-condition-max-message") || "Condition types are full";
        var conditionTypes = (editor.getAttribute("data-condition-types") || "money,points").split(",").map(function (value) { return value.trim(); }).filter(Boolean);
        var passwordTypes = (editor.getAttribute("data-condition-password-types") || "").split(",").map(function (value) { return value.trim(); }).filter(Boolean);
        var existingPasswordTypes = (editor.getAttribute("data-condition-existing-password-types") || "").split(",").map(function (value) { return value.trim(); }).filter(Boolean);
        var disabledValueTypes = (editor.getAttribute("data-condition-disabled-value-types") || "").split(",").map(function (value) { return value.trim(); }).filter(Boolean);
        var initialValue = hiddenInput && typeof hiddenInput.value === "string" && hiddenInput.value.trim() !== "" ? hiddenInput.value : (editor.getAttribute("data-condition-initial") || "[]");
        var initialRules = parseConditionRules(initialValue);
        var hasInitializedRows = false;
        var optionLabels = {
            money: editor.getAttribute("data-condition-money-label") || "Money",
            points: editor.getAttribute("data-condition-points-label") || "Points",
            encrypted: editor.getAttribute("data-condition-encrypted-label") || "Encrypted",
            book_only: editor.getAttribute("data-condition-book-only-label") || "Book only"
        };

        if (editor.getAttribute("data-condition-editor-bound") === "true") {
            return;
        }
        editor.setAttribute("data-condition-editor-bound", "true");

        function isPasswordType(type) {
            return passwordTypes.indexOf(type) !== -1;
        }

        function isDisabledValueType(type) {
            return disabledValueTypes.indexOf(type) !== -1;
        }

        function isNumericType(type) {
            return type === "money" || type === "points";
        }

        function hasExistingPassword(type) {
            return existingPasswordTypes.indexOf(type) !== -1;
        }

        function getRows() {
            return editor.querySelectorAll(".condition-editor-row");
        }

        function getSelectedTypes() {
            var types = [];
            Array.prototype.forEach.call(getRows(), function (row) {
                var select = row.querySelector("select");
                if (select && select.value && conditionTypes.indexOf(select.value) !== -1) {
                    types.push(select.value);
                }
            });
            return types;
        }

        function getNextAvailableType(currentType) {
            var selectedTypes = getSelectedTypes();
            var index = 0;
            if (currentType && conditionTypes.indexOf(currentType) !== -1) {
                return currentType;
            }
            for (index = 0; index < conditionTypes.length; index += 1) {
                if (selectedTypes.indexOf(conditionTypes[index]) === -1) {
                    return conditionTypes[index];
                }
            }
            return currentType || "";
        }

        function hasAvailableType() {
            return getSelectedTypes().length < conditionTypes.length;
        }

        function syncHiddenInput() {
            var payload = [];
            var supportsConditions = visibilitySelect && visibilitySelect.value === "conditional";

            if (!supportsConditions) {
                if (hiddenInput) {
                    hiddenInput.value = "[]";
                }
                return;
            }

            Array.prototype.forEach.call(getRows(), function (row) {
                var select = row.querySelector("select");
                var input = row.querySelector("input");
                var type = select ? select.value : "";
                var rawValue = input && typeof input.value === "string" ? input.value : "";
                var value = parseInt(rawValue, 10);
                if (!select || !select.value) {
                    return;
                }
                if (isDisabledValueType(type)) {
                    payload.push({ type: type });
                    return;
                }
                if (isPasswordType(type)) {
                    payload.push({ type: type, value: rawValue });
                    return;
                }
                if (isNumericType(type) && value >= 1) {
                    payload.push({ type: type, value: value });
                }
            });
            if (hiddenInput) {
                hiddenInput.value = JSON.stringify(payload);
            }
        }

        function renderHint() {
            var hint = editor.querySelector(".condition-editor-hint");
            var supportsConditions = visibilitySelect && visibilitySelect.value === "conditional";
            if (!hint) {
                hint = document.createElement("div");
                hint.className = "condition-editor-hint";
                editor.appendChild(hint);
            }
            hint.textContent = !supportsConditions || hasAvailableType() ? "" : maxMessage;
        }

        function refreshOptions() {
            var selectedTypes = getSelectedTypes();
            Array.prototype.forEach.call(getRows(), function (row) {
                var select = row.querySelector("select");
                if (!select) {
                    return;
                }
                Array.prototype.forEach.call(select.options, function (option) {
                    if (!option.value) {
                        return;
                    }
                    option.disabled = option.value !== select.value && selectedTypes.indexOf(option.value) !== -1;
                });
                if (!select.value || conditionTypes.indexOf(select.value) === -1) {
                    select.value = getNextAvailableType(select.value);
                }
            });
            Array.prototype.forEach.call(editor.querySelectorAll("[data-condition-add]"), function (button) {
                button.disabled = !hasAvailableType();
            });
            Array.prototype.forEach.call(editor.querySelectorAll("[data-condition-remove]"), function (button) {
                button.disabled = getRows().length <= 1;
            });
            renderHint();
            syncHiddenInput();
        }

        function appendRow(rule) {
            var hint = editor.querySelector(".condition-editor-hint");
            var row = buildRow(rule);

            if (hint) {
                editor.insertBefore(row, hint);
            } else {
                editor.appendChild(row);
            }
            hasInitializedRows = true;
            return row;
        }

        function ensureRows() {
            if (getRows().length) {
                hasInitializedRows = true;
                return;
            }
            if (!hasInitializedRows && initialRules.length) {
                initialRules.forEach(function (rule) {
                    appendRow(rule);
                });
            }
            if (!getRows().length) {
                appendRow({ type: getNextAvailableType("") });
            }
        }

        function clearRows() {
            Array.prototype.forEach.call(getRows(), function (row) {
                row.parentNode.removeChild(row);
            });
        }

        function buildRow(rule) {
            var row = document.createElement("div");
            var select = document.createElement("select");
            var input = document.createElement("input");
            var addButton = document.createElement("button");
            var removeButton = document.createElement("button");

            function syncRowInputState() {
                var disabledValue = isDisabledValueType(select.value);
                var passwordValue = isPasswordType(select.value);
                var numericValue = isNumericType(select.value);
                var supportsConditions = visibilitySelect && visibilitySelect.value === "conditional";
                var defaultPlaceholder = editor.getAttribute("data-condition-value-placeholder") || "Value";
                var passwordPlaceholder = editor.getAttribute("data-condition-password-placeholder") || defaultPlaceholder;
                var existingPasswordPlaceholder = editor.getAttribute("data-condition-password-existing-placeholder") || passwordPlaceholder;
                input.disabled = disabledValue;
                input.hidden = false;
                input.required = supportsConditions && (numericValue || (passwordValue && !hasExistingPassword(select.value)));
                input.type = passwordValue ? "password" : (numericValue ? "number" : "text");
                input.min = numericValue ? "1" : "";
                input.step = numericValue ? "1" : "";
                input.placeholder = disabledValue ? "" : (passwordValue ? (hasExistingPassword(select.value) ? existingPasswordPlaceholder : passwordPlaceholder) : defaultPlaceholder);
                if (disabledValue) {
                    input.value = "";
                }
            }

            row.className = "condition-editor-row";
            select.className = "input-control";
            select.innerHTML = conditionTypes.map(function (type) {
                return "<option value='" + type + "'>" + (optionLabels[type] || type) + "</option>";
            }).join("");
            select.value = getNextAvailableType(rule && rule.type ? rule.type : "");
            input.className = "input-control";
            input.type = "text";
            input.placeholder = editor.getAttribute("data-condition-value-placeholder") || "Value";
            input.value = rule && rule.value ? String(rule.value) : "";
            addButton.type = "button";
            addButton.className = "secondary-button condition-editor-action";
            addButton.textContent = "+";
            addButton.setAttribute("data-condition-add", "true");
            removeButton.type = "button";
            removeButton.className = "secondary-button condition-editor-action";
            removeButton.textContent = "-";
            removeButton.setAttribute("data-condition-remove", "true");

            select.addEventListener("change", function () {
                if (isPasswordType(select.value)) {
                    input.value = "";
                }
                syncRowInputState();
                refreshOptions();
            });
            input.addEventListener("input", syncHiddenInput);
            addButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (!hasAvailableType()) {
                    renderHint();
                    return;
                }
                appendRow(null);
                refreshOptions();
            });
            removeButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (getRows().length <= 1) {
                    return;
                }
                row.parentNode.removeChild(row);
                refreshOptions();
            });

            row.appendChild(select);
            row.appendChild(input);
            row.appendChild(addButton);
            row.appendChild(removeButton);
            syncRowInputState();
            return row;
        }

        function syncVisibilityState() {
            var supportsConditions = visibilitySelect && visibilitySelect.value === "conditional";
            var isConditionalOrPrivate = visibilitySelect && (visibilitySelect.value === "conditional" || visibilitySelect.value === "private");
            var accessScopeField = form ? form.querySelector("[data-access-scope-field]") : null;
            if (fieldWrapper) {
                fieldWrapper.hidden = !supportsConditions;
            }
            if (accessScopeField) {
                accessScopeField.hidden = !isConditionalOrPrivate;
            }
            Array.prototype.forEach.call(getRows(), function (row) {
                var input = row.querySelector("input");
                if (input) {
                    input.required = false;
                }
            });
            if (supportsConditions) {
                ensureRows();
            } else {
                clearRows();
            }
            refreshOptions();
        }

        editor.innerHTML = "";
        editor.appendChild(document.createElement("div")).className = "condition-editor-hint";
        if (visibilitySelect) {
            visibilitySelect.addEventListener("change", syncVisibilityState);
        }
        syncVisibilityState();
    });
}

function initializeConditionEditors() {
    initializeConditionEditorsWithin(document);
}

function getPostEditorRecoveryKey(postEditorForm) {
    return postEditorForm ? ("post-editor-recovery:" + (postEditorForm.getAttribute("data-post-id") || "new")) : "";
}

function storePostEditorDraft(postEditorForm) {
    var storageKey = getPostEditorRecoveryKey(postEditorForm);
    var fieldNames = ["title", "slug", "summary", "tag_names"];
    var payload = {};
    var editor = getPrimaryPostMarkdownEditor();

    if (!storageKey || !postEditorForm) {
        return;
    }
    fieldNames.forEach(function (fieldName) {
        var field = postEditorForm.querySelector("[name='" + fieldName + "']");
        if (field) {
            payload[fieldName] = field.value || "";
        }
    });
    if (editor) {
        payload.content = editor.value() || "";
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

function restorePostEditorDraft(postEditorForm) {
    var storageKey = getPostEditorRecoveryKey(postEditorForm);
    var rawPayload = "";
    var payload = null;
    var editor = getPrimaryPostMarkdownEditor();

    if (!storageKey || !postEditorForm) {
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
        if (editor) {
            editor.value(payload.content);
        }
        if (postEditorForm.querySelector("[data-markdown-editor='true']")) {
            postEditorForm.querySelector("[data-markdown-editor='true']").value = payload.content;
        }
    }
    window.sessionStorage.removeItem(storageKey);
}

function initializePostEditorAutosave(postEditorForm) {
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
        storePostEditorDraft(postEditorForm);
    }, intervalMs);
}

function initializePostEditor() {
    var postEditorForm = document.querySelector("[data-post-editor-form]");
    var visibilitySelect = postEditorForm ? postEditorForm.querySelector("#id_visibility") : null;
    var shareField = postEditorForm ? postEditorForm.querySelector("[data-post-share-field]") : null;
    var shareMessages = postEditorForm ? postEditorForm.querySelectorAll("[data-post-share-message]") : [];
    var shareResult = postEditorForm ? postEditorForm.querySelector("[data-post-share-result]") : null;
    var coverInput = postEditorForm ? postEditorForm.querySelector("#id_cover_image") : null;
    var coverPreviewWrapper = postEditorForm ? postEditorForm.querySelector("[data-post-cover-preview-wrapper]") : null;
    var coverPreviewImage = postEditorForm ? postEditorForm.querySelector("[data-post-cover-preview-image]") : null;
    var coverUploadRow = postEditorForm ? postEditorForm.querySelector("[data-post-cover-upload-row]") : null;
    var coverActions = postEditorForm ? postEditorForm.querySelector("[data-post-cover-actions]") : null;
    var coverRemoveButton = postEditorForm ? postEditorForm.querySelector("[data-post-cover-remove]") : null;
    var coverUndoButton = postEditorForm ? postEditorForm.querySelector("[data-post-cover-undo]") : null;
    var coverRemoveFlag = postEditorForm ? postEditorForm.querySelector("[data-post-cover-remove-flag]") : null;
    var existingCoverSrc = coverPreviewImage ? coverPreviewImage.getAttribute("src") || "" : "";
    var coverObjectUrl = "";

    if (!postEditorForm || postEditorForm.getAttribute("data-post-editor-bound") === "true") {
        return;
    }
    postEditorForm.setAttribute("data-post-editor-bound", "true");

    var accessLayoutController = createAccessLayoutController({
        form: postEditorForm,
        visibilitySelect: visibilitySelect,
        conditionInput: postEditorForm ? postEditorForm.querySelector("#id_condition_rules") : null,
        accessScopeField: postEditorForm ? postEditorForm.querySelector("[data-access-scope-field]") : null,
        accessScopeSelect: postEditorForm ? postEditorForm.querySelector("#id_access_scope") : null,
        vipPermissionField: postEditorForm ? postEditorForm.querySelector("[data-vip-permission-field]") : null,
        vipPermissionSelect: postEditorForm ? postEditorForm.querySelector("#id_vip_access_permission") : null,
        vipConditionEditorField: postEditorForm ? postEditorForm.querySelector("[data-vip-condition-editor-field]") : null,
        shareField: shareField,
        shareMessages: shareMessages,
        shareResult: shareResult
    });

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

    accessLayoutController.applyLayout();
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
    restorePostEditorDraft(postEditorForm);
    initializePostEditorAutosave(postEditorForm);
    postEditorForm.addEventListener("submit", function () {
        markGuardClean(postEditorForm);
    });
    scrollToFirstFormError(postEditorForm);
}

function initializeMarkdownImportTrigger() {
    var trigger = document.querySelector("[data-markdown-import-trigger]");
    var form = document.querySelector("[data-markdown-import-form]");
    var input = form ? form.querySelector("[data-markdown-import-input]") : null;
    var csrfToken = getCsrfToken();
    var submitUrl = trigger ? (trigger.getAttribute("data-markdown-import-url") || "") : "";
    var defaultLabel = trigger ? trigger.textContent : "";
    var uploadingLabel = trigger ? (trigger.getAttribute("data-markdown-import-uploading-label") || defaultLabel) : "";
    var invalidTypeMessage = trigger ? (trigger.getAttribute("data-markdown-import-invalid-type-message") || "Only .md files are supported.") : "Only .md files are supported.";
    var emptyMessage = trigger ? (trigger.getAttribute("data-markdown-import-empty-message") || "Please choose a markdown file to import.") : "Please choose a markdown file to import.";
    var requestErrorMessage = trigger ? (trigger.getAttribute("data-markdown-import-request-error") || "Unable to import the selected markdown file right now.") : "Unable to import the selected markdown file right now.";
    var nextInput = form ? form.querySelector("input[name='next']") : null;

    if (!trigger || !form || !input || trigger.getAttribute("data-markdown-import-bound") === "true") {
        return;
    }
    trigger.setAttribute("data-markdown-import-bound", "true");

    function resetTriggerState() {
        trigger.disabled = false;
        trigger.textContent = defaultLabel;
        input.value = "";
    }

    function getSelectedFile() {
        return input.files && input.files.length ? input.files[0] : null;
    }

    function isMarkdownFile(file) {
        var fileName = file && file.name ? file.name.toLowerCase() : "";
        return /\.md$/.test(fileName);
    }

    function submitSelectedFile() {
        var file = getSelectedFile();
        var body = new FormData();

        if (!file) {
            showInlineFlash(emptyMessage, false);
            resetTriggerState();
            return;
        }
        if (!isMarkdownFile(file)) {
            showInlineFlash(invalidTypeMessage, false);
            resetTriggerState();
            return;
        }

        trigger.disabled = true;
        trigger.textContent = uploadingLabel;
        body.append("markdown_file", file);
        if (nextInput && nextInput.value) {
            body.append("next", nextInput.value);
        }
        if (csrfToken) {
            body.append("csrfmiddlewaretoken", csrfToken);
        }

        fetch(submitUrl, {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            },
            body: body,
            credentials: "same-origin"
        }).then(function (response) {
            return response.json().catch(function () {
                return { ok: false, message: requestErrorMessage };
            }).then(function (data) {
                return { ok: response.ok && data.ok, data: data };
            });
        }).then(function (result) {
            if (!result.ok) {
                showInlineFlash(result.data.message || requestErrorMessage, false);
                resetTriggerState();
                return;
            }
            window.location.href = result.data.redirect_url || submitUrl;
        }).catch(function () {
            showInlineFlash(requestErrorMessage, false);
            resetTriggerState();
        });
    }

    trigger.addEventListener("click", function () {
        if (!submitUrl || !csrfToken) {
            showInlineFlash(requestErrorMessage, false);
            return;
        }
        input.click();
    });

    input.addEventListener("change", submitSelectedFile);
}

function initializeBookEditor() {
    var bookEditorForm = document.querySelector("[data-book-editor-form]");
    var visibilitySelect = bookEditorForm ? bookEditorForm.querySelector("#id_visibility") : null;
    var shareField = bookEditorForm ? bookEditorForm.querySelector("[data-book-share-field]") : null;
    var shareMessages = bookEditorForm ? bookEditorForm.querySelectorAll("[data-book-share-message]") : [];
    var shareResult = bookEditorForm ? bookEditorForm.querySelector("[data-book-share-result]") : null;
    var coverInput = bookEditorForm ? bookEditorForm.querySelector("#id_cover_image") : null;
    var coverInputShell = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-input-shell]") : null;
    var coverPreviewWrapper = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-preview-wrapper]") : null;
    var coverPreviewImage = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-preview-image]") : null;
    var coverActions = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-actions]") : null;
    var coverRemoveButton = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-remove]") : null;
    var coverUndoButton = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-undo]") : null;
    var coverUploadRow = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-upload-row]") : null;
    var coverRemoveFlag = bookEditorForm ? bookEditorForm.querySelector("[data-book-cover-remove-flag]") : null;
    var structureInput = bookEditorForm ? bookEditorForm.querySelector("#id_structure") : null;
    var structureRoot = bookEditorForm ? bookEditorForm.querySelector("[data-book-structure-root]") : null;
    var structureDataNode = bookEditorForm ? bookEditorForm.querySelector("#book-structure-data") : null;
    var addGroupButton = bookEditorForm ? bookEditorForm.querySelector("[data-book-add-group]") : null;
    var addPostsButton = bookEditorForm ? bookEditorForm.querySelector("[data-book-add-posts]") : null;
    var postSelectionInputs = bookEditorForm ? bookEditorForm.querySelector("[data-book-post-selection-inputs]") : null;
    var chapterWorkbench = bookEditorForm ? bookEditorForm.querySelector("[data-book-chapter-workbench]") : null;
    var postOptionNodes = bookEditorForm ? bookEditorForm.querySelectorAll("[data-book-post-option]") : [];
    var structureData = [];
    var coverObjectUrl = "";
    var existingCoverSrc = coverPreviewImage ? coverPreviewImage.getAttribute("src") || "" : "";
    var postOptionMap = Object.create(null);
    var dragState = { path: [], position: "after" };

    if (!bookEditorForm || bookEditorForm.getAttribute("data-book-editor-bound") === "true") {
        return;
    }
    bookEditorForm.setAttribute("data-book-editor-bound", "true");

    function addOrUpdatePostOption(item) {
        if (!item || item.id == null) {
            return null;
        }
        var postId = String(item.id);
        var existingNode = bookEditorForm.querySelector('[data-book-post-option][data-post-id="' + postId + '"]');
        var container = bookEditorForm.querySelector(".book-editor-post-options");
        var meta = buildPostMeta(item, getPostMeta(postId));

        if (!existingNode) {
            if (!container) {
                return null;
            }
            existingNode = document.createElement("div");
            existingNode.setAttribute("data-book-post-option", "");
            existingNode.setAttribute("data-post-id", postId);
            container.appendChild(existingNode);
        }

        existingNode.setAttribute("data-post-id", postId);
        existingNode.setAttribute("data-post-title", meta.title || "");
        existingNode.setAttribute("data-post-visibility", meta.visibility || "public");
        existingNode.setAttribute("data-post-author", meta.author || "");
        existingNode.setAttribute("data-post-access-display", meta.accessDisplay ? JSON.stringify(meta.accessDisplay) : "");
        existingNode.setAttribute("data-post-access-icon", (meta.visibilityPresentation && meta.visibilityPresentation.icon) || "");
        existingNode.setAttribute("data-post-access-tone", (meta.visibilityPresentation && meta.visibilityPresentation.tone) || "");
        existingNode.setAttribute("data-post-access-label", (meta.visibilityPresentation && meta.visibilityPresentation.label) || "");
        existingNode.setAttribute("data-post-selected", meta.selected ? "true" : "false");
        existingNode.setAttribute("data-post-show-vip-badge", meta.showVipBadge ? "true" : "false");
        existingNode.setAttribute("data-post-vip-condition-summary-items", meta.vipConditionSummaryItems ? JSON.stringify(meta.vipConditionSummaryItems) : "");
        existingNode.setAttribute("data-post-vip-visibility", meta.vipVisibilityPresentation ? JSON.stringify(meta.vipVisibilityPresentation) : "");

        if (item.postUrl || item.url) {
            existingNode.setAttribute("data-post-url", item.postUrl || item.url || "");
        } else {
            existingNode.removeAttribute("data-post-url");
        }

        if (item.requiresCondition) {
            existingNode.setAttribute("data-post-requires-condition", "true");
            existingNode.setAttribute("data-post-condition-status", item.conditionStatus || "");
            existingNode.setAttribute("data-post-condition-money", item.conditionMoney || "");
            existingNode.setAttribute("data-post-condition-points", item.conditionPoints || "");
        } else {
            existingNode.removeAttribute("data-post-requires-condition");
            existingNode.removeAttribute("data-post-condition-status");
            existingNode.removeAttribute("data-post-condition-money");
            existingNode.removeAttribute("data-post-condition-points");
        }

        postOptionMap[postId] = meta;
        return meta;
    }

    var accessLayoutController = createAccessLayoutController({
        form: bookEditorForm,
        visibilitySelect: visibilitySelect,
        conditionInput: bookEditorForm ? bookEditorForm.querySelector("#id_condition_rules") : null,
        accessScopeField: bookEditorForm ? bookEditorForm.querySelector("[data-access-scope-field]") : null,
        accessScopeSelect: bookEditorForm ? bookEditorForm.querySelector("#id_access_scope") : null,
        vipPermissionField: bookEditorForm ? bookEditorForm.querySelector("[data-vip-permission-field]") : null,
        vipPermissionSelect: bookEditorForm ? bookEditorForm.querySelector("#id_vip_access_permission") : null,
        vipConditionEditorField: bookEditorForm ? bookEditorForm.querySelector("[data-vip-condition-editor-field]") : null,
        shareField: shareField,
        shareMessages: shareMessages,
        shareResult: shareResult
    });

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
        if (!coverPreviewImage || !coverInputShell || !coverPreviewWrapper || !coverUploadRow) {
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
        if (!coverInput || !coverPreviewImage || !coverInput.files || !coverInput.files.length) {
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

    function addPostToStructureByItem(item) {
        var meta = addOrUpdatePostOption(item);
        if (!meta || !meta.id) {
            return false;
        }
        addPostsToStructure([meta.id]);
        rerenderStructure();
        return true;
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
            if (postMeta && postMeta.showVipBadge) {
                var vipBadge = document.createElement("span");
                vipBadge.className = "vip-access-badge";
                vipBadge.setAttribute("data-condition-tooltip-trigger", "");
                vipBadge.setAttribute("tabindex", "0");
                vipBadge.setAttribute("aria-label", "VIP access permission");
                var vipIcon = document.createElement("span");
                vipIcon.className = "vip-badge-icon";
                vipIcon.textContent = "VIP";
                vipBadge.appendChild(vipIcon);
                title.appendChild(vipBadge);
                var vipTooltipContent = "";
                if (postMeta.vipConditionSummaryItems && postMeta.vipConditionSummaryItems.length) {
                    vipTooltipContent = '<span class="condition-badge-group condition-badge-group-inline">' + postMeta.vipConditionSummaryItems.map(function (item) {
                        var label = item && item.label ? String(item.label) : "";
                        var tone = item && item.tone ? String(item.tone) : "conditional";
                        var type = item && item.type ? String(item.type) : "conditional";
                        var icon = item && item.icon ? String(item.icon) : "circle-question";
                        var value = item && item.value != null && item.value !== "" ? String(item.value) : "";
                        var text = value ? (label ? (label + " " + value) : value) : label;
                        return '<span class="condition-badge access-tone-' + tone + ' condition-badge-' + type + '">' +
                            '<i class="fa-solid fa-' + icon + '" aria-hidden="true"></i>' +
                            '<span>' + text + '</span>' +
                            '</span>';
                    }).join("") + '</span>';
                } else {
                    var vp = postMeta.vipVisibilityPresentation;
                    if (vp && vp.icon && vp.label) {
                        vipTooltipContent = '<span class="condition-badge-group condition-badge-group-inline">' +
                            '<span class="condition-badge access-tone-' + (vp.tone || "conditional") + '">' +
                            '<i class="fa-solid fa-' + vp.icon + '" aria-hidden="true"></i>' +
                            '<span>' + vp.label + '</span>' +
                            '</span></span>';
                    }
                }
                if (vipTooltipContent) {
                    var vipTooltipTemplate = document.createElement("span");
                    vipTooltipTemplate.hidden = true;
                    vipTooltipTemplate.setAttribute("data-condition-tooltip-template", "");
                    vipTooltipTemplate.innerHTML = vipTooltipContent;
                    title.appendChild(vipTooltipTemplate);
                }
                bindConditionTooltips(title);
            }
            if (appendAccessDisplay(title, postMeta && postMeta.accessDisplay ? postMeta.accessDisplay : null, {
                fallbackPresentation: postMeta && postMeta.visibilityPresentation ? postMeta.visibilityPresentation : null,
                iconClassName: "chapter-workbench-visibility-icon",
                countClassName: "chapter-workbench-visibility-count"
            })) {
                bindConditionTooltips(title);
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
            openActionMenu(event, [
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
            }]));
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
        results.setAttribute("data-star-results-reload", "true");
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
                var meta = buildPostMeta(item, getPostMeta(item.id));
                postOptionMap[String(item.id)] = meta;

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
                    var key = String(item.id);
                    event.preventDefault();
                    event.stopPropagation();
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
            bindConditionTooltips(resultGrid);
            bindStarWidgets(resultGrid);
        }

        results.__starReloadResults = function () {
            fetchResults(latestQuery, activePage);
        };

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
            accessDisplay: parseJsonObject(item.getAttribute("data-post-access-display") || "", null),
            visibilityPresentation: {
                type: item.getAttribute("data-post-visibility") || "public",
                icon: item.getAttribute("data-post-access-icon") || "",
                tone: item.getAttribute("data-post-access-tone") || "",
                label: item.getAttribute("data-post-access-label") || ""
            },
            author: item.getAttribute("data-post-author") || "",
            selected: item.getAttribute("data-post-selected") === "true",
            showVipBadge: item.getAttribute("data-post-show-vip-badge") === "true",
            vipConditionSummaryItems: parseJsonObject(item.getAttribute("data-post-vip-condition-summary-items") || "", null),
            vipVisibilityPresentation: parseJsonObject(item.getAttribute("data-post-vip-visibility") || "", null)
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

    accessLayoutController.applyLayout();
    if (coverInput) {
        coverInput.addEventListener("change", syncCoverPreview);
    }
    if (coverUndoButton) {
        coverUndoButton.addEventListener("click", function () {
            setCoverMarkedForRemoval(false);
        });
    }
    if (coverRemoveButton) {
        coverRemoveButton.addEventListener("click", resetCoverInput);
    }
    setCoverMarkedForRemoval(false);
    if (addPostsButton) {
        addPostsButton.addEventListener("click", openAddPostsDialog);
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
    bookEditorForm.__bookEditorApi = {
        addPostItem: addPostToStructureByItem,
        rerender: rerenderStructure
    };
    scrollToFirstFormError(bookEditorForm);
}

function initProfileEnhancements() {
    var form = document.querySelector('[data-profile-email-form="true"]');
    var emailInput = document.getElementById('id_email');
    var verificationField = document.querySelector('[data-profile-email-verification]');
    var verificationInput = document.getElementById('id_verification_code');
    var avatarInput = document.getElementById('id_avatar');
    var avatarPreview = document.querySelector('[data-profile-avatar-preview]');
    var avatarImage = document.querySelector('[data-profile-avatar-image]');
    var avatarRemoveButton = document.querySelector('[data-profile-avatar-remove]');
    var avatarUndoButton = document.querySelector('[data-profile-avatar-undo]');
    var avatarRemoveFlag = document.querySelector('[data-profile-avatar-remove-flag]');
    var initialEmail = form ? (form.getAttribute('data-current-email') || '').trim().toLowerCase() : '';
    var existingAvatarSrc = avatarImage ? avatarImage.getAttribute('src') || '' : '';
    var previewObjectUrl = null;

    function syncVerificationState() {
        var nextEmail = '';
        var shouldShow = false;
        if (!form || !emailInput || !verificationField) {
            return;
        }
        nextEmail = (emailInput.value || '').trim().toLowerCase();
        shouldShow = nextEmail !== initialEmail;
        verificationField.hidden = !shouldShow;
        if (verificationInput) {
            verificationInput.required = shouldShow;
            if (!shouldShow) {
                verificationInput.value = '';
            }
        }
    }

    function revokeAvatarPreviewUrl() {
        if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = null;
        }
    }

    function ensureAvatarImage() {
        var image = avatarPreview ? avatarPreview.querySelector('[data-profile-avatar-image]') : null;
        var fallback = avatarPreview ? avatarPreview.querySelector('[data-profile-avatar-fallback]') : null;
        if (image || !avatarPreview) {
            return image;
        }
        image = document.createElement('img');
        image.alt = avatarPreview.getAttribute('data-profile-avatar-alt') || '';
        image.className = 'profile-avatar-large';
        image.setAttribute('data-profile-avatar-image', 'true');
        if (fallback) {
            fallback.replaceWith(image);
        } else {
            avatarPreview.insertBefore(image, avatarPreview.firstChild);
        }
        return image;
    }

    function ensureAvatarFallback() {
        var fallback = avatarPreview ? avatarPreview.querySelector('[data-profile-avatar-fallback]') : null;
        var image = avatarPreview ? avatarPreview.querySelector('[data-profile-avatar-image]') : null;
        if (fallback || !avatarPreview) {
            return fallback;
        }
        fallback = document.createElement('div');
        fallback.className = 'profile-avatar-large profile-avatar-fallback';
        fallback.setAttribute('data-profile-avatar-fallback', 'true');
        fallback.textContent = '👤';
        if (image) {
            image.replaceWith(fallback);
        } else {
            avatarPreview.insertBefore(fallback, avatarPreview.firstChild);
        }
        return fallback;
    }

    function setAvatarPreview(src) {
        var image = null;
        if (!avatarPreview) {
            return;
        }
        if (src) {
            image = ensureAvatarImage();
            if (image) {
                image.src = src;
            }
            return;
        }
        ensureAvatarFallback();
    }

    function setAvatarMarkedForRemoval(marked) {
        var hasUpload = !!(avatarInput && avatarInput.files && avatarInput.files.length);
        var hasExistingAvatar = !!existingAvatarSrc;
        if (avatarRemoveFlag) {
            avatarRemoveFlag.value = marked ? '1' : '0';
        }
        if (marked) {
            setAvatarPreview('');
        } else if (!hasUpload) {
            setAvatarPreview(existingAvatarSrc);
        }
        if (avatarRemoveButton) {
            avatarRemoveButton.classList.toggle('is-hidden', marked || (!hasExistingAvatar && !hasUpload));
        }
        if (avatarUndoButton) {
            avatarUndoButton.classList.toggle('is-hidden', !marked || !hasExistingAvatar);
        }
    }

    function syncAvatarPreview() {
        var file = null;
        if (!avatarInput || !avatarPreview) {
            return;
        }
        file = avatarInput.files && avatarInput.files[0];
        revokeAvatarPreviewUrl();
        if (!file || (file.type && file.type.indexOf('image/') !== 0)) {
            if (avatarRemoveFlag && avatarRemoveFlag.value === '1') {
                setAvatarMarkedForRemoval(true);
            } else {
                setAvatarPreview(existingAvatarSrc);
                if (avatarRemoveButton) {
                    avatarRemoveButton.classList.toggle('is-hidden', !existingAvatarSrc);
                }
                if (avatarUndoButton) {
                    avatarUndoButton.classList.add('is-hidden');
                }
            }
            return;
        }
        previewObjectUrl = URL.createObjectURL(file);
        setAvatarPreview(previewObjectUrl);
        if (avatarRemoveFlag) {
            avatarRemoveFlag.value = '0';
        }
        if (avatarRemoveButton) {
            avatarRemoveButton.classList.remove('is-hidden');
        }
        if (avatarUndoButton) {
            avatarUndoButton.classList.add('is-hidden');
        }
    }

    if (emailInput && form && verificationField) {
        emailInput.addEventListener('input', syncVerificationState);
        syncVerificationState();
    }
    if (avatarInput && avatarPreview) {
        avatarInput.addEventListener('change', syncAvatarPreview);
        if (avatarRemoveButton) {
            avatarRemoveButton.addEventListener('click', function () {
                revokeAvatarPreviewUrl();
                if (avatarInput) {
                    avatarInput.value = '';
                }
                setAvatarMarkedForRemoval(true);
            });
        }
        if (avatarUndoButton) {
            avatarUndoButton.addEventListener('click', function () {
                setAvatarMarkedForRemoval(false);
            });
        }
        setAvatarMarkedForRemoval(false);
    }
    window.addEventListener('beforeunload', revokeAvatarPreviewUrl);
}

function initManageUserForm() {
    var roleSelect = document.querySelector('[data-role-type-select="true"]');
    var adminSection = document.querySelector('[data-role-admin-section]');
    var adminDivider = document.querySelector('[data-role-admin-divider]');
    var memberSection = document.querySelector('[data-role-member-section]');
    var staffCheckbox = document.getElementById('id_is_staff');
    var superuserCheckbox = document.getElementById('id_is_superuser');
    var businessIdentitySelect = document.querySelector('[data-business-identity-select="true"]');
    var businessIdentityTouchedInput = document.getElementById('id_business_identity_touched');
    var defaultBusinessIdentityValue = document.querySelector('[data-default-business-identity-value]') ? document.querySelector('[data-default-business-identity-value]').getAttribute('data-default-business-identity-value') || '' : '';
    var avatarDisplay = document.querySelector('.user-manage-avatar-display');
    var avatarRemoveButton = document.querySelector('[data-manage-user-avatar-remove]');
    var avatarUndoButton = document.querySelector('[data-manage-user-avatar-undo]');
    var avatarRemoveFlag = document.querySelector('[data-manage-user-avatar-remove-flag]');
    var existingAvatarSrc = avatarDisplay ? avatarDisplay.getAttribute('data-manage-user-avatar-src') || '' : '';

    function ensureAvatarFallback() {
        var fallback = avatarDisplay ? avatarDisplay.querySelector('[data-manage-user-avatar-fallback]') : null;
        var image = avatarDisplay ? avatarDisplay.querySelector('[data-manage-user-avatar-image]') : null;
        if (fallback || !avatarDisplay) {
            return fallback;
        }
        fallback = document.createElement('div');
        fallback.className = 'profile-avatar-large profile-avatar-fallback';
        fallback.setAttribute('data-manage-user-avatar-fallback', 'true');
        fallback.textContent = '👤';
        if (image) {
            image.replaceWith(fallback);
        } else {
            avatarDisplay.appendChild(fallback);
        }
        return fallback;
    }

    function ensureAvatarImage() {
        var image = avatarDisplay ? avatarDisplay.querySelector('[data-manage-user-avatar-image]') : null;
        var fallback = avatarDisplay ? avatarDisplay.querySelector('[data-manage-user-avatar-fallback]') : null;
        if (image || !avatarDisplay) {
            return image;
        }
        image = document.createElement('img');
        image.alt = avatarDisplay.getAttribute('data-manage-user-avatar-alt') || '';
        image.className = 'profile-avatar-large';
        image.setAttribute('data-manage-user-avatar-image', 'true');
        if (fallback) {
            fallback.replaceWith(image);
        } else {
            avatarDisplay.appendChild(image);
        }
        return image;
    }

    function setAvatarPreview(src) {
        var image = null;
        if (!avatarDisplay) {
            return;
        }
        if (src) {
            image = ensureAvatarImage();
            if (image) {
                image.src = src;
            }
            return;
        }
        ensureAvatarFallback();
    }

    function setAvatarMarkedForRemoval(marked) {
        var hasExistingAvatar = !!existingAvatarSrc;
        if (avatarRemoveFlag) {
            avatarRemoveFlag.value = marked ? '1' : '0';
        }
        if (marked) {
            setAvatarPreview('');
        } else {
            setAvatarPreview(existingAvatarSrc);
        }
        if (avatarRemoveButton) {
            avatarRemoveButton.classList.toggle('is-hidden', marked || !hasExistingAvatar);
        }
        if (avatarUndoButton) {
            avatarUndoButton.classList.toggle('is-hidden', !marked || !hasExistingAvatar);
        }
    }

    if (avatarDisplay && avatarRemoveFlag) {
        if (avatarRemoveButton) {
            avatarRemoveButton.addEventListener('click', function () {
                setAvatarMarkedForRemoval(true);
            });
        }
        if (avatarUndoButton) {
            avatarUndoButton.addEventListener('click', function () {
                setAvatarMarkedForRemoval(false);
            });
        }
        setAvatarMarkedForRemoval(avatarRemoveFlag.value === '1');
    }

    if (!roleSelect) {
        return;
    }

    function syncRoleState(applyDefaults) {
        var isAdmin = roleSelect.value === 'admin';
        if (adminSection) {
            adminSection.hidden = !isAdmin;
        }
        if (adminDivider) {
            adminDivider.hidden = !isAdmin;
        }
        if (memberSection) {
            memberSection.hidden = false;
        }
        if (applyDefaults && isAdmin) {
            if (staffCheckbox) {
                staffCheckbox.checked = true;
            }
            if (superuserCheckbox) {
                superuserCheckbox.checked = true;
            }
        }
        if (applyDefaults && !isAdmin) {
            if (staffCheckbox) {
                staffCheckbox.checked = false;
            }
            if (superuserCheckbox) {
                superuserCheckbox.checked = false;
            }
            if (businessIdentitySelect && defaultBusinessIdentityValue) {
                businessIdentitySelect.value = defaultBusinessIdentityValue;
            }
        }
    }

    roleSelect.addEventListener('change', function () {
        syncRoleState(true);
    });
    if (businessIdentitySelect && businessIdentityTouchedInput) {
        businessIdentitySelect.addEventListener('change', function () {
            businessIdentityTouchedInput.value = '1';
        });
    }
    syncRoleState(false);
}

function initSiteSettingsForm() {
    var vipMaxLevelInput = document.querySelector('[data-vip-max-level-input="true"]');
    var vipLevelFieldsWrapper = document.querySelector('[data-vip-level-name-fields]');

    function syncVipLevelFieldVisibility() {
        var maxLevel = 0;
        if (!vipMaxLevelInput || !vipLevelFieldsWrapper) {
            return;
        }
        maxLevel = parseInt(vipMaxLevelInput.value || '0', 10);
        if (isNaN(maxLevel) || maxLevel <= 0) {
            vipLevelFieldsWrapper.hidden = true;
            vipLevelFieldsWrapper.querySelectorAll('[data-vip-level-name-field]').forEach(function (field) {
                field.hidden = true;
            });
            return;
        }
        vipLevelFieldsWrapper.hidden = false;
        vipLevelFieldsWrapper.querySelectorAll('[data-vip-level-name-field]').forEach(function (field) {
            var level = parseInt(field.getAttribute('data-vip-level') || '0', 10);
            field.hidden = isNaN(level) || level > maxLevel;
        });
    }

    if (vipMaxLevelInput) {
        vipMaxLevelInput.addEventListener('input', syncVipLevelFieldVisibility);
        syncVipLevelFieldVisibility();
    }

    ["site_icon", "auth_background", "app_background"].forEach(function (assetKey) {
        var removeInput = document.querySelector('[data-site-setting-remove-input="' + assetKey + '"]');
        var previewWrapper = document.querySelector('[data-site-setting-preview-wrapper="' + assetKey + '"]');
        var previewImage = document.querySelector('[data-site-setting-preview-image="' + assetKey + '"]');
        var uploadRow = document.querySelector('[data-site-setting-upload-row="' + assetKey + '"]');
        var removeButton = document.querySelector('[data-site-setting-remove-toggle="' + assetKey + '"]');
        var undoButton = document.querySelector('[data-site-setting-undo="' + assetKey + '"]');
        var fileInput = document.getElementById('id_' + assetKey);
        var existingSrc = previewImage ? previewImage.getAttribute('src') || '' : '';
        var objectUrl = null;

        function revokeObjectUrl() {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
                objectUrl = null;
            }
        }

        function hasExistingPreview() {
            return !!existingSrc;
        }

        function setMarkedForRemoval(marked) {
            var hasUpload = !!(fileInput && fileInput.files && fileInput.files.length);
            var hasExisting = hasExistingPreview();
            if (!removeInput) {
                return;
            }
            removeInput.value = marked ? '1' : '0';
            if (previewWrapper) {
                previewWrapper.hidden = marked || !hasExisting;
            }
            if (uploadRow) {
                uploadRow.classList.toggle('is-hidden', !marked && hasExisting && !hasUpload);
            }
            if (undoButton) {
                undoButton.classList.toggle('is-hidden', !marked || !hasExisting);
            }
        }

        if (removeButton) {
            removeButton.addEventListener('click', function () {
                if (fileInput) {
                    fileInput.value = '';
                }
                revokeObjectUrl();
                if (previewImage) {
                    previewImage.setAttribute('src', existingSrc);
                }
                setMarkedForRemoval(true);
            });
        }
        if (undoButton) {
            undoButton.addEventListener('click', function () {
                setMarkedForRemoval(false);
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', function () {
                var file = null;
                revokeObjectUrl();
                file = fileInput.files && fileInput.files[0];
                if (!file || (file.type && file.type.indexOf('image/') !== 0)) {
                    if (!hasExistingPreview()) {
                        if (previewWrapper) {
                            previewWrapper.hidden = true;
                        }
                        if (uploadRow) {
                            uploadRow.classList.remove('is-hidden');
                        }
                    }
                    return;
                }
                objectUrl = URL.createObjectURL(file);
                if (previewImage) {
                    previewImage.setAttribute('src', objectUrl);
                }
                if (previewWrapper) {
                    previewWrapper.hidden = false;
                }
                if (uploadRow) {
                    uploadRow.classList.add('is-hidden');
                }
                if (undoButton) {
                    undoButton.classList.add('is-hidden');
                }
                if (removeInput) {
                    removeInput.value = '0';
                }
            });
        }

        setMarkedForRemoval(false);
        window.addEventListener('beforeunload', revokeObjectUrl);
    });
}

function scrollToFirstFormError(formEl) {
    if (!formEl) return;
    var errorEl = formEl.querySelector(".form-alert")
        || formEl.querySelector(".field-error");
    if (!errorEl) return;
    errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function initAddUserButton() {
    var trigger = document.querySelector("[data-add-user-trigger]");
    if (!trigger || trigger.getAttribute("data-add-user-bound") === "true") {
        return;
    }
    trigger.setAttribute("data-add-user-bound", "true");

    trigger.addEventListener("click", function () {
        var createUrl = trigger.getAttribute("data-add-user-url") || "";
        var csrfToken = getCsrfToken();

        var container = document.createElement("div");
        container.className = "editor-modal-form";

        var allErrors = document.createElement("div");
        allErrors.className = "field-error";
        allErrors.setAttribute("data-add-user-error", "__all__");
        allErrors.style.display = "none";
        allErrors.style.marginBottom = "0.75rem";
        container.appendChild(allErrors);

        function buildField(labelText, inputElement, fieldName) {
            var field = document.createElement("div");
            var label = document.createElement("label");
            var error = document.createElement("span");

            field.className = "form-field";
            field.style.marginBottom = "0.75rem";
            label.textContent = labelText;
            label.style.display = "block";
            label.style.marginBottom = "0.3rem";
            label.style.fontWeight = "600";
            label.style.fontSize = "0.9rem";
            label.style.color = "#6f78a8";
            inputElement.setAttribute("data-add-user-field", fieldName);
            inputElement.style.width = "100%";
            error.className = "field-error";
            error.setAttribute("data-add-user-error", fieldName);
            error.style.display = "none";

            field.appendChild(label);
            field.appendChild(inputElement);
            field.appendChild(error);
            return field;
        }

        var usernameInput = document.createElement("input");
        usernameInput.type = "text";
        usernameInput.className = "input-control";
        usernameInput.placeholder = escapeHtml(trigger.getAttribute("data-add-user-username-placeholder") || "Username");
        usernameInput.setAttribute("required", "");

        var firstnameInput = document.createElement("input");
        firstnameInput.type = "text";
        firstnameInput.className = "input-control";
        firstnameInput.placeholder = escapeHtml(trigger.getAttribute("data-add-user-nickname-placeholder") || "Display name (optional)");

        var emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.className = "input-control";
        emailInput.placeholder = escapeHtml(trigger.getAttribute("data-add-user-email-placeholder") || "Email address");
        emailInput.setAttribute("required", "");

        var password1Input = document.createElement("input");
        password1Input.type = "password";
        password1Input.className = "input-control";
        password1Input.placeholder = escapeHtml(trigger.getAttribute("data-add-user-password-placeholder") || "Password");
        password1Input.setAttribute("required", "");

        var password2Input = document.createElement("input");
        password2Input.type = "password";
        password2Input.className = "input-control";
        password2Input.placeholder = escapeHtml(trigger.getAttribute("data-add-user-confirm-password-placeholder") || "Confirm password");
        password2Input.setAttribute("required", "");

        container.appendChild(buildField(
            escapeHtml(trigger.getAttribute("data-add-user-username-label") || "Username"),
            usernameInput,
            "username"
        ));
        container.appendChild(buildField(
            escapeHtml(trigger.getAttribute("data-add-user-nickname-label") || "Nickname"),
            firstnameInput,
            "first_name"
        ));
        container.appendChild(buildField(
            escapeHtml(trigger.getAttribute("data-add-user-email-label") || "Email"),
            emailInput,
            "email"
        ));
        container.appendChild(buildField(
            escapeHtml(trigger.getAttribute("data-add-user-password-label") || "Password"),
            password1Input,
            "password1"
        ));
        container.appendChild(buildField(
            escapeHtml(trigger.getAttribute("data-add-user-confirm-password-label") || "Confirm password"),
            password2Input,
            "password2"
        ));

        function clearErrors() {
            Array.prototype.forEach.call(container.querySelectorAll("[data-add-user-error]"), function (el) {
                el.textContent = "";
                el.style.display = "none";
            });
        }

        function showFieldError(fieldName, message) {
            var el = container.querySelector('[data-add-user-error="' + fieldName + '"]');
            if (el) {
                el.textContent = message;
                el.style.display = "block";
            }
        }

        function showErrors(errors) {
            clearErrors();
            Object.keys(errors).forEach(function (fieldName) {
                var messages = errors[fieldName];
                var fieldError = container.querySelector('[data-add-user-error="' + fieldName + '"]');
                if (fieldError) {
                    fieldError.textContent = (messages || []).join(" ");
                    fieldError.style.display = "block";
                }
            });
        }

        openModal({
            kicker: escapeHtml(trigger.getAttribute("data-add-user-kicker") || "Users"),
            title: escapeHtml(trigger.getAttribute("data-add-user-title") || "Add user"),
            contentNode: container,
            cancelText: escapeHtml(trigger.getAttribute("data-add-user-cancel-label") || "Cancel"),
            confirmText: escapeHtml(trigger.getAttribute("data-add-user-confirm-label") || "Create"),
            keepOpenOnConfirm: true,
            onConfirm: function () {
                clearErrors();

                var username = (usernameInput.value || "").trim();
                var email = (emailInput.value || "").trim();
                var firstname = (firstnameInput.value || "").trim();
                var password1 = password1Input.value;
                var password2 = password2Input.value;
                var hasError = false;

                if (!username) {
                    showFieldError("username", escapeHtml(trigger.getAttribute("data-add-user-username-required") || "Username is required."));
                    hasError = true;
                }
                if (!email) {
                    showFieldError("email", escapeHtml(trigger.getAttribute("data-add-user-email-required") || "Email is required."));
                    hasError = true;
                }
                if (!password1) {
                    showFieldError("password1", escapeHtml(trigger.getAttribute("data-add-user-password-required") || "Password is required."));
                    hasError = true;
                }
                if (!password2) {
                    showFieldError("password2", escapeHtml(trigger.getAttribute("data-add-user-confirm-password-required") || "Please confirm the password."));
                    hasError = true;
                }
                if (password1 && password2 && password1 !== password2) {
                    showFieldError("password2", escapeHtml(trigger.getAttribute("data-add-user-password-mismatch") || "The two passwords do not match."));
                    hasError = true;
                }
                if (hasError) {
                    return;
                }

                var body = new FormData();
                body.append("username", username);
                body.append("first_name", firstname);
                body.append("email", email);
                body.append("password1", password1);
                body.append("password2", password2);
                body.append("csrfmiddlewaretoken", csrfToken);

                fetch(createUrl, {
                    method: "POST",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: body,
                    credentials: "same-origin"
                }).then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, errors: { __all__: [escapeHtml(trigger.getAttribute("data-add-user-request-error") || "Unable to create user right now.")] } };
                    });
                }).then(function (data) {
                    if (data.ok) {
                        closeModal();
                        window.location.reload();
                    } else if (data.errors) {
                        showErrors(data.errors);
                    }
                }).catch(function () {
                    showFieldError("__all__", escapeHtml(trigger.getAttribute("data-add-user-request-error") || "Unable to create user right now."));
                });
            }
        });

        window.setTimeout(function () {
            usernameInput.focus();
        }, 0);
    });
}

var manageInitialized = false;

export function initBlogManage() {
    if (manageInitialized) {
        return;
    }
    manageInitialized = true;
    initializeConditionEditors();
    initializePostEditor();
    initializeMarkdownImportTrigger();
    initializeBookEditor();
    initProfileEnhancements();
    initManageUserForm();
    initSiteSettingsForm();
    initAddUserButton();
}

export function initManagePostListPage() {
    initializeMarkdownImportTrigger();
}
