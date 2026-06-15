import { openModal, showInlineFlash } from "../../core/app.js";
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
    tdReq.innerHTML = buildRequirementHtml(c);

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
    var requirementCell = row.querySelector(".access-gate-col-requirement");
    if (requirementCell) {
        requirementCell.innerHTML = buildRequirementHtml(c);
    }
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
    var modalRoot = contentNode ? contentNode.closest(".app-modal") : null;
    var enter = modalRoot ? modalRoot.querySelector("[data-inline-enter]") : null;
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

function openGateNestedModal(opts) {
    var body = document.createElement("div");
    var message = null;
    var error = null;
    var modal = null;
    body.className = "editor-modal-form";
    if (opts.message) {
        message = document.createElement("p");
        message.className = "access-gate-nested-message";
        message.textContent = opts.message;
        body.appendChild(message);
    }
    if (opts.error !== undefined) {
        error = document.createElement("p");
        error.className = "access-gate-inline-error";
        error.setAttribute("data-nested-error", "");
        error.textContent = opts.error;
        error.hidden = !opts.error;
        body.appendChild(error);
    }
    if (opts.contentNode) {
        body.appendChild(opts.contentNode);
    }
    modal = openModal({
        title: opts.title || "",
        contentNode: body,
        cancelText: opts.cancelText || "",
        confirmText: opts.confirmText || "",
        keepOpenOnConfirm: opts.keepOpenOnConfirm === true,
        onConfirm: function (api) {
            if (opts.onConfirm) {
                return opts.onConfirm(api, body);
            }
        },
        onCancel: function (api, reason) {
            if (opts.onCancel) {
                opts.onCancel(api, reason, body);
            }
        }
    });
    return { modal: modal, body: body };
}

function updateGateConditions(updated) {
    if (!(updated && updated.conditions && _gateCtx.contentNode)) {
        return;
    }
    updated.conditions.forEach(function (condition) {
        var row = _gateCtx.contentNode.querySelector('.access-gate-row[data-condition-type="' + condition.type + '"]');
        if (row) {
            updateRow(row, condition);
        }
    });
    refreshEnter(_gateCtx.contentNode);
}

function showPasswordNested(row) {
    var form = document.createElement("div");
    var input = document.createElement("input");
    input.type = "password";
    input.className = "input-control";
    input.placeholder = "Password";
    input.autocomplete = "current-password";
    form.appendChild(input);

    openGateNestedModal({
        title: "Enter password",
        error: "",
        contentNode: form,
        confirmText: "Confirm",
        cancelText: "Cancel",
        keepOpenOnConfirm: true,
        onConfirm: function (api, modalBody) {
            var pw = input.value.trim();
            var err = modalBody ? modalBody.querySelector("[data-nested-error]") : null;
            if (!pw) {
                if (err) { err.textContent = "Password is required"; err.hidden = false; }
                showInlineFlash("Password is required", false);
                return;
            }
            row.classList.add("access-gate-row-updating");
            doPost(_gateCtx.checkUrl, "password", { password: pw }, function (updated) {
                row.classList.remove("access-gate-row-updating");
                api.close();
                updateGateConditions(updated);
            }, function (msg) {
                row.classList.remove("access-gate-row-updating");
                if (err) { err.textContent = msg; err.hidden = false; }
                showInlineFlash(msg, false);
            });
        },
        onCancel: function () {}
    });

    setTimeout(function () { input.focus(); }, 100);
}

function showPurchaseNested(row) {
    var requirementCell = row.querySelector(".access-gate-col-requirement");
    var cost = requirementCell ? requirementCell.childNodes[0].textContent.trim() : "";

    openGateNestedModal({
        title: "Confirm purchase",
        error: "",
        message: "Cost: " + cost + " coins",
        confirmText: "Confirm",
        cancelText: "Cancel",
        keepOpenOnConfirm: true,
        onConfirm: function (api, modalBody) {
            var err = modalBody ? modalBody.querySelector("[data-nested-error]") : null;
            row.classList.add("access-gate-row-updating");
            doPost(_gateCtx.checkUrl, "purchase", null, function (updated) {
                row.classList.remove("access-gate-row-updating");
                api.close();
                updateGateConditions(updated);
            }, function (msg) {
                row.classList.remove("access-gate-row-updating");
                if (err) { err.textContent = msg; err.hidden = false; }
                showInlineFlash(msg, false);
            });
        },
        onCancel: function () {}
    });
}

function buildRequirementHtml(condition) {
    var requirement = condition && condition.requirement ? condition.requirement : "";
    if (!(condition && condition.discount_applied)) {
        return requirement;
    }
    return '<span class="access-gate-price-stack">'
        + '<span class="access-gate-price-original">' + condition.original_requirement + '</span>'
        + '<span class="access-gate-price-discounted">' + requirement + '</span>'
        + '<span class="access-gate-price-note">(<span class="is-vip">' + (condition.vip_label || "") + '</span> -' + condition.discount_percent + '%)</span>'
        + '</span>';
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

function injectEnterButton(allGranted, modalApi) {
    var slot = modalApi && modalApi.getElements ? modalApi.getElements().confirmSlot : null;
    if (!slot) return;
    modalApi.setActions(function () {
        return {
            cancelText: _gateCtx.sourceLink ? "Cancel" : "",
            confirmText: "",
            extraActions: [
                {
                    label: "Continue",
                    className: "primary-button",
                    keepOpen: true,
                    onClick: function () {
                        var src = null;
                        if (!isAllGranted(_gateCtx.contentNode)) {
                            return;
                        }
                        modalApi.close();
                        src = _gateCtx.sourceLink;
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
                    }
                }
            ]
        };
    });
    var enterBtn = slot.querySelector("button.primary-button");
    if (enterBtn) {
        enterBtn.setAttribute("data-inline-enter", "");
        enterBtn.hidden = !allGranted;
    }
}

function showTableDialog(checkData, targetUrl, checkUrl, isGate, sourceLink) {
    var content = buildContentNode(checkData);
    var modal = openModal({
        dialogClass: "is-table-dialog",
        kicker: "Access verification",
        title: "",
        contentNode: content,
        confirmText: "",
        cancelText: isGate ? "" : "Cancel",
        mode: "push"
    });

    var titleEl = modal && modal.getElements ? modal.getElements().title : null;
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
        modalApi: modal || null
    };

    injectEnterButton(checkData.all_granted, modal);
    if (modal && isGate) {
        modal.setActions(function () {
            return {
                cancelText: "",
                confirmText: "",
                extraActions: [
                    {
                        label: "Continue",
                        className: "primary-button",
                        keepOpen: true,
                        onClick: function () {
                            if (!isAllGranted(_gateCtx.contentNode)) {
                                return;
                            }
                            modal.close();
                            window.location.href = _gateCtx.targetUrl;
                        }
                    }
                ]
            };
        });
        var gateButton = modal.getElements().confirmSlot.querySelector("button.primary-button");
        if (gateButton) {
            gateButton.setAttribute("data-inline-enter", "");
            gateButton.hidden = !checkData.all_granted;
        }
    }
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
