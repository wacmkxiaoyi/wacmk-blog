import { onReady } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initBlogEditor } from "../apps/blog/editor.js";
import { initBlogManage } from "../apps/blog/manage.js";

onReady(function () {
    initBlogShared();
    initBlogEditor();
    initBlogManage();
});
