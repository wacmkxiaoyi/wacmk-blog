import { syncEditorFromTextarea } from "./editor.js";

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
            editorInstance.codemirror.focus();
            return;
        }
        textarea.focus();
    }, 0);
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

            panel.hidden = !isHidden;
            button.setAttribute("aria-expanded", isHidden ? "true" : "false");
            if (isHidden) {
                focusEditorTextarea(panel);
            }
        });
    });
}

export function initCommentInteractions() {
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
}
