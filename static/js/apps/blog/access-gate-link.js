import { openModal, closeModal, showInlineFlash } from "../../core/app.js";
import { bindConditionTooltips } from "./shared.js";

var _gateInit = false;

function buildConditionRow(c) {
    var tr = document.createElement("tr");
    tr.className = "access-gate-row";
    tr.setAttribute("data-condition-type", c.type);
    tr.setAttribute("data-condition-status", c.status);

    var tdIcon = document.createElement("td");
    tdIcon.className = "access-gate-col-icon access-gate-icon-" + c.type;
    tdIcon.innerHTML = '<i class="fa-solid fa-' + c.icon + '"></i>';

    var tdType = document.createElement("td");
    tdType.innerHTML = "<strong>" + c.label + "</strong>";

    var tdReq = document.createElement("td");
    tdReq.className = "access-gate-col-requirement";
    tdReq.textContent = c.requirement;

    var tdAction = document.createElement("td");
    tdAction.className = "access-gate-col-action";

    if (c.status === "granted") {
        tdAction.innerHTML = '<span class="access-gate-status-granted"><i class="fa-solid fa-circle-check"></i></span>';
    } else if (c.action === "password") {
        tdAction.innerHTML = '<button type="button" class="app-modal-action-open access-gate-action-btn access-gate-verify-btn">Verify</button>';
    } else if (c.action === "purchase") {
        tdAction.innerHTML = '<button type="button" class="app-modal-action-open access-gate-action-btn access-gate-purchase-btn">Purchase</button>';
    } else {
        tdAction.innerHTML = '<span class="access-gate-status-denied"><i class="fa-solid fa-circle-xmark"></i></span>';
    }

    tr.appendChild(tdIcon);
    tr.appendChild(tdType);
    tr.appendChild(tdReq);
    tr.appendChild(tdAction);
    return tr;
}

function updateRow(row, c) {
    row.setAttribute("data-condition-status", c.status);
    var cell = row.querySelector(".access-gate-col-action");
    if (c.status === "granted") {
        cell.innerHTML = '<span class="access-gate-status-granted"><i class="fa-solid fa-circle-check"></i></span>';
    } else if (c.action === "password") {
        cell.innerHTML = '<button type="button" class="app-modal-action-open access-gate-action-btn access-gate-verify-btn">Verify</button>';
    } else if (c.action === "purchase") {
        cell.innerHTML = '<button type="button" class="app-modal-action-open access-gate-action-btn access-gate-purchase-btn">Purchase</button>';
    } else {
        cell.innerHTML = '<span class="access-gate-status-denied"><i class="fa-solid fa-circle-xmark"></i></span>';
    }
    cell.querySelector(".access-gate-verify-btn")?.addEventListener("click", onVerifyClick);
    cell.querySelector(".access-gate-purchase-btn")?.addEventListener("click", onPurchaseClick);
}

function isAllGranted(contentNode) {
    var all = true;
    contentNode.querySelectorAll(".access-gate-row").forEach(function (r) {
        if (r.getAttribute("data-condition-status") !== "granted") all = false;
    });
    return all;
}

function refreshEnter(contentNode) {
    var enter = document.querySelector("[data-inline-enter]");
    if (!enter) return;
    var allGranted = isAllGranted(contentNode);
    enter.hidden = !allGranted;
    if (allGranted) {
        enter.textContent = "Continue";
    }
}

function doPost(url, action, extraData, onSuccess, onError) {
    var formData = new FormData();
    formData.append("action", action);
    if (extraData) {
        Object.keys(extraData).forEach(function (k) { formData.append(k, extraData[k]); });
    }
    var csrfEl = document.querySelector("[name=csrfmiddlewaretoken]");
    var headers = { "X-Requested-With": "XMLHttpRequest" };
    if (csrfEl) headers["X-CSRFToken"] = csrfEl.value;

    fetch(url, { method: "POST", headers: headers, body: formData })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (result) {
            if (!result.ok) { onError(result.data.message || "Error"); return; }
            onSuccess(result.data.access_check);
        })
        .catch(function () { onError("Network error"); });
}

var _gateCtx = {};

function showNestedModal(opts) {
    var existing = document.querySelector(".access-gate-nested-overlay:not(.access-gate-table-overlay)");
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement("div");
    overlay.className = "access-gate-nested-overlay";

    var backdrop = document.createElement("div");
    backdrop.className = "access-gate-nested-backdrop";
    backdrop.addEventListener("click", function () {
        overlay.parentNode.removeChild(overlay);
        if (opts.onCancel) opts.onCancel();
    });

    var shell = document.createElement("div");
    shell.className = "access-gate-nested-shell";

    var dialog = document.createElement("div");
    dialog.className = "app-modal-dialog access-gate-nested-dialog";

    var header = document.createElement("div");
    header.className = "app-modal-header";
    if (opts.title) {
        var titleEl = document.createElement("h2");
        titleEl.className = "app-modal-title";
        titleEl.textContent = opts.title;
        header.appendChild(titleEl);
    }
    dialog.appendChild(header);

    var body = document.createElement("div");
    body.className = "app-modal-body";
    if (opts.message) {
        var msgEl = document.createElement("p");
        msgEl.className = "access-gate-nested-message";
        msgEl.textContent = opts.message;
        body.appendChild(msgEl);
    }
    if (opts.error !== undefined) {
        var errEl = document.createElement("p");
        errEl.className = "access-gate-inline-error";
        errEl.textContent = opts.error;
        errEl.setAttribute("data-nested-error", "");
        errEl.hidden = !opts.error;
        body.appendChild(errEl);
    }
    if (opts.contentNode) {
        body.appendChild(opts.contentNode);
    }
    dialog.appendChild(body);

    if (opts.confirmText || opts.cancelText) {
        var actions = document.createElement("div");
        actions.className = "app-modal-actions";

        var actionsLeft = document.createElement("div");
        actionsLeft.className = "app-modal-actions-left";
        var actionsRight = document.createElement("div");
        actionsRight.className = "app-modal-actions-right";

        if (opts.cancelText) {
            var cancelBtn = document.createElement("button");
            cancelBtn.type = "button";
            cancelBtn.className = "app-modal-secondary-button";
            cancelBtn.textContent = opts.cancelText;
            cancelBtn.addEventListener("click", function () {
                overlay.parentNode.removeChild(overlay);
                if (opts.onCancel) opts.onCancel();
            });
            actionsLeft.appendChild(cancelBtn);
        }
        if (opts.confirmText) {
            var confirmBtn = document.createElement("button");
            confirmBtn.type = "button";
            confirmBtn.className = "primary-button";
            confirmBtn.textContent = opts.confirmText;
            confirmBtn.addEventListener("click", function () {
                if (opts.onConfirm) opts.onConfirm(overlay);
            });
            actionsRight.appendChild(confirmBtn);
        }
        actions.appendChild(actionsLeft);
        actions.appendChild(actionsRight);
        dialog.appendChild(actions);
    }

    shell.appendChild(dialog);
    overlay.appendChild(backdrop);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);

    overlay.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            overlay.parentNode.removeChild(overlay);
            if (opts.onCancel) opts.onCancel();
        }
    });
}

function showPasswordNested(row) {
    var form = document.createElement("div");
    var input = document.createElement("input");
    input.type = "password";
    input.className = "input-control";
    input.placeholder = "Password";
    input.autocomplete = "current-password";
    form.appendChild(input);

    showNestedModal({
        title: "Enter password",
        error: "",
        contentNode: form,
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: function (overlay) {
            var pw = input.value.trim();
            if (!pw) {
                var err = overlay.querySelector("[data-nested-error]");
                if (err) { err.textContent = "Password is required"; err.hidden = false; }
                showInlineFlash("Password is required", false);
                return;
            }
            row.classList.add("access-gate-row-updating");
            doPost(_gateCtx.checkUrl, "password", { password: pw }, function (updated) {
                row.classList.remove("access-gate-row-updating");
                overlay.parentNode.removeChild(overlay);
                if (updated?.conditions) {
                    var content = _gateCtx.contentNode;
                    updated.conditions.forEach(function (c) {
                        var r = content.querySelector('.access-gate-row[data-condition-type="' + c.type + '"]');
                        if (r) updateRow(r, c);
                    });
                }
                refreshEnter(_gateCtx.contentNode);
            }, function (msg) {
                row.classList.remove("access-gate-row-updating");
                var err = overlay.querySelector("[data-nested-error]");
                if (err) { err.textContent = msg; err.hidden = false; }
                showInlineFlash(msg, false);
            });
        },
        onCancel: function () {}
    });

    setTimeout(function () { input.focus(); }, 100);
}

function showPurchaseNested(row) {
    var cost = row.querySelector(".access-gate-col-requirement").textContent.trim();

    showNestedModal({
        title: "Confirm purchase",
        error: "",
        message: "Cost: " + cost + " coins",
        confirmText: "Confirm",
        cancelText: "Cancel",
        onConfirm: function (overlay) {
            row.classList.add("access-gate-row-updating");
            doPost(_gateCtx.checkUrl, "purchase", null, function (updated) {
                row.classList.remove("access-gate-row-updating");
                overlay.parentNode.removeChild(overlay);
                if (updated?.conditions) {
                    var content = _gateCtx.contentNode;
                    updated.conditions.forEach(function (c) {
                        var r = content.querySelector('.access-gate-row[data-condition-type="' + c.type + '"]');
                        if (r) updateRow(r, c);
                    });
                }
                refreshEnter(_gateCtx.contentNode);
            }, function (msg) {
                row.classList.remove("access-gate-row-updating");
                var err = overlay.querySelector("[data-nested-error]");
                if (err) { err.textContent = msg; err.hidden = false; }
                showInlineFlash(msg, false);
            });
        },
        onCancel: function () {}
    });
}

function onVerifyClick(e) {
    showPasswordNested(e.target.closest(".access-gate-row"));
}

function onPurchaseClick(e) {
    showPurchaseNested(e.target.closest(".access-gate-row"));
}

function buildContentNode(checkData) {
    var root = document.createElement("div");

    var table = document.createElement("table");
    table.className = "access-gate-table";
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    ["", "Type", "Requirement", "Authorization"].forEach(function (h) {
        var th = document.createElement("th");
        if (!h) th.className = "access-gate-col-icon";
        if (h === "Authorization") th.className = "access-gate-col-action";
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    checkData.conditions.forEach(function (c) { tbody.appendChild(buildConditionRow(c)); });
    table.appendChild(tbody);
    root.appendChild(table);

    root.querySelectorAll(".access-gate-verify-btn").forEach(function (b) { b.addEventListener("click", onVerifyClick); });
    root.querySelectorAll(".access-gate-purchase-btn").forEach(function (b) { b.addEventListener("click", onPurchaseClick); });

    return root;
}

function injectEnterButton(allGranted) {
    var slot = document.querySelector("[data-app-modal-confirm-slot]");
    if (!slot) return;
    slot.innerHTML = "";
    var enterBtn = document.createElement("button");
    enterBtn.type = "button";
    enterBtn.className = "primary-button";
    enterBtn.textContent = "Continue";
    enterBtn.setAttribute("data-inline-enter", "");
    enterBtn.hidden = !allGranted;
    enterBtn.addEventListener("click", function () {
        if (!isAllGranted(_gateCtx.contentNode)) return;
        closeModal();
        var src = _gateCtx.sourceLink;
        if (src) {
            src.classList.remove("js-access-gate-link");
            var importForm = src.closest(".import-post-form");
            if (importForm) {
                importForm.requestSubmit();
            } else {
                src.click();
            }
        } else {
            window.location.href = _gateCtx.targetUrl;
        }
    });
    slot.appendChild(enterBtn);
}

function showGateAsNestedOverlay(checkData, targetUrl, checkUrl, isGate, sourceLink, content) {
    var existing = document.querySelector(".access-gate-table-overlay");
    if (existing) existing.parentNode.removeChild(existing);

    var overlay = document.createElement("div");
    overlay.className = "access-gate-nested-overlay access-gate-table-overlay";

    var backdrop = document.createElement("div");
    backdrop.className = "access-gate-nested-backdrop";
    backdrop.addEventListener("click", function () {
        overlay.parentNode.removeChild(overlay);
    });

    var shell = document.createElement("div");
    shell.className = "access-gate-nested-shell";

    var dialog = document.createElement("div");
    dialog.className = "app-modal-dialog access-gate-nested-dialog is-table-dialog";

    var header = document.createElement("div");
    header.className = "app-modal-header";
    var titleEl = document.createElement("h2");
    titleEl.className = "app-modal-title";
    titleEl.textContent = checkData.object_name || "";
    if (checkData.is_vip) {
        var vipSpan = document.createElement("span");
        vipSpan.className = "vip-access-badge";
        vipSpan.setAttribute("data-condition-tooltip-trigger", "");
        vipSpan.setAttribute("tabindex", "0");
        vipSpan.setAttribute("aria-label", "VIP access permission");
        vipSpan.style.marginLeft = "0.5rem";
        var vipInner = document.createElement("span");
        vipInner.className = "vip-badge-icon";
        vipInner.textContent = "VIP";
        vipSpan.appendChild(vipInner);
        titleEl.appendChild(document.createTextNode(" "));
        titleEl.appendChild(vipSpan);
        var vipTooltipContent = "";
        if (checkData.conditions && checkData.conditions.length) {
            vipTooltipContent = '<span class="condition-badge-group condition-badge-group-inline">' + checkData.conditions.map(function (c) {
                var icon = c.icon || "circle-question";
                var label = c.label || "";
                var type = c.type || "conditional";
                return '<span class="condition-badge access-tone-' + type + ' condition-badge-' + type + '">' +
                    '<i class="fa-solid fa-' + icon + '" aria-hidden="true"></i>' +
                    '<span>' + label + '</span>' +
                    '</span>';
            }).join("") + '</span>';
        }
        if (vipTooltipContent) {
            var vipTooltipTemplate = document.createElement("span");
            vipTooltipTemplate.hidden = true;
            vipTooltipTemplate.setAttribute("data-condition-tooltip-template", "");
            vipTooltipTemplate.innerHTML = vipTooltipContent;
            titleEl.appendChild(vipTooltipTemplate);
        }
    }
    header.appendChild(titleEl);
    dialog.appendChild(header);

    var body = document.createElement("div");
    body.className = "app-modal-body";
    body.appendChild(content);
    dialog.appendChild(body);

    var actions = document.createElement("div");
    actions.className = "app-modal-actions";

    var actionsLeft = document.createElement("div");
    actionsLeft.className = "app-modal-actions-left";
    var actionsRight = document.createElement("div");
    actionsRight.className = "app-modal-actions-right";

    if (!isGate) {
        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "app-modal-secondary-button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", function () {
            overlay.parentNode.removeChild(overlay);
        });
        actionsLeft.appendChild(cancelBtn);
    }

    var enterBtn = document.createElement("button");
    enterBtn.type = "button";
    enterBtn.className = "primary-button";
    enterBtn.setAttribute("data-inline-enter", "");
    enterBtn.textContent = "Continue";
    enterBtn.hidden = !checkData.all_granted;
    enterBtn.addEventListener("click", function () {
        if (!isAllGranted(content)) return;
        overlay.parentNode.removeChild(overlay);
        var src = sourceLink;
        if (src) {
            src.classList.remove("js-access-gate-link");
            var importForm = src.closest(".import-post-form");
            if (importForm) {
                importForm.requestSubmit();
            } else {
                src.click();
            }
        } else {
            window.location.href = targetUrl;
        }
    });
    actionsRight.appendChild(enterBtn);

    actions.appendChild(actionsLeft);
    actions.appendChild(actionsRight);
    dialog.appendChild(actions);

    shell.appendChild(dialog);
    overlay.appendChild(backdrop);
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    bindConditionTooltips(titleEl);

    _gateCtx = {
        contentNode: content,
        targetUrl: targetUrl,
        checkUrl: checkUrl,
        sourceLink: sourceLink || null,
    };

    overlay.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            e.stopPropagation();
            overlay.parentNode.removeChild(overlay);
        }
    });

    window.requestAnimationFrame(function () {
        var firstButton = overlay.querySelector("button:not([hidden]):not([disabled])");
        if (firstButton) firstButton.focus();
        else dialog.focus();
    });
}

function showTableDialog(checkData, targetUrl, checkUrl, isGate, sourceLink) {
    var content = buildContentNode(checkData);
    var appModal = document.querySelector("[data-app-modal]");
    var isMainModalOpen = appModal && !appModal.hidden;

    if (isMainModalOpen) {
        showGateAsNestedOverlay(checkData, targetUrl, checkUrl, isGate, sourceLink, content);
        return;
    }

    openModal({
        dialogClass: "is-table-dialog",
        kicker: "Access verification",
        title: "",
        contentNode: content,
        confirmText: "",
        cancelText: isGate ? "" : "Cancel",
        onCancel: function () { closeModal(); }
    });

    var titleEl = document.querySelector("[data-app-modal-title]");
    if (titleEl) {
        titleEl.textContent = checkData.object_name || "";
        if (checkData.is_vip) {
            var vipSpan = document.createElement("span");
            vipSpan.className = "vip-access-badge";
            vipSpan.setAttribute("data-condition-tooltip-trigger", "");
            vipSpan.setAttribute("tabindex", "0");
            vipSpan.setAttribute("aria-label", "VIP access permission");
            vipSpan.style.marginLeft = "0.5rem";
            var vipInner = document.createElement("span");
            vipInner.className = "vip-badge-icon";
            vipInner.textContent = "VIP";
            vipSpan.appendChild(vipInner);
            titleEl.appendChild(document.createTextNode(" "));
            titleEl.appendChild(vipSpan);
            var vipTooltipContent = "";
            if (checkData.conditions && checkData.conditions.length) {
                vipTooltipContent = '<span class="condition-badge-group condition-badge-group-inline">' + checkData.conditions.map(function (c) {
                    var icon = c.icon || "circle-question";
                    var label = c.label || "";
                    var type = c.type || "conditional";
                    return '<span class="condition-badge access-tone-' + type + ' condition-badge-' + type + '">' +
                        '<i class="fa-solid fa-' + icon + '" aria-hidden="true"></i>' +
                        '<span>' + label + '</span>' +
                        '</span>';
                }).join("") + '</span>';
            }
            if (vipTooltipContent) {
                var vipTooltipTemplate = document.createElement("span");
                vipTooltipTemplate.hidden = true;
                vipTooltipTemplate.setAttribute("data-condition-tooltip-template", "");
                vipTooltipTemplate.innerHTML = vipTooltipContent;
                titleEl.appendChild(vipTooltipTemplate);
            }
        }
        bindConditionTooltips(titleEl);
    }

    _gateCtx = {
        contentNode: content,
        targetUrl: targetUrl,
        checkUrl: checkUrl,
        sourceLink: sourceLink || null,
    };

    injectEnterButton(checkData.all_granted);
}

function autoOpenEmbeddedGate() {
    var dataEl = document.getElementById("post-access-check-data");
    var configEl = document.getElementById("post-gate-config");
    if (!dataEl || !configEl) return;
    var checkData = JSON.parse(dataEl.textContent);
    if (checkData.all_granted) return;
    var cfg = JSON.parse(configEl.textContent);
    showTableDialog(checkData, window.location.href, cfg.checkUrl, true, null);
}

export function initAccessGateLinks() {
    if (_gateInit) return;
    _gateInit = true;

    document.body.addEventListener("click", function (e) {
        var link = e.target.closest(".js-access-gate-link");
        if (!link) return;

        var type = link.getAttribute("data-object-type");
        var id = link.getAttribute("data-object-id");
        var targetUrl = link.getAttribute("data-gate-url") || link.getAttribute("href");
        if (!type || !id || !targetUrl) return;

        e.stopPropagation();
        e.preventDefault();
        var inBook = !!(document.querySelector("[data-book-outline-scope]")
            || document.querySelector("[data-book-editor-form]"));
        var checkUrl = "/api/access-check/" + type + "/" + id + "/"
            + (inBook ? "?in_book_context=1" : "");
        fetch(checkUrl, { headers: { "X-Requested-With": "XMLHttpRequest" } })
            .then(function (r) {
                if (!r.ok) { window.location.href = targetUrl; return null; }
                return r.json();
            })
            .then(function (data) {
                if (!data) return;
                if (data.all_granted) {
                    if (link.tagName === "BUTTON") {
                        link.classList.remove("js-access-gate-link");
                        var importForm = link.closest(".import-post-form");
                        if (importForm) {
                            importForm.requestSubmit();
                        } else {
                            link.click();
                        }
                    } else {
                        window.location.href = targetUrl;
                    }
                } else {
                    showTableDialog(data, targetUrl, checkUrl, false, link);
                }
            })
            .catch(function () { window.location.href = targetUrl; });
    }, true);

    autoOpenEmbeddedGate();
}
