import { onReady } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initBlogManage } from "../apps/blog/manage.js";

onReady(function () {
    initBlogShared();
    initBlogManage();
});
