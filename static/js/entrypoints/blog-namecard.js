import { onReady } from "../core/app.js";
import { initBlogShared, bindInternalPostLinkPreviews } from "../apps/blog/shared.js";

onReady(function () {
    initBlogShared();
    var commentList = document.querySelector(".namecard-comment-list");
    if (commentList) {
        bindInternalPostLinkPreviews(commentList);
    }
});
