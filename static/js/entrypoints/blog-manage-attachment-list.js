import { onReady, closeModal, getCsrfToken, openModal, showInlineFlash } from "../core/app.js";
import { bindConditionTooltips, initBlogShared } from "../apps/blog/shared.js";
import { initBlogManage, initializeConditionEditorsWithin } from "../apps/blog/manage.js";

function getText(selector, fallback) {
    var node = document.querySelector(selector);
    return node ? (node.textContent || "").trim() : fallback;
}

function buildOptions(selectNode) {
    selectNode.innerHTML = [
        "<option value='public'>Public</option>",
        "<option value='private'>Private</option>",
        "<option value='conditional'>Conditional</option>"
    ].join("");
}

function parseJsonArray(value) {
    try {
        var parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function hasRules(value) {
    return parseJsonArray(value).length > 0;
}

function serializeRuleTypes(rules) {
    var hasEncrypted = (rules || []).some(function (rule) {
        return rule && rule.type === "encrypted";
    });
    return hasEncrypted ? "encrypted" : "";
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderAccessCell(payload) {
    var html = "";
    var visibilityPresentation = payload && payload.visibilityPresentation ? payload.visibilityPresentation : null;
    var conditionSummaryItems = payload && payload.conditionSummaryItems ? payload.conditionSummaryItems : [];
    var vipConditionSummaryItems = payload && payload.vipConditionSummaryItems ? payload.vipConditionSummaryItems : [];
    var vipVisibilityPresentation = payload && payload.vipVisibilityPresentation ? payload.vipVisibilityPresentation : null;
    var showVipBadge = Boolean(payload && payload.showVipBadge);

    if (showVipBadge) {
        html += '<span class="vip-access-badge" data-condition-tooltip-trigger tabindex="0" aria-label="VIP access permission"><span class="vip-badge-icon">VIP</span></span>';
        if (vipConditionSummaryItems.length) {
            html += '<span data-condition-tooltip-template hidden><span class="condition-badge-group condition-badge-group-inline">' + vipConditionSummaryItems.map(function (item) {
                return '<span class="condition-badge access-tone-' + escapeHtml(item.tone || 'conditional') + ' condition-badge-' + escapeHtml(item.type || 'conditional') + '"><i class="fa-solid fa-' + escapeHtml(item.icon || 'circle-question') + '" aria-hidden="true"></i><span>' + escapeHtml(item.value ? (item.label + ' ' + item.value) : item.label) + '</span></span>';
            }).join("") + '</span></span>';
        } else if (vipVisibilityPresentation) {
            html += '<span data-condition-tooltip-template hidden><span class="condition-badge-group condition-badge-group-inline"><span class="condition-badge access-tone-' + escapeHtml(vipVisibilityPresentation.tone || 'conditional') + '"><i class="fa-solid fa-' + escapeHtml(vipVisibilityPresentation.icon) + '" aria-hidden="true"></i><span>' + escapeHtml(vipVisibilityPresentation.label) + '</span></span></span></span>';
        }
    }

    if (conditionSummaryItems.length === 1) {
        var item = conditionSummaryItems[0];
        html += '<span class="condition-badge-group condition-badge-group-inline"><span class="condition-badge access-tone-' + escapeHtml(item.tone || 'conditional') + ' condition-badge-' + escapeHtml(item.type || 'conditional') + '"><i class="fa-solid fa-' + escapeHtml(item.icon || 'circle-question') + '" aria-hidden="true"></i><span>' + escapeHtml(item.value ? (item.label + ' ' + item.value) : item.label) + '</span></span></span>';
    } else if (conditionSummaryItems.length > 1) {
        html += '<span class="soft-tag soft-tag-conditional-summary" data-condition-tooltip-trigger tabindex="0">' + conditionSummaryItems.length + ' conditions</span>';
        html += '<div data-condition-tooltip-template hidden><span class="condition-badge-group condition-badge-group-inline">' + conditionSummaryItems.map(function (item) {
            return '<span class="condition-badge access-tone-' + escapeHtml(item.tone || 'conditional') + ' condition-badge-' + escapeHtml(item.type || 'conditional') + '"><i class="fa-solid fa-' + escapeHtml(item.icon || 'circle-question') + '" aria-hidden="true"></i><span>' + escapeHtml(item.value ? (item.label + ' ' + item.value) : item.label) + '</span></span>';
        }).join("") + '</span></div>';
    } else if (visibilityPresentation) {
        html += '<span class="soft-tag soft-tag-visibility soft-tag-access access-tone-' + escapeHtml(visibilityPresentation.tone || 'public') + '"><i class="fa-solid fa-' + escapeHtml(visibilityPresentation.icon) + '" aria-hidden="true"></i>' + escapeHtml(visibilityPresentation.label) + '</span>';
    }
    return html;
}

function bindAttachmentEditButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-attachment-edit-btn]"), function (button) {
        if (button.getAttribute("data-attachment-edit-bound") === "true") {
            return;
        }
        button.setAttribute("data-attachment-edit-bound", "true");

        button.addEventListener("click", function () {
            var row = button.closest("[data-attachment-row]");
            var updateUrl = button.getAttribute("data-attachment-update-url") || "";
            var titleValue = button.getAttribute("data-attachment-title") || "";
            var visibilityValue = button.getAttribute("data-attachment-visibility") || "public";
            var accessScopeValue = button.getAttribute("data-attachment-access-scope") || "unified";
            var vipPermissionValue = button.getAttribute("data-attachment-vip-permission") || "public";
            var conditionInitial = button.getAttribute("data-attachment-condition-initial") || "[]";
            var vipConditionInitial = button.getAttribute("data-attachment-vip-condition-initial") || "[]";
            var currentFileName = button.getAttribute("data-attachment-file-name-current") || "";
            var existingPasswordTypes = button.getAttribute("data-attachment-existing-password-types") || serializeRuleTypes(parseJsonArray(conditionInitial));
            var existingVipPasswordTypes = button.getAttribute("data-attachment-existing-vip-password-types") || serializeRuleTypes(parseJsonArray(vipConditionInitial));
            var initialVisibilityValue = hasRules(conditionInitial) ? "conditional" : visibilityValue;
            var initialVipPermissionValue = hasRules(vipConditionInitial) ? "conditional" : vipPermissionValue;

            var container = document.createElement("div");
            var form = document.createElement("form");
            var topRow = document.createElement("div");
            var titleField = document.createElement("div");
            var fileField = document.createElement("div");
            var titleLabel = document.createElement("label");
            var titleInput = document.createElement("input");
            var fileLabel = document.createElement("label");
            var fileInput = document.createElement("input");
            var currentFile = document.createElement("div");
            var fileHelp = document.createElement("div");
            var accessLayout = document.createElement("div");
            var visibilityField = document.createElement("div");
            var visibilityLabel = document.createElement("label");
            var visibilitySelect = document.createElement("select");
            var accessScopeField = document.createElement("div");
            var accessScopeLabel = document.createElement("label");
            var accessScopeSelect = document.createElement("select");
            var conditionField = document.createElement("div");
            var conditionLabel = document.createElement("label");
            var conditionInput = document.createElement("input");
            var conditionEditor = document.createElement("div");
            var vipField = document.createElement("div");
            var vipLabel = document.createElement("label");
            var vipSelect = document.createElement("select");
            var vipConditionField = document.createElement("div");
            var vipConditionLabel = document.createElement("label");
            var vipConditionInput = document.createElement("input");
            var vipConditionEditor = document.createElement("div");
            var hint = document.createElement("p");
            var errorMessage = document.createElement("p");

            function syncLayout() {
                var isConditionalOrPrivate = visibilitySelect.value === "conditional" || visibilitySelect.value === "private";
                var isStandalone = accessScopeSelect.value === "standalone";
                var vipConditional = vipSelect.value === "conditional";

                accessScopeField.hidden = !isConditionalOrPrivate;
                if (!isConditionalOrPrivate) {
                    accessScopeSelect.value = "unified";
                }
                vipField.hidden = accessScopeSelect.value !== "standalone";
                vipConditionField.hidden = accessScopeSelect.value !== "standalone" || !vipConditional;
            }

            container.className = "editor-modal-form editor-attachment-form";
            form.className = "editor-attachment-form-shell";
            topRow.className = "editor-attachment-top-row";
            titleField.className = "field-group editor-attachment-title-field";
            fileField.className = "field-group editor-attachment-file-field";
            accessLayout.className = "editor-access-layout";
            visibilityField.className = "field-group editor-access-layout-visibility";
            accessScopeField.className = "field-group editor-access-layout-additional-permission";
            accessScopeField.setAttribute("data-access-scope-field", "");
            conditionField.className = "field-group editor-access-layout-conditions";
            conditionField.setAttribute("data-condition-editor-field", "");
            vipField.className = "field-group editor-access-layout-vip-permission";
            vipField.setAttribute("data-vip-permission-field", "");
            vipConditionField.className = "field-group editor-access-layout-vip-conditions";
            vipConditionField.setAttribute("data-vip-condition-editor-field", "");
            titleInput.className = "input-control";
            fileInput.className = "input-control file-input";
            fileInput.type = "file";
            visibilitySelect.className = "input-control";
            accessScopeSelect.className = "input-control";
            vipSelect.className = "input-control";
            conditionEditor.className = "condition-editor";
            vipConditionEditor.className = "condition-editor";
            currentFile.className = "field-help";
            fileHelp.className = "field-help";
            hint.className = "field-help";
            errorMessage.className = "field-error";
            errorMessage.hidden = true;

            titleLabel.textContent = getText("[data-attachment-modal-name-label]", "Attachment title");
            fileLabel.textContent = getText("[data-attachment-modal-file-label]", "Select file");
            visibilityLabel.textContent = getText("[data-attachment-modal-visibility-label]", "Access permission");
            accessScopeLabel.textContent = getText("[data-attachment-modal-access-scope-label]", "Access scope");
            conditionLabel.textContent = getText("[data-attachment-modal-conditions-label]", "Conditions");
            vipLabel.textContent = getText("[data-attachment-modal-vip-label]", "VIP access permission");
            vipConditionLabel.textContent = getText("[data-attachment-modal-vip-conditions-label]", "VIP conditions");
            titleInput.value = titleValue;
            currentFile.textContent = getText("[data-attachment-modal-current-file-label]", "Current file") + ": " + currentFileName;
            fileHelp.textContent = getText("[data-attachment-modal-file-help]", "Leave empty to keep the current file.");
            hint.textContent = getText("[data-attachment-modal-max-size]", "Maximum attachment size: 1 MB");

            buildOptions(visibilitySelect);
            buildOptions(vipSelect);
            visibilitySelect.value = initialVisibilityValue;
            vipSelect.value = initialVipPermissionValue;
            accessScopeSelect.innerHTML = "<option value='unified'>Unified</option><option value='standalone'>Standalone</option>";
            accessScopeSelect.value = accessScopeValue;
            conditionInput.type = "hidden";
            conditionInput.id = "id_attachment_condition_rules";
            conditionInput.value = conditionInitial;
            vipConditionInput.type = "hidden";
            vipConditionInput.id = "id_attachment_vip_condition_rules";
            vipConditionInput.value = vipConditionInitial;

            conditionEditor.setAttribute("data-condition-editor", "");
            conditionEditor.setAttribute("data-condition-input-id", "id_attachment_condition_rules");
            conditionEditor.setAttribute("data-condition-visibility-input-id", "id_attachment_visibility");
            conditionEditor.setAttribute("data-condition-initial", conditionInitial);
            conditionEditor.setAttribute("data-condition-existing-password-types", existingPasswordTypes);
            conditionEditor.setAttribute("data-condition-max-message", "Condition types are full");
            conditionEditor.setAttribute("data-condition-value-placeholder", "Value");
            conditionEditor.setAttribute("data-condition-password-placeholder", "Enter password");
            conditionEditor.setAttribute("data-condition-password-existing-placeholder", "Leave blank to keep current password");
            conditionEditor.setAttribute("data-condition-money-label", "Money");
            conditionEditor.setAttribute("data-condition-points-label", "Points");
            conditionEditor.setAttribute("data-condition-encrypted-label", "Encrypted");
            conditionEditor.setAttribute("data-condition-types", "money,points,encrypted");
            conditionEditor.setAttribute("data-condition-password-types", "encrypted");

            vipConditionEditor.setAttribute("data-vip-condition-editor", "");
            vipConditionEditor.setAttribute("data-condition-input-id", "id_attachment_vip_condition_rules");
            vipConditionEditor.setAttribute("data-condition-visibility-input-id", "id_attachment_vip_access_permission");
            vipConditionEditor.setAttribute("data-condition-initial", vipConditionInitial);
            vipConditionEditor.setAttribute("data-condition-existing-password-types", existingVipPasswordTypes);
            vipConditionEditor.setAttribute("data-condition-max-message", "VIP condition types are full");
            vipConditionEditor.setAttribute("data-condition-value-placeholder", "Value");
            vipConditionEditor.setAttribute("data-condition-password-placeholder", "Enter password");
            vipConditionEditor.setAttribute("data-condition-password-existing-placeholder", "Leave blank to keep current password");
            vipConditionEditor.setAttribute("data-condition-money-label", "Money");
            vipConditionEditor.setAttribute("data-condition-points-label", "Points");
            vipConditionEditor.setAttribute("data-condition-encrypted-label", "Encrypted");
            vipConditionEditor.setAttribute("data-condition-types", "money,points,encrypted");
            vipConditionEditor.setAttribute("data-condition-password-types", "encrypted");

            visibilitySelect.id = "id_attachment_visibility";
            accessScopeSelect.id = "id_attachment_access_scope";
            vipSelect.id = "id_attachment_vip_access_permission";
            titleLabel.setAttribute("for", "id_attachment_title");
            titleInput.id = "id_attachment_title";
            fileLabel.setAttribute("for", "id_attachment_file");
            fileInput.id = "id_attachment_file";
            visibilityLabel.setAttribute("for", visibilitySelect.id);
            accessScopeLabel.setAttribute("for", accessScopeSelect.id);
            vipLabel.setAttribute("for", vipSelect.id);

            titleField.appendChild(titleLabel);
            titleField.appendChild(titleInput);
            fileField.appendChild(fileLabel);
            fileField.appendChild(fileInput);
            fileField.appendChild(currentFile);
            fileField.appendChild(fileHelp);
            topRow.appendChild(titleField);
            topRow.appendChild(fileField);

            visibilityField.appendChild(visibilityLabel);
            visibilityField.appendChild(visibilitySelect);
            accessScopeField.appendChild(accessScopeLabel);
            accessScopeField.appendChild(accessScopeSelect);
            conditionField.appendChild(conditionLabel);
            conditionField.appendChild(conditionInput);
            conditionField.appendChild(conditionEditor);
            vipField.appendChild(vipLabel);
            vipField.appendChild(vipSelect);
            vipConditionField.appendChild(vipConditionLabel);
            vipConditionField.appendChild(vipConditionInput);
            vipConditionField.appendChild(vipConditionEditor);
            accessLayout.appendChild(visibilityField);
            accessLayout.appendChild(accessScopeField);
            accessLayout.appendChild(conditionField);
            accessLayout.appendChild(vipField);
            accessLayout.appendChild(vipConditionField);

            form.appendChild(topRow);
            form.appendChild(accessLayout);
            form.appendChild(hint);
            form.appendChild(errorMessage);
            container.appendChild(form);

            openModal({
                kicker: getText("[data-attachment-modal-kicker]", "Attachment"),
                title: getText("[data-attachment-modal-title]", "Update attachment"),
                contentNode: container,
                cancelText: getText("[data-attachment-modal-cancel]", "Cancel"),
                confirmText: getText("[data-attachment-modal-confirm]", "Update"),
                keepOpenOnConfirm: true,
                dialogClass: "is-medium-dialog",
                onConfirm: function () {
                    var formData = new FormData();
                    var selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

                    errorMessage.hidden = true;
                    formData.append("title", titleInput.value || currentFileName || "Attachment");
                    formData.append("visibility", visibilitySelect.value);
                    formData.append("access_scope", accessScopeSelect.value);
                    formData.append("condition_rules", conditionInput.value || "[]");
                    formData.append("vip_access_permission", vipSelect.value);
                    formData.append("vip_condition_rules", vipConditionInput.value || "[]");
                    if (selectedFile) {
                        formData.append("file", selectedFile);
                    }

                    return fetch(updateUrl, {
                        method: "POST",
                        headers: {
                            "X-CSRFToken": getCsrfToken(),
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        body: formData,
                        credentials: "same-origin"
                    }).then(function (response) {
                        return response.json().catch(function () {
                            return { ok: false, message: getText("[data-attachment-modal-request-error]", "Unable to update the selected attachment right now.") };
                        }).then(function (payload) {
                            payload.statusOk = response.ok;
                            return payload;
                        });
                    }).then(function (payload) {
                        if (!payload.ok || !payload.statusOk || !payload.attachment) {
                            errorMessage.textContent = payload.message || getText("[data-attachment-modal-request-error]", "Unable to update the selected attachment right now.");
                            errorMessage.hidden = false;
                            return;
                        }

                        row.querySelector("[data-attachment-title]").textContent = payload.attachment.title || "";
                        row.querySelector("[data-attachment-file-name]").textContent = payload.attachment.fileName || "";
                        row.querySelector("[data-attachment-file-size]").textContent = payload.attachment.fileSizeLabel || "";
                        row.querySelector("[data-attachment-file-ext]").textContent = (payload.attachment.fileExt || "").toUpperCase() || "-";
                        row.querySelector("[data-attachment-updated]").textContent = payload.attachment.updatedAt || row.querySelector("[data-attachment-updated]").textContent;
                        row.querySelector("[data-attachment-access-cell]").innerHTML = renderAccessCell(payload.attachment);

                        button.setAttribute("data-attachment-title", payload.attachment.title || "");
                        button.setAttribute("data-attachment-file-name-current", payload.attachment.fileName || "");
                        button.setAttribute("data-attachment-visibility", visibilitySelect.value);
                        button.setAttribute("data-attachment-access-scope", accessScopeSelect.value);
                        button.setAttribute("data-attachment-vip-permission", vipSelect.value);
                        button.setAttribute("data-attachment-condition-initial", conditionInput.value || "[]");
                        button.setAttribute("data-attachment-vip-condition-initial", vipConditionInput.value || "[]");
                        button.setAttribute("data-attachment-existing-password-types", serializeRuleTypes(parseJsonArray(conditionInput.value || "[]")));
                        button.setAttribute("data-attachment-existing-vip-password-types", serializeRuleTypes(parseJsonArray(vipConditionInput.value || "[]")));

                        showInlineFlash(getText("[data-attachment-modal-success]", "Attachment updated successfully."), true);
                        closeModal();
                    }).catch(function () {
                        errorMessage.textContent = getText("[data-attachment-modal-request-error]", "Unable to update the selected attachment right now.");
                        errorMessage.hidden = false;
                    });
                }
            });

            window.setTimeout(function () {
                initializeConditionEditorsWithin(form);
                visibilitySelect.addEventListener("change", syncLayout);
                accessScopeSelect.addEventListener("change", syncLayout);
                vipSelect.addEventListener("change", syncLayout);
                form.addEventListener("input", function (event) {
                    if (!event.target) {
                        return;
                    }
                    if (event.target === conditionInput || event.target === vipConditionInput || event.target.id === conditionInput.id || event.target.id === vipConditionInput.id) {
                        if (hasRules(conditionInput.value || "[]")) {
                            visibilitySelect.value = "conditional";
                        }
                        if (hasRules(vipConditionInput.value || "[]")) {
                            vipSelect.value = "conditional";
                        }
                        syncLayout();
                    }
                });
                syncLayout();
                titleInput.focus();
            }, 0);
        });
    });
}

onReady(function () {
    initBlogShared();
    initBlogManage();
    bindAttachmentEditButtons();
    bindConditionTooltips(document);
});
