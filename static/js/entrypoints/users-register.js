import { onReady } from "../core/app.js";
import { initUsersAuth } from "../apps/users/auth.js";

onReady(function () {
    initUsersAuth(document);
});
