import { showInlineFlash } from "../../core/app.js";

function getLive2DRuntimeConfig() {
    var script = document.getElementById("live2d-runtime-config");
    if (!script) {
        return null;
    }
    try {
        return JSON.parse(script.textContent || "null");
    } catch (_error) {
        return null;
    }
}

var LIVE2D_HIDE_WIDTH = 768;
var LIVE2D_SCALE_START_WIDTH = 1200;
var LIVE2D_MIN_SCALE = 0.8;
var LIVE2D_IDLE_DELAY_MS = 20000;
var LIVE2D_TIP_DURATION_MS = 6000;
var LIVE2D_DRAG_START_THRESHOLD_PX = 8;
var LIVE2D_DRAG_TAP_SUPPRESS_MS = 250;
var LIVE2D_STORAGE_POSITION_KEY = "live2d-assistant-position";
var LIVE2D_STORAGE_HIDDEN_KEY = "live2d-assistant-hidden-at";
var LIVE2D_HIDE_TOGGLE_TTL_MS = 86400000;
var LIVE2D_STORAGE_WIDGET_DISABLED_KEY = "waifu-disabled";
var LIVE2D_STORAGE_WIDGET_POSITION_KEY = "waifu-display";
var live2dResizeBound = false;
var live2dInitStarted = false;
var live2dRuntimeState = {
    config: null,
    shell: null,
    tipTimer: 0,
    idleTimer: 0,
    idleBound: false,
    tipPriority: 0,
    tipHideAt: 0,
    hideMode: "visible",
    widgetManager: null,
    cubismManager: null,
    dragTapSuppressUntil: 0,
};

function getLive2DMessage(key, fallback) {
    var config = live2dRuntimeState.config;
    var messages = config && config.messages ? config.messages : null;
    var value = messages && typeof messages[key] === "string" ? messages[key] : "";
    return value || fallback || "";
}

function normalizeMotionGroupKey(name) {
    return String(name || "").replace(/[_-]/g, "").toLowerCase();
}

function pickTapMotionGroup(modelEntry) {
    var hitMotionGroups = modelEntry && Array.isArray(modelEntry.hitMotionGroups) ? modelEntry.hitMotionGroups : [];
    var motionGroups = modelEntry && Array.isArray(modelEntry.motionGroups) ? modelEntry.motionGroups : [];
    var fallbackKeys = ["tapbody", "tap", "touchbody", "bodytap", "idle"];
    var matched = "";
    if (hitMotionGroups.length) {
        return String(hitMotionGroups[0] || "");
    }
    fallbackKeys.some(function (fallbackKey) {
        matched = motionGroups.find(function (groupName) {
            return normalizeMotionGroupKey(groupName) === fallbackKey;
        }) || "";
        return Boolean(matched);
    });
    return matched;
}

function showLive2DToast(message, isSuccess) {
    if (!message) {
        return;
    }
    showInlineFlash(message, Boolean(isSuccess));
}

var LIVE2D_TOOL_ICONS = {
    "switch-model": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path d="M320 64A64 64 0 1 0 192 64a64 64 0 1 0 128 0zm-96 96c-35.3 0-64 28.7-64 64l0 48c0 17.7 14.3 32 32 32l1.8 0 11.1 99.5c1.8 16.2 15.5 28.5 31.8 28.5l38.7 0c16.3 0 30-12.3 31.8-28.5L318.2 304l1.8 0c17.7 0 32-14.3 32-32l0-48c0-35.3-28.7-64-64-64l-64 0zM132.3 394.2c13-2.4 21.7-14.9 19.3-27.9s-14.9-21.7-27.9-19.3c-32.4 5.9-60.9 14.2-82 24.8c-10.5 5.3-20.3 11.7-27.8 19.6C6.4 399.5 0 410.5 0 424c0 21.4 15.5 36.1 29.1 45c14.7 9.6 34.3 17.3 56.4 23.4C130.2 504.7 190.4 512 256 512s125.8-7.3 170.4-19.6c22.1-6.1 41.8-13.8 56.4-23.4c13.7-8.9 29.1-23.6 29.1-45c0-13.5-6.4-24.5-14-32.6c-7.5-7.9-17.3-14.3-27.8-19.6c-21-10.6-49.5-18.9-82-24.8c-13-2.4-25.5 6.3-27.9 19.3s6.3 25.5 19.3 27.9c30.2 5.5 53.7 12.8 69 20.5c3.2 1.6 5.8 3.1 7.9 4.5c3.6 2.4 3.6 7.2 0 9.6c-8.8 5.7-23.1 11.8-43 17.3C374.3 457 318.5 464 256 464s-118.3-7-157.7-17.9c-19.9-5.5-34.2-11.6-43-17.3c-3.6-2.4-3.6-7.2 0-9.6c2.1-1.4 4.8-2.9 7.9-4.5c15.3-7.7 38.8-14.9 69-20.5z"/></svg>',
    "switch-texture": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true"><path d="M211.8 0c7.8 0 14.3 5.7 16.7 13.2C240.8 51.9 277.1 80 320 80s79.2-28.1 91.5-66.8C413.9 5.7 420.4 0 428.2 0l12.6 0c22.5 0 44.2 7.9 61.5 22.3L628.5 127.4c6.6 5.5 10.7 13.5 11.4 22.1s-2.1 17.1-7.8 23.6l-56 64c-11.4 13.1-31.2 14.6-44.6 3.5L480 197.7 480 448c0 35.3-28.7 64-64 64l-192 0c-35.3 0-64-28.7-64-64l0-250.3-51.5 42.9c-13.3 11.1-33.1 9.6-44.6-3.5l-56-64c-5.7-6.5-8.5-15-7.8-23.6s4.8-16.6 11.4-22.1L137.7 22.3C155 7.9 176.7 0 199.2 0l12.6 0z"/></svg>',
    photo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path d="M220.6 121.2L271.1 96 448 96l0 96-114.8 0c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24L64 192l0-64 128 0c9.9 0 19.7-2.3 28.6-6.8zM0 128L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L271.1 32c-9.9 0-19.7 2.3-28.6 6.8L192 64l-32 0 0-16c0-8.8-7.2-16-16-16L80 32c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM168 304a88 88 0 1 1 176 0 88 88 0 1 1 -176 0z"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',
    quit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" aria-hidden="true"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>',
    toggle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" aria-hidden="true"><path d="M96 64a64 64 0 1 1 128 0A64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-192.2L59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z"/></svg>',
};

function loadScript(url) {
    return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[data-live2d-script="' + url + '"]');
        var script = null;
        if (existing) {
            resolve(existing);
            return;
        }
        script = document.createElement("script");
        script.type = "module";
        script.src = url;
        script.async = true;
        script.setAttribute("data-live2d-script", url);
        script.onload = function () { resolve(script); };
        script.onerror = function () { reject(new Error("Failed to load script: " + url)); };
        document.body.appendChild(script);
    });
}

function loadStylesheet(url) {
    return new Promise(function (resolve, reject) {
        var existing = document.querySelector('link[data-live2d-style="' + url + '"]');
        var link = null;
        if (existing) {
            resolve(existing);
            return;
        }
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.setAttribute("data-live2d-style", url);
        link.onload = function () { resolve(link); };
        link.onerror = function () { reject(new Error("Failed to load stylesheet: " + url)); };
        document.head.appendChild(link);
    });
}

function loadClassicScript(url) {
    return new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[data-live2d-classic-script="' + url + '"]');
        var script = null;
        if (existing) {
            resolve(existing);
            return;
        }
        script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.setAttribute("data-live2d-classic-script", url);
        script.onload = function () { resolve(script); };
        script.onerror = function () { reject(new Error("Failed to load script: " + url)); };
        document.body.appendChild(script);
    });
}

function createPixiApplication(canvas, width, height) {
    var Application = window.PIXI && window.PIXI.Application;
    var app = null;
    if (!Application) {
        throw new Error("PIXI.Application is not available");
    }
    app = new Application({
        view: canvas,
        width: width,
        height: height,
        backgroundAlpha: 0,
        clearBeforeRender: true,
        transparent: true,
        autoStart: true,
        antialias: true,
        preserveDrawingBuffer: true,
    });
    if (app && app.renderer) {
        if (Object.prototype.hasOwnProperty.call(app.renderer, "backgroundAlpha")) {
            app.renderer.backgroundAlpha = 0;
        }
        if (Object.prototype.hasOwnProperty.call(app.renderer, "background") && app.renderer.background && typeof app.renderer.background === "object") {
            if (Object.prototype.hasOwnProperty.call(app.renderer.background, "alpha")) {
                app.renderer.background.alpha = 0;
            }
        }
    }
    if (app && app.renderer && typeof app.renderer.resize === "function") {
        app.renderer.resize(width, height);
    }
    return app;
}

function configurePixiCursorStyles(app) {
    if (!app || !app.renderer || !app.renderer.events || !app.renderer.events.cursorStyles) {
        return;
    }
    app.renderer.events.cursorStyles.default = "grab";
    app.renderer.events.cursorStyles.pointer = "pointer";
}

function configureInteractiveLive2DModel(model) {
    if (!model) {
        return;
    }
    if ("eventMode" in model) {
        model.eventMode = "static";
    } else {
        model.interactive = true;
    }
    if ("cursor" in model) {
        model.cursor = "pointer";
    } else if ("buttonMode" in model) {
        model.buttonMode = true;
    }
}

function getViewportWidth() {
    return Math.max(window.innerWidth || 0, document.documentElement ? document.documentElement.clientWidth || 0 : 0);
}

function shouldSkipForViewport() {
    return getViewportWidth() > 0 && getViewportWidth() <= LIVE2D_HIDE_WIDTH;
}

function getResponsiveScale() {
    var width = getViewportWidth();
    var ratio = 1;
    if (!width || width >= LIVE2D_SCALE_START_WIDTH) {
        return 1;
    }
    ratio = width / LIVE2D_SCALE_START_WIDTH;
    return Math.max(LIVE2D_MIN_SCALE, Math.min(1, Number(ratio.toFixed(3))));
}

function getLive2DShell(root) {
    var shell = root.querySelector('[data-live2d-shell]');
    var tips = null;
    var host = null;
    var toolbar = null;
    var toggle = null;
    if (!shell) {
        shell = document.createElement("div");
        shell.className = "live2d-assistant-shell waifu";
        shell.setAttribute("data-live2d-shell", "true");
        shell.setAttribute("aria-hidden", "true");
        shell.innerHTML = '<div class="live2d-assistant-tips" data-live2d-tips></div><div class="live2d-assistant-stage" data-live2d-stage-host></div><div class="live2d-assistant-toolbar" data-live2d-toolbar></div>';
        root.appendChild(shell);
    }
    tips = shell.querySelector('[data-live2d-tips]');
    host = shell.querySelector('[data-live2d-stage-host]');
    toolbar = shell.querySelector('[data-live2d-toolbar]');
    toggle = root.querySelector('[data-live2d-toggle]');
    if (!toggle) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "live2d-assistant-toggle";
        toggle.setAttribute("data-live2d-toggle", "true");
        toggle.setAttribute("aria-label", "Show assistant");
        toggle.innerHTML = LIVE2D_TOOL_ICONS.toggle;
        root.appendChild(toggle);
    }
    if (!toggle.__live2dBound) {
        toggle.__live2dBound = true;
        toggle.addEventListener("click", function () {
            markAssistantInteraction();
            clearAssistantHiddenState();
            setAssistantHideMode("visible");
            if (document.getElementById("waifu")) {
                document.getElementById("waifu").classList.remove("waifu-hidden");
                document.getElementById("waifu").classList.add("waifu-active");
            }
            applyAssistantLayout();
            showTipMessage(live2dRuntimeState.config, [getLive2DMessage("welcomeBack", "Welcome back.")]);
        });
    }
    return {
        root: root,
        shell: shell,
        tips: tips,
        host: host,
        toolbar: toolbar,
        toggle: toggle,
    };
}

function ensureAssistantShell() {
    var root = document.getElementById("live2d-root");
    if (!root) {
        return null;
    }
    root.hidden = false;
    live2dRuntimeState.shell = getLive2DShell(root);
    return live2dRuntimeState.shell;
}

function getStoredAssistantPosition() {
    var payload = "";
    if (typeof window.localStorage === "undefined") {
        return null;
    }
    payload = window.localStorage.getItem(LIVE2D_STORAGE_POSITION_KEY) || "";
    if (!payload) {
        return null;
    }
    try {
        payload = JSON.parse(payload);
    } catch (_error) {
        return null;
    }
    if (!payload || typeof payload.left !== "number" || typeof payload.top !== "number") {
        return null;
    }
    return payload;
}

function setStoredAssistantPosition(left, top) {
    if (typeof window.localStorage === "undefined") {
        return;
    }
    window.localStorage.setItem(LIVE2D_STORAGE_POSITION_KEY, JSON.stringify({ left: left, top: top }));
}

function clampAssistantPosition(left, top, shell) {
    var width = shell ? shell.offsetWidth || 0 : 0;
    var height = shell ? shell.offsetHeight || 0 : 0;
    var maxLeft = Math.max(0, (window.innerWidth || 0) - width);
    var maxTop = Math.max(0, (window.innerHeight || 0) - height);
    return {
        left: Math.max(0, Math.min(maxLeft, left)),
        top: Math.max(0, Math.min(maxTop, top)),
    };
}

function setAssistantCustomPosition(left, top) {
    var shellState = live2dRuntimeState.shell;
    var position = null;
    if (!shellState || !shellState.shell) {
        return;
    }
    position = clampAssistantPosition(left, top, shellState.shell);
    shellState.shell.style.left = position.left + "px";
    shellState.shell.style.top = position.top + "px";
    shellState.shell.style.bottom = "auto";
    shellState.shell.style.transformOrigin = "top left";
    shellState.shell.setAttribute("data-live2d-positioned", "true");
    setStoredAssistantPosition(position.left, position.top);
}

function clearAssistantCustomPosition() {
    var shellState = live2dRuntimeState.shell;
    if (!shellState || !shellState.shell) {
        return;
    }
    shellState.shell.style.left = "0";
    shellState.shell.style.top = "";
    shellState.shell.style.bottom = "0";
    shellState.shell.removeAttribute("data-live2d-positioned");
}

function bindAssistantDrag() {
    var shellState = live2dRuntimeState.shell;
    var shell = shellState ? shellState.shell : null;
    var host = shellState ? shellState.host : null;
    var cubismManager = live2dRuntimeState.cubismManager;
    if (!shell || !host || shell.__live2dDragBound) {
        return;
    }
    shell.__live2dDragBound = true;
    host.addEventListener("pointerdown", function (event) {
        var rect = null;
        var offsetX = 0;
        var offsetY = 0;
        var startX = 0;
        var startY = 0;
        var dragStarted = false;
        if (event.button != null && event.button !== 0) {
            return;
        }
        if (shouldSkipForViewport()) {
            return;
        }
        rect = shell.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        startX = event.clientX;
        startY = event.clientY;
        host.setPointerCapture(event.pointerId);
        markAssistantInteraction();
        function onMove(moveEvent) {
            var deltaX = moveEvent.clientX - startX;
            var deltaY = moveEvent.clientY - startY;
            var movedDistanceSquared = (deltaX * deltaX) + (deltaY * deltaY);
            if (!dragStarted && movedDistanceSquared >= (LIVE2D_DRAG_START_THRESHOLD_PX * LIVE2D_DRAG_START_THRESHOLD_PX)) {
                dragStarted = true;
                shell.setAttribute("data-live2d-dragging", "true");
                live2dRuntimeState.dragTapSuppressUntil = Date.now() + LIVE2D_DRAG_TAP_SUPPRESS_MS;
                if (cubismManager && typeof cubismManager.playDragStartReaction === "function") {
                    cubismManager.playDragStartReaction();
                }
            }
            if (!dragStarted) {
                return;
            }
            setAssistantCustomPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY);
        }
        function onEnd(endEvent) {
            if (host.hasPointerCapture && host.hasPointerCapture(endEvent.pointerId)) {
                host.releasePointerCapture(endEvent.pointerId);
            }
            host.removeEventListener("pointermove", onMove);
            host.removeEventListener("pointerup", onEnd);
            host.removeEventListener("pointercancel", onEnd);
            if (dragStarted) {
                shell.removeAttribute("data-live2d-dragging");
            }
            if (dragStarted && cubismManager && typeof cubismManager.playDragEndReaction === "function") {
                cubismManager.playDragEndReaction();
            }
        }
        host.addEventListener("pointermove", onMove);
        host.addEventListener("pointerup", onEnd);
        host.addEventListener("pointercancel", onEnd);
    });
}

function markAssistantInteraction() {
    resetIdleTipsTimer();
}

function clearTipMessage() {
    var shellState = live2dRuntimeState.shell;
    if (!shellState || !shellState.tips) {
        return;
    }
    shellState.tips.classList.remove("live2d-assistant-tips-active");
    live2dRuntimeState.tipPriority = 0;
    live2dRuntimeState.tipHideAt = 0;
    if (live2dRuntimeState.tipTimer) {
        window.clearTimeout(live2dRuntimeState.tipTimer);
        live2dRuntimeState.tipTimer = 0;
    }
}

function showTipMessage(config, messages, timeout, priority, override) {
    var shellState = live2dRuntimeState.shell;
    var list = Array.isArray(messages) ? messages.filter(Boolean) : [];
    var message = "";
    var duration = typeof timeout === "number" ? timeout : LIVE2D_TIP_DURATION_MS;
    var level = typeof priority === "number" ? priority : 9;
    var shouldOverride = override !== false;
    if (!list.length) {
        return;
    }
    if (!shouldOverride && live2dRuntimeState.tipPriority >= level) {
        return;
    }
    if (shouldOverride && live2dRuntimeState.tipPriority > level && Date.now() < live2dRuntimeState.tipHideAt) {
        return;
    }
    message = list[Math.floor(Math.random() * list.length)];
    if (shellState && shellState.tips) {
        if (live2dRuntimeState.tipTimer) {
            window.clearTimeout(live2dRuntimeState.tipTimer);
            live2dRuntimeState.tipTimer = 0;
        }
        live2dRuntimeState.tipPriority = level;
        live2dRuntimeState.tipHideAt = Date.now() + duration;
        shellState.tips.innerHTML = message;
        shellState.tips.classList.add("live2d-assistant-tips-active");
        live2dRuntimeState.tipTimer = window.setTimeout(function () {
            clearTipMessage();
        }, duration);
        return;
    }
    if (typeof window.showMessage === "function") {
        window.showMessage(message, duration, level);
    } else if (typeof window.waifuTips === "function") {
        window.waifuTips(message);
    }
}

function bindTips(config) {
    var tips = config && config.tips ? config.tips : null;
    var tipConfig = tips && tips.config ? tips.config : null;
    var pageRules = tipConfig && Array.isArray(tipConfig.rules) ? tipConfig.rules : [];
    var pageMessages = tipConfig && tipConfig.pages ? tipConfig.pages[config.pageGroup] || [] : [];
    if (!tips || !tips.enabled || !tipConfig) {
        return;
    }
    showTipMessage(config, tipConfig.welcome, 7000, 11);
    if (pageMessages.length) {
        window.setTimeout(function () {
            showTipMessage(config, pageMessages, 6000, 10);
        }, 1200);
    }
    pageRules.forEach(function (rule) {
        var pageGroups = Array.isArray(rule.pageGroups) ? rule.pageGroups : [];
        if (pageGroups.length && pageGroups.indexOf(config.pageGroup) === -1) {
            return;
        }
        Array.prototype.forEach.call(document.querySelectorAll(rule.selector), function (node) {
            if (node.getAttribute("data-live2d-tip-bound") === "true") {
                return;
            }
            node.setAttribute("data-live2d-tip-bound", "true");
            node.addEventListener("mouseenter", function () {
                markAssistantInteraction();
                showTipMessage(config, rule.texts, 4000, 8);
            });
        });
    });
    if (!document.__live2dClickBound) {
        document.__live2dClickBound = true;
        document.addEventListener("click", function (event) {
            var shell = live2dRuntimeState.shell ? live2dRuntimeState.shell.shell : null;
            var target = event.target;
            var waifu = target && target.closest ? target.closest("#waifu, [data-live2d-shell], .waifu") : null;
            if (waifu && shell) {
                markAssistantInteraction();
                showTipMessage(live2dRuntimeState.config, live2dRuntimeState.config && live2dRuntimeState.config.tips && live2dRuntimeState.config.tips.config ? live2dRuntimeState.config.tips.config.touch : [], 4000, 9);
            }
        });
    }
    resetIdleTipsTimer();
}

function resetIdleTipsTimer() {
    var config = live2dRuntimeState.config;
    var idleMessages = config && config.tips && config.tips.config ? config.tips.config.idle : [];
    if (live2dRuntimeState.idleTimer) {
        window.clearTimeout(live2dRuntimeState.idleTimer);
        live2dRuntimeState.idleTimer = 0;
    }
    if (!idleMessages || !idleMessages.length || !config || !config.tips || !config.tips.enabled) {
        return;
    }
    live2dRuntimeState.idleTimer = window.setTimeout(function () {
        showTipMessage(config, idleMessages, 6000, 9, false);
        resetIdleTipsTimer();
    }, LIVE2D_IDLE_DELAY_MS);
}

function bindIdleActivityListeners() {
    var shellState = live2dRuntimeState.shell;
    if (!shellState || live2dRuntimeState.idleBound) {
        return;
    }
    live2dRuntimeState.idleBound = true;
    ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"].forEach(function (eventName) {
        window.addEventListener(eventName, markAssistantInteraction, { passive: true });
    });
    shellState.shell.addEventListener("mouseenter", markAssistantInteraction);
}

function setAssistantHideMode(mode) {
    live2dRuntimeState.hideMode = mode;
    if (typeof window.localStorage === "undefined") {
        return;
    }
    if (mode === "hidden") {
        window.localStorage.setItem(LIVE2D_STORAGE_HIDDEN_KEY, String(Date.now()));
        window.localStorage.setItem(LIVE2D_STORAGE_WIDGET_POSITION_KEY, String(Date.now()));
        window.localStorage.removeItem(LIVE2D_STORAGE_WIDGET_DISABLED_KEY);
    } else {
        window.localStorage.removeItem(LIVE2D_STORAGE_HIDDEN_KEY);
        window.localStorage.removeItem(LIVE2D_STORAGE_WIDGET_POSITION_KEY);
        window.localStorage.removeItem(LIVE2D_STORAGE_WIDGET_DISABLED_KEY);
    }
}

function getAssistantHideMode() {
    var hiddenAt = 0;
    if (live2dRuntimeState.hideMode === "hidden") {
        return "hidden";
    }
    if (typeof window.localStorage === "undefined") {
        return "visible";
    }
    hiddenAt = parseInt(window.localStorage.getItem(LIVE2D_STORAGE_HIDDEN_KEY) || window.localStorage.getItem(LIVE2D_STORAGE_WIDGET_POSITION_KEY) || "0", 10);
    if (hiddenAt && Date.now() - hiddenAt <= LIVE2D_HIDE_TOGGLE_TTL_MS) {
        return "hidden";
    }
    return "visible";
}

function clearAssistantHiddenState() {
    live2dRuntimeState.hideMode = "visible";
    if (typeof window.localStorage === "undefined") {
        return;
    }
    window.localStorage.removeItem(LIVE2D_STORAGE_HIDDEN_KEY);
    window.localStorage.removeItem(LIVE2D_STORAGE_WIDGET_POSITION_KEY);
    window.localStorage.removeItem(LIVE2D_STORAGE_WIDGET_DISABLED_KEY);
}

function applyAssistantLayout() {
    var root = document.documentElement;
    var styleId = "live2d-runtime-style";
    var style = document.getElementById(styleId);
    var scale = getResponsiveScale();
    var shellState = live2dRuntimeState.shell;
    var hiddenForViewport = shouldSkipForViewport();
    var hiddenByUser = getAssistantHideMode() === "hidden";
    var storedPosition = null;
    if (!root) {
        return;
    }
    root.style.setProperty("--live2d-scale", String(scale));
    if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.head.appendChild(style);
    }
    style.textContent = "#live2d-root{position:fixed;left:0;bottom:0;z-index:998;pointer-events:none;}"
        + ".live2d-assistant-shell{bottom:-500px;left:0;position:fixed;transform:translateY(25px) scale(var(--live2d-scale));transform-origin:bottom left;transition:transform .3s ease-in-out,bottom 3s ease-in-out,opacity .3s ease-in-out;pointer-events:auto;z-index:998;}"
        + ".live2d-assistant-shell.live2d-assistant-active{bottom:0;}"
        + ".live2d-assistant-shell.live2d-assistant-hidden{display:none;}"
        + ".live2d-assistant-shell[data-live2d-dragging='true']{transition:none;}"
        + ".live2d-assistant-shell:hover{transform:translateY(20px) scale(var(--live2d-scale));}"
        + ".live2d-assistant-tips{animation:live2d-waifu-shake 50s ease-in-out 5s infinite;background-color:rgba(236,217,188,.5);border:1px solid rgba(224,186,140,.62);border-radius:12px;box-shadow:0 3px 15px 2px rgba(191,158,118,.2);font-size:14px;line-height:24px;margin:-30px 20px;min-height:70px;opacity:0;overflow:hidden;padding:5px 10px;position:absolute;text-overflow:ellipsis;transition:opacity 1s;width:250px;word-break:break-word;color:#5f4b32;}"
        + ".live2d-assistant-tips.live2d-assistant-tips-active{opacity:1;transition:opacity .2s;}"
        + ".live2d-assistant-stage{position:relative;width:300px;height:300px;}"
        + ".live2d-assistant-stage canvas{cursor:inherit;display:block;height:300px;width:300px;}"
        + ".live2d-assistant-stage canvas:active{cursor:inherit;}"
        + ".live2d-assistant-toolbar{align-items:center;display:flex;flex-direction:column;gap:5px;opacity:0;position:absolute;right:-10px;top:70px;transition:opacity 1s;}"
        + ".live2d-assistant-shell:hover .live2d-assistant-toolbar{opacity:1;}"
        + ".live2d-assistant-tool{align-items:center;background:none;border:0;cursor:pointer;display:flex;height:25px;justify-content:center;padding:0;width:25px;}"
        + ".live2d-assistant-tool svg{display:block;fill:#7b8c9d;height:25px;transition:fill .3s;width:25px;}"
        + ".live2d-assistant-tool:hover svg,.live2d-assistant-tool:focus-visible svg{fill:#0684bd;}"
        + ".live2d-assistant-tool[disabled]{cursor:default;opacity:.35;}"
        + ".live2d-assistant-toggle{background-color:#fa0;border:0;border-radius:5px;bottom:66px;cursor:pointer;display:flex;justify-content:flex-end;left:0;margin-left:-100px;padding:5px;pointer-events:auto;position:fixed;transition:margin-left 1s;width:60px;z-index:997;}"
        + ".live2d-assistant-toggle.live2d-assistant-toggle-active{margin-left:-50px;}"
        + ".live2d-assistant-toggle.live2d-assistant-toggle-active:hover{margin-left:-30px;}"
        + ".live2d-assistant-toggle svg{fill:#fff;height:25px;width:25px;}"
        + ".live2d-assistant-info{background-color:rgba(236,217,188,.94);border:1px solid rgba(224,186,140,.62);border-radius:12px;box-shadow:0 3px 15px 2px rgba(191,158,118,.2);color:#5f4b32;font-size:13px;line-height:1.5;max-width:250px;padding:8px 10px;position:absolute;right:28px;top:70px;}"
        + ".live2d-assistant-info[hidden]{display:none;}"
        + "@keyframes live2d-waifu-shake{2%{transform:translate(.5px,-1.5px) rotate(-.5deg);}4%{transform:translate(.5px,1.5px) rotate(1.5deg);}6%{transform:translate(1.5px,1.5px) rotate(1.5deg);}8%{transform:translate(2.5px,1.5px) rotate(.5deg);}10%{transform:translate(.5px,2.5px) rotate(.5deg);}12%{transform:translate(1.5px,1.5px) rotate(.5deg);}14%{transform:translate(.5px,.5px) rotate(.5deg);}16%{transform:translate(-1.5px,-.5px) rotate(1.5deg);}18%{transform:translate(.5px,.5px) rotate(1.5deg);}20%{transform:translate(2.5px,2.5px) rotate(1.5deg);}22%{transform:translate(.5px,-1.5px) rotate(1.5deg);}24%{transform:translate(-1.5px,1.5px) rotate(-.5deg);}26%{transform:translate(1.5px,.5px) rotate(1.5deg);}28%{transform:translate(-.5px,-.5px) rotate(-.5deg);}30%{transform:translate(1.5px,-.5px) rotate(-.5deg);}32%{transform:translate(2.5px,-1.5px) rotate(1.5deg);}34%{transform:translate(2.5px,2.5px) rotate(-.5deg);}36%{transform:translate(.5px,-1.5px) rotate(.5deg);}38%{transform:translate(2.5px,-.5px) rotate(-.5deg);}40%{transform:translate(-.5px,2.5px) rotate(.5deg);}42%{transform:translate(-1.5px,2.5px) rotate(.5deg);}44%{transform:translate(-1.5px,1.5px) rotate(.5deg);}46%{transform:translate(1.5px,-.5px) rotate(-.5deg);}48%{transform:translate(2.5px,-.5px) rotate(.5deg);}50%{transform:translate(-1.5px,1.5px) rotate(.5deg);}52%{transform:translate(-.5px,1.5px) rotate(.5deg);}54%{transform:translate(-1.5px,1.5px) rotate(.5deg);}56%{transform:translate(.5px,2.5px) rotate(1.5deg);}58%{transform:translate(2.5px,2.5px) rotate(.5deg);}60%{transform:translate(2.5px,-1.5px) rotate(1.5deg);}62%{transform:translate(-1.5px,.5px) rotate(1.5deg);}64%{transform:translate(-1.5px,1.5px) rotate(1.5deg);}66%{transform:translate(.5px,2.5px) rotate(1.5deg);}68%{transform:translate(2.5px,-1.5px) rotate(1.5deg);}70%{transform:translate(2.5px,2.5px) rotate(.5deg);}72%{transform:translate(-.5px,-1.5px) rotate(1.5deg);}74%{transform:translate(-1.5px,2.5px) rotate(1.5deg);}76%{transform:translate(-1.5px,2.5px) rotate(1.5deg);}78%{transform:translate(-1.5px,2.5px) rotate(.5deg);}80%{transform:translate(-1.5px,.5px) rotate(-.5deg);}82%{transform:translate(-1.5px,.5px) rotate(-.5deg);}84%{transform:translate(-.5px,.5px) rotate(1.5deg);}86%{transform:translate(2.5px,1.5px) rotate(.5deg);}88%{transform:translate(-1.5px,.5px) rotate(1.5deg);}90%{transform:translate(-1.5px,-.5px) rotate(-.5deg);}92%{transform:translate(-1.5px,-1.5px) rotate(1.5deg);}94%{transform:translate(.5px,.5px) rotate(-.5deg);}96%{transform:translate(2.5px,-.5px) rotate(-.5deg);}98%{transform:translate(-1.5px,-1.5px) rotate(-.5deg);}0%,100%{transform:translate(0,0) rotate(0);}}";
    if (!shellState || !shellState.shell) {
        return;
    }
    shellState.shell.classList.toggle("live2d-assistant-hidden", hiddenForViewport || hiddenByUser);
    shellState.shell.classList.toggle("live2d-assistant-active", !(hiddenForViewport || hiddenByUser));
    shellState.toggle.classList.toggle("live2d-assistant-toggle-active", !hiddenForViewport && hiddenByUser);
    shellState.toggle.hidden = hiddenForViewport || !hiddenByUser;
    if (hiddenForViewport || hiddenByUser) {
        return;
    }
    storedPosition = getStoredAssistantPosition();
    if (storedPosition) {
        setAssistantCustomPosition(storedPosition.left, storedPosition.top);
    } else {
        clearAssistantCustomPosition();
    }
}

function bindResponsiveLayout() {
    if (live2dResizeBound) {
        return;
    }
    live2dResizeBound = true;
    window.addEventListener("resize", applyAssistantLayout);
}

function normalizeModelListPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (payload && Array.isArray(payload.models)) {
        return payload.models;
    }
    return [];
}

function buildModelListUrl(entry) {
    var assetsBase = entry && entry.assetsBase ? String(entry.assetsBase) : "";
    if (!assetsBase) {
        return "";
    }
    if (assetsBase.charAt(assetsBase.length - 1) !== "/") {
        assetsBase += "/";
    }
    return assetsBase + "model_list.json";
}

function buildWidgetModelConfigUrl(entry, modelEntry) {
    var assetsBase = entry && entry.assetsBase ? String(entry.assetsBase) : "";
    var normalized = "";
    if (!assetsBase || !modelEntry || typeof modelEntry !== "string") {
        return "";
    }
    normalized = modelEntry.replace(/^\/+/, "");
    if (assetsBase.charAt(assetsBase.length - 1) !== "/") {
        assetsBase += "/";
    }
    return assetsBase + "model/" + normalized + "/index.json";
}

function buildWidgetTextureCacheUrl(entry, modelEntry) {
    var assetsBase = entry && entry.assetsBase ? String(entry.assetsBase) : "";
    var normalized = "";
    if (!assetsBase || !modelEntry || typeof modelEntry !== "string") {
        return "";
    }
    normalized = modelEntry.replace(/^\/+/, "");
    if (assetsBase.charAt(assetsBase.length - 1) !== "/") {
        assetsBase += "/";
    }
    return assetsBase + "model/" + normalized + "/textures.cache";
}

function pickRandomModelIdFromList(models, fallbackModelId) {
    var normalized = Array.isArray(models) ? models.filter(Boolean) : [];
    var randomEntry = null;
    var numericId = null;
    if (!normalized.length) {
        return fallbackModelId;
    }
    randomEntry = normalized[Math.floor(Math.random() * normalized.length)];
    if (randomEntry && typeof randomEntry === "object" && randomEntry.id != null) {
        numericId = parseInt(randomEntry.id, 10);
        if (!isNaN(numericId)) {
            return numericId;
        }
    }
    return normalized.indexOf(randomEntry);
}

function resolveRuntimeModelId(config, entry) {
    var models = config && Array.isArray(config.availableModels) ? config.availableModels : [];
    var randomModelEnabled = !config || config.randomModel !== false;
    var fallbackModelId = config && config.modelId != null ? config.modelId : 0;
    var modelListUrl = "";
    if (!randomModelEnabled) {
        return Promise.resolve(fallbackModelId);
    }
    if (models.length) {
        return Promise.resolve(pickRandomModelIdFromList(models, fallbackModelId));
    }
    modelListUrl = buildModelListUrl(entry);
    if (!modelListUrl || typeof window.fetch !== "function") {
        return Promise.resolve(fallbackModelId);
    }
    return window.fetch(modelListUrl, { credentials: "omit" })
        .then(function (response) {
            if (!response || !response.ok) {
                throw new Error("Failed to load model list");
            }
            return response.json();
        })
        .then(function (payload) {
            return pickRandomModelIdFromList(normalizeModelListPayload(payload), fallbackModelId);
        })
        .catch(function () {
            return fallbackModelId;
        });
}

function persistRuntimeModelSelection(modelId, textureId) {
    if (modelId == null || typeof window.localStorage === "undefined") {
        return;
    }
    window.localStorage.setItem("modelId", String(modelId));
    window.localStorage.setItem("modelTexturesId", String(textureId != null ? textureId : 0));
}

function readStoredTextureId() {
    var value = 0;
    if (typeof window.localStorage === "undefined") {
        return 0;
    }
    value = parseInt(window.localStorage.getItem("modelTexturesId") || "0", 10);
    return isNaN(value) ? 0 : value;
}

function getCubismModelEntry(config, resolvedModelId) {
    var models = config && config.entry && Array.isArray(config.entry.models) ? config.entry.models : [];
    var fallbackEntry = models.length ? models[0] : null;
    var matchedEntry = fallbackEntry;
    models.forEach(function (item) {
        if (item && item.id === resolvedModelId) {
            matchedEntry = item;
        }
    });
    return matchedEntry;
}

function getCubismModelEntries(config) {
    return config && config.entry && Array.isArray(config.entry.models) ? config.entry.models.filter(Boolean) : [];
}

function getCubismGroupId(modelEntry) {
    if (!modelEntry) {
        return "";
    }
    return String(modelEntry.groupId || modelEntry.name || modelEntry.id || "");
}

function getCubismTextureVariantId(modelEntry) {
    if (!modelEntry) {
        return "";
    }
    return String(modelEntry.textureVariantId || modelEntry.id || "");
}

function getCubismTextureVariants(config, currentEntry) {
    var models = getCubismModelEntries(config);
    var groupId = getCubismGroupId(currentEntry);
    return models.filter(function (item) {
        return getCubismGroupId(item) === groupId;
    });
}

function getCubismGroupOrder(config) {
    var models = getCubismModelEntries(config);
    var groups = [];
    var seen = {};
    models.forEach(function (item) {
        var groupId = getCubismGroupId(item);
        if (!groupId || seen[groupId]) {
            return;
        }
        seen[groupId] = true;
        groups.push(groupId);
    });
    return groups;
}

function buildInfoMessage(config, manager) {
    var details = [];
    var name = manager && typeof manager.getCurrentModelName === "function" ? manager.getCurrentModelName() : "";
    var engine = config && config.engine ? String(config.engine) : "live2d";
    var variant = manager && typeof manager.getCurrentTextureVariantName === "function" ? manager.getCurrentTextureVariantName() : "";
    var motionGroups = manager && typeof manager.listMotionGroups === "function" ? manager.listMotionGroups() : [];
    var expressions = manager && typeof manager.listExpressions === "function" ? manager.listExpressions() : [];
    if (name) {
        details.push("Model: " + name);
    }
    if (variant) {
        details.push("Appearance: " + variant);
    }
    if (motionGroups.length) {
        details.push("Motions: " + motionGroups.join(", "));
    }
    if (expressions.length) {
        details.push("Expressions: " + expressions.map(function (item) {
            return item && item.name ? item.name : "";
        }).filter(Boolean).join(", "));
    }
    details.push("Engine: " + engine);
    if (config && config.sourceType) {
        details.push("Source: " + config.sourceType);
    }
    return details.join("<br>");
}

function renderAssistantInfo(config, manager) {
    var shellState = live2dRuntimeState.shell;
    var info = null;
    if (!shellState || !shellState.toolbar) {
        return;
    }
    info = shellState.shell.querySelector('[data-live2d-info]');
    if (!info) {
        info = document.createElement("div");
        info.className = "live2d-assistant-info";
        info.setAttribute("data-live2d-info", "true");
        info.hidden = true;
        shellState.shell.appendChild(info);
    }
    info.innerHTML = buildInfoMessage(config, manager);
    info.hidden = false;
    window.setTimeout(function () {
        info.hidden = true;
    }, 5000);
}

function createToolbarButton(toolName, label, onClick, disabled) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "live2d-assistant-tool";
    button.setAttribute("data-live2d-tool", toolName);
    button.setAttribute("aria-label", label);
    button.innerHTML = LIVE2D_TOOL_ICONS[toolName] || "";
    if (disabled) {
        button.disabled = true;
    } else {
        button.addEventListener("click", function () {
            markAssistantInteraction();
            onClick();
        });
    }
    return button;
}

function renderToolbar(config, manager) {
    var shellState = live2dRuntimeState.shell;
    var toolbar = shellState ? shellState.toolbar : null;
    var tools = [];
    if (!toolbar) {
        return;
    }
    toolbar.innerHTML = "";
    tools.push(createToolbarButton("switch-model", "Switch model", function () {
        if (manager && typeof manager.switchModel === "function") {
            manager.switchModel();
        }
    }, !(manager && typeof manager.switchModel === "function")));
    tools.push(createToolbarButton("switch-texture", "Switch appearance", function () {
        if (manager && typeof manager.switchTexture === "function") {
            manager.switchTexture();
        }
    }, !(manager && typeof manager.switchTexture === "function")));
    tools.push(createToolbarButton("photo", "Take photo", function () {
        if (manager && typeof manager.takePhoto === "function") {
            manager.takePhoto();
        }
    }, !(manager && typeof manager.takePhoto === "function")));
    tools.push(createToolbarButton("info", "Assistant info", function () {
        renderAssistantInfo(config, manager);
    }, false));
    tools.push(createToolbarButton("quit", "Hide assistant", function () {
        setAssistantHideMode("hidden");
        applyAssistantLayout();
        showTipMessage(config, [getLive2DMessage("goodbye", "See you next time.")], 2000, 11);
    }, false));
    tools.forEach(function (button) {
        toolbar.appendChild(button);
    });
}

function ensureCubismCanvas(shellState) {
    var canvas = shellState ? shellState.host.querySelector("canvas") : null;
    if (!canvas && shellState) {
        canvas = document.createElement("canvas");
        canvas.id = "live2d-cubism-canvas";
        canvas.width = 800;
        canvas.height = 800;
        shellState.host.innerHTML = "";
        shellState.host.appendChild(canvas);
    }
    return canvas;
}

function destroyCubismApp(manager) {
    if (!manager || !manager.app) {
        return;
    }
    manager.app.destroy(true, { children: true, texture: false, baseTexture: false });
    manager.app = null;
    manager.model = null;
}

function destroyPixiAppInstance(app) {
    if (!app) {
        return;
    }
    app.destroy(true, { children: true, texture: false, baseTexture: false });
}

function createCubismManager(config, entry, shellState) {
    var manager = {
        entry: entry,
        config: config,
        shellState: shellState,
        app: null,
        model: null,
        currentModelId: null,
        currentModelEntry: null,
        currentTextureVariantIndex: 0,
        currentMotionGroupIndex: 0,
        currentExpressionIndex: -1,
        canvasWidth: 300,
        canvasHeight: 300,
        isMounted: false,
        getCurrentModelMeta: function () {
            return this.currentModelEntry || null;
        },
        resolveSemanticMotionGroup: function (semanticName) {
            var motionGroups = this.listMotionGroups();
            var normalizedSemantic = String(semanticName || "");
            var candidates = [];
            if (!motionGroups.length) {
                return "";
            }
            if (normalizedSemantic === "idle") {
                candidates = ["idle"];
            } else if (normalizedSemantic === "tap") {
                candidates = ["tapbody", "tap", "touchbody", "bodytap"];
            } else if (normalizedSemantic === "dragStart") {
                candidates = ["flic", "flick"];
            } else if (normalizedSemantic === "dragEnd") {
                candidates = ["idle"];
            }
            return motionGroups.find(function (groupName) {
                return candidates.indexOf(normalizeMotionGroupKey(groupName)) !== -1;
            }) || "";
        },
        listMotionGroups: function () {
            return this.currentModelEntry && Array.isArray(this.currentModelEntry.motionGroups) ? this.currentModelEntry.motionGroups.slice() : [];
        },
        listExpressions: function () {
            return this.currentModelEntry && Array.isArray(this.currentModelEntry.expressions) ? this.currentModelEntry.expressions.slice() : [];
        },
        canSwitchExpression: function () {
            return this.listExpressions().length > 0;
        },
        hasPlayableMotions: function () {
            return this.listMotionGroups().length > 0;
        },
        playMotion: function (groupName) {
            if (!this.model || typeof this.model.motion !== "function" || !groupName) {
                return false;
            }
            try {
                this.model.motion(groupName);
                return true;
            } catch (_error) {
                return false;
            }
        },
        playExpression: function (expressionId) {
            var model = this.model;
            if (!model || typeof model.expression !== "function") {
                return Promise.resolve(false);
            }
            return Promise.resolve(model.expression(expressionId)).then(function (result) {
                return result !== false;
            }).catch(function () {
                return false;
            });
        },
        playSemanticMotion: function (semanticName) {
            var groupName = this.resolveSemanticMotionGroup(semanticName);
            if (!groupName) {
                return false;
            }
            return this.playMotion(groupName);
        },
        playIdleMotion: function () {
            return this.playSemanticMotion("idle");
        },
        playTapReaction: function () {
            return this.playSemanticMotion("tap");
        },
        playDragStartReaction: function () {
            return this.playSemanticMotion("dragStart");
        },
        playDragEndReaction: function () {
            var self = this;
            var played = self.playSemanticMotion("dragEnd");
            if (played) {
                window.setTimeout(function () {
                    self.playIdleMotion();
                }, 1000);
            }
            return played;
        },
        canSwitchTexture: function () {
            return getCubismTextureVariants(config, this.currentModelEntry).length > 1;
        },
        getCurrentModelName: function () {
            return this.currentModelEntry && this.currentModelEntry.name ? this.currentModelEntry.name : "";
        },
        getCurrentTextureVariantName: function () {
            return this.currentModelEntry && this.currentModelEntry.textureVariantName ? this.currentModelEntry.textureVariantName : "";
        },
        mount: function (resolvedModelId) {
            var Application = null;
            var Live2DModel = null;
            var self = this;
            var host = shellState ? shellState.host : null;
            var previousApp = this.app;
            var previousModel = this.model;
            var previousModelId = this.currentModelId;
            var previousModelEntry = this.currentModelEntry;
            var previousTextureVariantIndex = this.currentTextureVariantIndex;
            var variants = [];
            var nextModelEntry = getCubismModelEntry(config, resolvedModelId);
            var nextTextureVariantIndex = 0;
            var nextApp = null;
            var nextModel = null;
            var canvas = null;
            if (!host || !nextModelEntry || !nextModelEntry.modelJsonUrl || !window.PIXI || !window.PIXI.live2d || !window.PIXI.live2d.Live2DModel) {
                return Promise.resolve();
            }
            variants = getCubismTextureVariants(config, nextModelEntry);
            nextTextureVariantIndex = Math.max(0, variants.findIndex(function (item) {
                return getCubismTextureVariantId(item) === getCubismTextureVariantId(nextModelEntry);
            }));
            Application = window.PIXI.Application;
            Live2DModel = window.PIXI.live2d.Live2DModel;
            canvas = document.createElement("canvas");
            canvas.id = "live2d-cubism-canvas";
            canvas.width = 800;
            canvas.height = 800;
            try {
                nextApp = createPixiApplication(canvas, self.canvasWidth, self.canvasHeight);
            } catch (error) {
                console.error(error);
                return Promise.reject(error);
            }
            return Live2DModel.from(nextModelEntry.modelJsonUrl).then(function (model) {
                var targetHeight = self.canvasHeight * 0.92;
                var scale = 1;
                var modelWidth = 0;
                var modelHeight = 0;
                nextModel = model;
                configureInteractiveLive2DModel(model);
                nextApp.stage.addChild(model);
                configurePixiCursorStyles(nextApp);
                modelWidth = model.width || 1;
                modelHeight = model.height || 1;
                scale = Math.min(self.canvasWidth / modelWidth, targetHeight / modelHeight);
                model.scale.set(scale);
                model.anchor.set(0.5, 1);
                model.x = self.canvasWidth * 0.5;
                model.y = self.canvasHeight;
                model.on("pointertap", function () {
                    if (Date.now() < live2dRuntimeState.dragTapSuppressUntil) {
                        return;
                    }
                    markAssistantInteraction();
                    showTipMessage(config, config && config.tips && config.tips.config ? config.tips.config.touch : [], 4000, 9);
                    self.playTapReaction();
                });
                if (typeof model.on === "function") {
                    model.on("hit", function (hitAreas) {
                        if (Array.isArray(hitAreas) && hitAreas.length) {
                            showTipMessage(config, config && config.tips && config.tips.config ? config.tips.config.touch : [], 4000, 8, false);
                        }
                    });
                }
                host.innerHTML = "";
                host.appendChild(canvas);
                destroyPixiAppInstance(previousApp);
                self.app = nextApp;
                self.model = nextModel;
                self.currentModelId = resolvedModelId;
                self.currentModelEntry = nextModelEntry;
                self.currentTextureVariantIndex = nextTextureVariantIndex;
                self.currentMotionGroupIndex = 0;
                self.currentExpressionIndex = -1;
                self.isMounted = true;
                persistRuntimeModelSelection(resolvedModelId, nextTextureVariantIndex);
                renderToolbar(config, self);
                self.playIdleMotion();
                return model;
            }).catch(function (error) {
                destroyPixiAppInstance(nextApp);
                self.app = previousApp;
                self.model = previousModel;
                self.currentModelId = previousModelId;
                self.currentModelEntry = previousModelEntry;
                self.currentTextureVariantIndex = previousTextureVariantIndex;
                renderToolbar(config, self);
                return Promise.reject(error);
            });
        },
        switchModel: function () {
            var self = this;
            var groups = getCubismGroupOrder(config);
            var currentGroupId = getCubismGroupId(self.currentModelEntry);
            var currentGroupIndex = groups.indexOf(currentGroupId);
            var nextGroupId = "";
            var nextEntry = null;
            if (!groups.length) {
                return Promise.resolve();
            }
            if (currentGroupIndex === -1) {
                currentGroupIndex = 0;
            }
            nextGroupId = groups[(currentGroupIndex + 1) % groups.length];
            nextEntry = getCubismModelEntries(config).find(function (item) {
                return getCubismGroupId(item) === nextGroupId;
            });
            return self.mount(nextEntry && nextEntry.id != null ? nextEntry.id : 0).then(function () {
                showTipMessage(config, [getLive2DMessage("modelSwitched", "Model switched.")], 4000, 10);
            }).catch(function (error) {
                showLive2DToast(getLive2DMessage("modelSwitchFailed", "Model switching failed. Your current environment may not support this renderer."), false);
            });
        },
        switchTexture: function () {
            var self = this;
            var variants = getCubismTextureVariants(config, self.currentModelEntry);
            var nextEntry = null;
            if (!variants.length) {
                showLive2DToast(getLive2DMessage("textureUnavailable", "The current model does not support switching appearance."), false);
                return Promise.resolve();
            }
            nextEntry = variants[(self.currentTextureVariantIndex + 1) % variants.length];
            if (!nextEntry || nextEntry.id == null) {
                showLive2DToast(getLive2DMessage("textureUnavailable", "The current model does not support switching appearance."), false);
                return Promise.resolve();
            }
            return self.mount(nextEntry.id).then(function () {
                showTipMessage(config, [getLive2DMessage("textureSwitched", "Appearance switched.")], 4000, 10);
            }).catch(function (error) {
                showLive2DToast(getLive2DMessage("textureSwitchFailed", "Appearance switching failed. Please try again later."), false);
            });
        },
        takePhoto: function () {
            var canvas = ensureCubismCanvas(shellState);
            var link = null;
            if (!canvas || typeof canvas.toDataURL !== "function") {
                showLive2DToast(getLive2DMessage("photoUnavailable", "Photo is not available right now."), false);
                return;
            }
            try {
                showTipMessage(config, [getLive2DMessage("photoSaved", "Photo saved.")], 4000, 9);
                link = document.createElement("a");
                link.href = canvas.toDataURL("image/png");
                link.download = "live2d-photo.png";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error(error);
                showLive2DToast(getLive2DMessage("photoUnavailable", "Photo is not available right now."), false);
            }
        },
    };
    return manager;
}

function initCubismBundle(config, entry) {
    var shellState = ensureAssistantShell();
    var manager = null;
    if (!shellState || !entry) {
        return Promise.resolve();
    }
    manager = createCubismManager(config, entry, shellState);
    live2dRuntimeState.cubismManager = manager;
    renderToolbar(config, manager);
    return loadClassicScript(entry.cubismCoreUrl)
        .then(function () {
            return loadClassicScript(entry.pixiUrl);
        })
        .then(function () {
            return loadClassicScript(entry.rendererUrl);
        })
        .then(function () {
            return resolveRuntimeModelId(config, entry);
        })
        .then(function (modelId) {
            return manager.mount(modelId);
        })
        .then(function () {
            bindTips(config);
            bindAssistantDrag();
            bindIdleActivityListeners();
            applyAssistantLayout();
            renderToolbar(config, manager);
        })
        .catch(function (error) {
            console.error(error);
            showLive2DToast(getLive2DMessage("live2dLoadFailed", "Live2D failed to load. Please try again later."), false);
        });
}

function createWidgetManager(config, entry, shellState) {
    var manager = {
        config: config,
        entry: entry,
        shellState: shellState,
        initialized: false,
        modelId: config && config.modelId != null ? config.modelId : 0,
        textureId: readStoredTextureId(),
        modelList: null,
        modelMessages: [],
        modelConfigCache: {},
        textureCacheMap: {},
        getWidgetRoot: function () {
            return shellState ? shellState.host.querySelector("#waifu") : null;
        },
        getCanvas: function () {
            return shellState ? shellState.host.querySelector("#live2d") : null;
        },
        getCurrentModelName: function () {
            var model = config && Array.isArray(config.availableModels) ? config.availableModels.find(function (item) { return item && item.id === manager.modelId; }) : null;
            return model && model.name ? model.name : ("Model #" + manager.modelId);
        },
        syncFromStorage: function () {
            var storedModelId = 0;
            var storedTextureId = 0;
            if (typeof window.localStorage === "undefined") {
                return;
            }
            storedModelId = parseInt(window.localStorage.getItem("modelId") || String(manager.modelId || 0), 10);
            storedTextureId = parseInt(window.localStorage.getItem("modelTexturesId") || String(manager.textureId || 0), 10);
            manager.modelId = isNaN(storedModelId) ? manager.modelId : storedModelId;
            manager.textureId = isNaN(storedTextureId) ? manager.textureId : storedTextureId;
        },
        triggerNativeTool: function (toolName) {
            var button = document.getElementById("waifu-tool-" + toolName);
            if (!button) {
                return false;
            }
            button.click();
            return true;
        },
        fetchJson: function (url) {
            if (!url || typeof window.fetch !== "function") {
                return Promise.resolve(null);
            }
            if (Object.prototype.hasOwnProperty.call(manager.modelConfigCache, url)) {
                return Promise.resolve(manager.modelConfigCache[url]);
            }
            return window.fetch(url, { credentials: "omit" })
                .then(function (response) {
                    if (!response || !response.ok) {
                        throw new Error("Failed to load JSON");
                    }
                    return response.json();
                })
                .then(function (payload) {
                    manager.modelConfigCache[url] = payload;
                    return payload;
                })
                .catch(function () {
                    manager.modelConfigCache[url] = null;
                    return null;
                });
        },
        getCurrentModelListEntry: function () {
            return manager.modelList && Array.isArray(manager.modelList.models) ? manager.modelList.models[manager.modelId] : null;
        },
        getTextureOptions: function () {
            var modelEntry = manager.getCurrentModelListEntry();
            var configUrl = "";
            var cacheUrl = "";
            if (!modelEntry) {
                return Promise.resolve([]);
            }
            if (Array.isArray(modelEntry)) {
                return Promise.resolve(modelEntry.slice());
            }
            cacheUrl = buildWidgetTextureCacheUrl(entry, modelEntry);
            if (Object.prototype.hasOwnProperty.call(manager.textureCacheMap, cacheUrl)) {
                return Promise.resolve(manager.textureCacheMap[cacheUrl]);
            }
            configUrl = buildWidgetModelConfigUrl(entry, modelEntry);
            return manager.fetchJson(configUrl).then(function (modelConfig) {
                var version = modelConfig && (modelConfig.Version === 3 || modelConfig.FileReferences) ? 3 : 2;
                if (version !== 2) {
                    manager.textureCacheMap[cacheUrl] = [];
                    return [];
                }
                return manager.fetchJson(cacheUrl).then(function (textureCache) {
                    var normalized = Array.isArray(textureCache) ? textureCache : [];
                    manager.textureCacheMap[cacheUrl] = normalized;
                    return normalized;
                });
            });
        },
        loadModelList: function () {
            var listUrl = buildModelListUrl(entry);
            if (!listUrl || typeof window.fetch !== "function") {
                return Promise.resolve([]);
            }
            return window.fetch(listUrl, { credentials: "omit" })
                .then(function (response) {
                    if (!response || !response.ok) {
                        throw new Error("Failed to load model list");
                    }
                    return response.json();
                })
                .then(function (payload) {
                    manager.modelList = payload;
                    manager.modelMessages = payload && Array.isArray(payload.messages) ? payload.messages : [];
                    return payload && Array.isArray(payload.models) ? payload.models : [];
                })
                .catch(function () {
                    manager.modelList = null;
                    manager.modelMessages = [];
                    return [];
                });
        },
        canSwitchTexture: function () {
            return true;
        },
        mount: function () {
            var widgetConfig = {
                waifuPath: entry.waifuPath,
                cdnPath: entry.assetsBase,
                cubism2Path: entry.cubism2Path,
                cubism5Path: entry.cubism5Path,
                drag: false,
                showToggleAfterQuit: false,
                tools: ["switch-model", "switch-texture", "photo", "info", "quit"],
            };
            if (manager.initialized) {
                return waitForWidgetRoot(shellState.host).then(function () {
                    manager.syncFromStorage();
                });
            }
            return Promise.resolve()
                .then(function () {
                    if (manager.modelId != null) {
                        widgetConfig.modelId = manager.modelId;
                    }
                    persistRuntimeModelSelection(manager.modelId, manager.textureId);
                    if (typeof window.initWidget !== "function") {
                        return null;
                    }
                    manager.initialized = true;
                    window.initWidget(widgetConfig);
                    return null;
                })
                .then(function () {
                    return waitForWidgetRoot(shellState.host);
                })
                .then(function (widgetRoot) {
                    if (!widgetRoot) {
                        return;
                    }
                    manager.syncFromStorage();
                });
        },
        switchModel: function () {
            if (!manager.triggerNativeTool("switch-model")) {
                return Promise.resolve();
            }
            return new Promise(function (resolve) {
                window.setTimeout(function () {
                    manager.syncFromStorage();
                    showTipMessage(config, [manager.modelMessages[manager.modelId] || getLive2DMessage("modelSwitched", "Model switched.")], 4000, 10);
                    renderToolbar(config, manager);
                    resolve();
                }, 150);
            }).then(function () {
                renderToolbar(config, manager);
            });
        },
        switchTexture: function () {
            return manager.getTextureOptions().then(function (options) {
                if (!options.length || options.length <= 1) {
                    showLive2DToast(getLive2DMessage("textureUnavailable", "The current model does not support switching appearance."), false);
                    return;
                }
                if (!manager.triggerNativeTool("switch-texture")) {
                    showLive2DToast(getLive2DMessage("textureSwitchFailed", "Appearance switching failed. Please try again later."), false);
                    return;
                }
                return new Promise(function (resolve) {
                    window.setTimeout(function () {
                        manager.syncFromStorage();
                        showTipMessage(config, [getLive2DMessage("textureSwitched", "Appearance switched.")], 4000, 10);
                        resolve();
                    }, 150);
                });
            });
        },
        takePhoto: function () {
            if (manager.triggerNativeTool("photo")) {
                return;
            }
            showLive2DToast(getLive2DMessage("photoUnavailable", "Photo is not available right now."), false);
        },
    };
    return manager;
}

function hideNativeWidgetUI() {
    var style = document.getElementById("live2d-widget-native-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "live2d-widget-native-style";
        style.textContent = "#waifu-toggle,#waifu-tips,#waifu-tool{display:none !important;}[data-live2d-stage-host] > #waifu{bottom:0 !important;left:0 !important;position:relative !important;transform:none !important;transition:none !important;background:none !important;box-shadow:none !important;pointer-events:none !important;}[data-live2d-stage-host] > #waifu #waifu-canvas{pointer-events:auto !important;}[data-live2d-stage-host] > #waifu #live2d{width:300px !important;height:300px !important;}";
        document.head.appendChild(style);
    }
}

function waitForWidgetRoot(host) {
    return new Promise(function (resolve) {
        var attempts = 0;
        function poll() {
            var waifu = document.getElementById("waifu");
            if (waifu) {
                host.innerHTML = "";
                host.appendChild(waifu);
                resolve(waifu);
                return;
            }
            attempts += 1;
            if (attempts > 50) {
                resolve(null);
                return;
            }
            window.setTimeout(poll, 100);
        }
        poll();
    });
}

function initWidgetBundle(config, entry) {
    var shellState = ensureAssistantShell();
    var manager = null;
    if (!shellState) {
        return Promise.resolve();
    }
    manager = createWidgetManager(config, entry, shellState);
    live2dRuntimeState.widgetManager = manager;
    renderToolbar(config, manager);
    hideNativeWidgetUI();
    return loadStylesheet(entry.styleUrl)
        .then(function () {
            return loadScript(entry.scriptUrl);
        })
        .then(function () {
            return manager.loadModelList();
        })
        .then(function () {
            return resolveRuntimeModelId(config, entry);
        })
        .then(function (resolvedModelId) {
            manager.modelId = resolvedModelId;
            manager.textureId = readStoredTextureId();
            return manager.mount();
        })
        .then(function () {
            bindTips(config);
            bindAssistantDrag();
            bindIdleActivityListeners();
            applyAssistantLayout();
            renderToolbar(config, manager);
        });
}

export function initLive2DWidget() {
    var config = getLive2DRuntimeConfig();
    var entry = config && config.entry ? config.entry : null;
    if (!config || !entry) {
        return;
    }
    live2dRuntimeState.config = config;
    ensureAssistantShell();
    bindResponsiveLayout();
    applyAssistantLayout();
    if (shouldSkipForViewport() || live2dInitStarted) {
        return;
    }
    live2dInitStarted = true;
    Promise.resolve()
        .then(function () {
            if (config.sourceType === "cubism_bundle") {
                return initCubismBundle(config, entry);
            }
            return initWidgetBundle(config, entry);
        })
        .catch(function (_error) {
            // Keep the page functional if the widget fails to load.
        });
}
