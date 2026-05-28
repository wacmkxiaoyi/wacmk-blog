import { onReady } from "../core/app.js";
import { initBlogShared } from "../apps/blog/shared.js";

onReady(function () {
    initBlogShared();
});
