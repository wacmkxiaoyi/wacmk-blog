import { initBaseApp, onReady } from "../core/app.js";
import { initAccessGateLinks } from "../apps/blog/access-gate-link.js";

onReady(function () {
    initBaseApp();
    initAccessGateLinks();
});
