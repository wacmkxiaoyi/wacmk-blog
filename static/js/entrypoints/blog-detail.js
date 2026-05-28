import { onReady } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initBlogEditor } from "../apps/blog/editor.js";
import { initCommentInteractions } from "../apps/blog/detail.js";

onReady(function () {
    initBlogShared();
    initBlogEditor();
    initCommentInteractions();
});
