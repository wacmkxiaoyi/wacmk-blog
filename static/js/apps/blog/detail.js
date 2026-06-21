import { syncEditorFromTextarea } from "./editor.js";

function closeCommentActionsMenu(menu) {
    var trigger = menu ? menu.querySelector("[data-comment-actions-trigger]") : null;
    var dropdown = menu ? menu.querySelector("[data-comment-actions-dropdown]") : null;

    if (!menu || !trigger || !dropdown) {
        return;
    }

    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
}

function closeAllCommentActionsMenus(exceptMenu) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-actions-menu]"), function (menu) {
        if (menu !== exceptMenu) {
            closeCommentActionsMenu(menu);
        }
    });
}

function initializeCommentActionsMenus() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-actions-menu]"), function (menu) {
        var trigger = menu.querySelector("[data-comment-actions-trigger]");
        var dropdown = menu.querySelector("[data-comment-actions-dropdown]");

        if (!trigger || !dropdown || trigger.getAttribute("data-comment-actions-bound") === "true") {
            return;
        }

        trigger.setAttribute("data-comment-actions-bound", "true");
        trigger.addEventListener("click", function (event) {
            var shouldOpen = dropdown.hidden;

            event.stopPropagation();
            closeAllCommentActionsMenus(shouldOpen ? menu : null);
            dropdown.hidden = !shouldOpen;
            trigger.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
            menu.classList.toggle("is-open", shouldOpen);
        });

        dropdown.addEventListener("click", function (event) {
            if (event.target.closest(".comment-actions-item")) {
                closeCommentActionsMenu(menu);
            }
            event.stopPropagation();
        });
    });

    if (document.body.getAttribute("data-comment-actions-global-bound") === "true") {
        return;
    }

    document.body.setAttribute("data-comment-actions-global-bound", "true");
    document.addEventListener("click", function (event) {
        if (!event.target.closest("[data-comment-actions-menu]")) {
            closeAllCommentActionsMenus(null);
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeAllCommentActionsMenus(null);
        }
    });
}

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

function focusEditorTextarea(panel) {
    var textarea = panel ? panel.querySelector("textarea[data-markdown-editor='true']") : null;
    if (!textarea) {
        return;
    }

    window.setTimeout(function () {
        var editorInstance = syncEditorFromTextarea(textarea);
        if (editorInstance && editorInstance.codemirror) {
            window.requestAnimationFrame(function () {
                editorInstance.codemirror.refresh();
                window.requestAnimationFrame(function () {
                    editorInstance.codemirror.refresh();
                    editorInstance.codemirror.focus();
                });
            });
            return;
        }
        textarea.focus();
    }, 0);
}

function setPanelVisibility(panel, expanded) {
    var panelType = panel ? panel.getAttribute("data-comment-edit-panel") ? "edit" : panel.hasAttribute("data-reply-panel") ? "reply" : panel.hasAttribute("data-comment-entry-panel") ? "entry" : "" : "";
    var commentId = panelType === "entry" ? "" : panel ? panel.getAttribute(panelType === "edit" ? "data-comment-edit-panel" : "data-reply-panel") || "" : "";
    var selector = "";

    if (!panel) {
        return;
    }

    panel.hidden = !expanded;

    if (panelType === "entry") {
        selector = "[data-comment-entry-toggle]";
    } else if (panelType === "reply") {
        selector = "[data-reply-toggle][data-comment-id='" + commentId + "']";
    } else if (panelType === "edit") {
        selector = "[data-comment-edit-toggle][data-comment-id='" + commentId + "']";
    }

    if (!selector) {
        return;
    }

    Array.prototype.forEach.call(document.querySelectorAll(selector), function (button) {
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
}

function bindToggleButtons(selector, getPanel) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (button) {
        if (button.getAttribute("data-detail-toggle-bound") === "true") {
            return;
        }
        button.setAttribute("data-detail-toggle-bound", "true");

        button.addEventListener("click", function () {
            var panel = getPanel(button);
            var isHidden = !panel || panel.hidden;
            var replies = getThreadRepliesContainer(button);
            var thread = button.closest(".comment-thread");

            if (!panel) {
                return;
            }

            if (replies && thread) {
                setThreadExpanded(thread, true);
            }

            setPanelVisibility(panel, isHidden);
            if (isHidden) {
                focusEditorTextarea(panel);
            }
        });
    });
}

function bindCloseButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-panel-close]"), function (button) {
        if (button.getAttribute("data-comment-close-bound") === "true") {
            return;
        }
        button.setAttribute("data-comment-close-bound", "true");

        button.addEventListener("click", function () {
            var target = button.getAttribute("data-comment-panel-target") || "";
            var commentId = button.getAttribute("data-comment-id") || "";
            var panel = null;

            if (target === "reply") {
                panel = document.querySelector("[data-reply-panel='" + commentId + "']");
            } else if (target === "edit") {
                panel = document.querySelector("[data-comment-edit-panel='" + commentId + "']");
            } else {
                panel = button.closest("[data-comment-entry-panel]");
            }

            setPanelVisibility(panel, false);
        });
    });
}

function normalizeCommentContent(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim();
}

function clearCommentFormError(form) {
    var existing = form.querySelector(".field-error");
    if (existing) {
        existing.parentNode.removeChild(existing);
    }
}

function showCommentFormError(form, message) {
    var fieldGroup = form.querySelector(".field-group");
    if (!fieldGroup) return;
    var error = document.createElement("div");
    error.className = "field-error";
    error.textContent = message;
    fieldGroup.appendChild(error);
}

function bindCommentFormValidation(form) {
    if (!form || form.getAttribute("data-comment-validated") === "true") return;
    form.setAttribute("data-comment-validated", "true");

    form.addEventListener("submit", function (event) {
        var textarea = form.querySelector("textarea[data-markdown-editor='true']");
        if (!textarea) return;

        var editorInstance = syncEditorFromTextarea(textarea);
        var content = editorInstance && editorInstance.codemirror
            ? editorInstance.codemirror.getValue()
            : textarea.value;

        clearCommentFormError(form);
        if (!normalizeCommentContent(content)) {
            event.preventDefault();
            showCommentFormError(form, "Comment content cannot be empty.");
            if (editorInstance && editorInstance.codemirror) {
                editorInstance.codemirror.focus();
            } else {
                textarea.focus();
            }
        }
    });
}

function initializeCommentFormValidation() {
    var entryForm = document.querySelector("form[data-comment-entry-panel]");
    bindCommentFormValidation(entryForm);
    Array.prototype.forEach.call(
        document.querySelectorAll("[data-comment-edit-panel] form, [data-reply-panel] form"),
        bindCommentFormValidation
    );
}

export function initCommentInteractions() {
    initializeCommentActionsMenus();

    Array.prototype.forEach.call(document.querySelectorAll("[data-thread-toggle]"), function (button) {
        if (button.getAttribute("data-thread-toggle-bound") === "true") {
            return;
        }
        button.setAttribute("data-thread-toggle-bound", "true");
        button.addEventListener("click", function () {
            var thread = button.closest(".comment-thread");
            var expanded = button.getAttribute("aria-expanded") === "true";
            setThreadExpanded(thread, !expanded);
        });
    });

    bindToggleButtons("[data-reply-toggle]", function (button) {
        var commentId = button.getAttribute("data-comment-id") || "";
        return document.querySelector("[data-reply-panel='" + commentId + "']");
    });

    bindToggleButtons("[data-comment-edit-toggle]", function (button) {
        var commentId = button.getAttribute("data-comment-id") || "";
        return document.querySelector("[data-comment-edit-panel='" + commentId + "']");
    });

    bindToggleButtons("[data-comment-entry-toggle]", function () {
        return document.querySelector("[data-comment-entry-panel]");
    });

    bindCloseButtons();
    initializeCommentFormValidation();
}
