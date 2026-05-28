import { onReady } from "../core/app.js";
import { initUsersAuth } from "../apps/users/auth.js";
import { initBlogManage } from "../apps/blog/manage.js";

onReady(function () {
    initUsersAuth(document);
    initBlogManage();
});
