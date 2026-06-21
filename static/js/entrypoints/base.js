import { initBaseApp, onReady } from "../core/app.js";
import { initAccessGateLinks } from "../apps/blog/access-gate-link.js";
import { initLive2DWidget } from "../apps/blog/live2d.js";

onReady(function () {
    initBaseApp();
    initAccessGateLinks();
    initLive2DWidget();
});
