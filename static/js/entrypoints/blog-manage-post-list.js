import { onReady } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";
import { initManagePostListPage } from "../apps/blog/manage.js";

onReady(function () {
    initBlogShared();
    initManagePostListPage();
});
