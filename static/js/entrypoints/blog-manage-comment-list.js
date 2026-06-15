import { onReady, openModal } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initBlogEditor, syncEditorFromTextarea } from "../apps/blog/editor.js";
import { initBlogManage } from "../apps/blog/manage.js";

function bindCommentEditButtons() {
    var formContainer = document.getElementById("comment-edit-form-container");
    var form = document.getElementById("comment-edit-form");
    var textarea = form ? form.querySelector("textarea[data-markdown-editor='true']") : null;
    var closeBtn = document.getElementById("comment-edit-close-btn");
    var kickerEl = document.querySelector("[data-comment-edit-kicker]");
    var titleEl = document.querySelector("[data-comment-edit-title]");
    var urlPrefixEl = document.querySelector("[data-comment-edit-url-prefix]");
    var urlPrefixTemplate = urlPrefixEl ? urlPrefixEl.getAttribute("data-comment-edit-url-prefix") || "" : "";

    if (!formContainer || !form || !textarea) {
        return;
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", function () {
            var modalRoot = form.closest(".app-modal");
            var modalApi = modalRoot && modalRoot.__modalApi ? modalRoot.__modalApi : null;
            if (modalApi) {
                modalApi.close();
            } else if (form.parentNode !== formContainer) {
                formContainer.appendChild(form);
            }
        });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-comment-edit-btn]"), function (btn) {
        if (btn.getAttribute("data-comment-edit-bound") === "true") {
            return;
        }
        btn.setAttribute("data-comment-edit-bound", "true");

        btn.addEventListener("click", function () {
            var id = btn.getAttribute("data-comment-id");
            var content = btn.getAttribute("data-comment-content") || "";

            form.action = urlPrefixTemplate.replace("/0/", "/" + id + "/");

            textarea.value = content;
            syncEditorFromTextarea(textarea);

            openModal({
                kicker: kickerEl ? kickerEl.textContent : "Manage",
                title: titleEl ? titleEl.textContent : "Edit comment",
                contentNode: form,
                dialogClass: "is-wide-dialog",
                onCancel: function () {
                    if (form.parentNode !== formContainer) {
                        formContainer.appendChild(form);
                    }
                }
            });

            window.setTimeout(function () {
                syncEditorFromTextarea(textarea);
            }, 150);
        });
    });
}

onReady(function () {
    initBlogShared();
    initBlogEditor();
    initBlogManage();
    bindCommentEditButtons();
});
