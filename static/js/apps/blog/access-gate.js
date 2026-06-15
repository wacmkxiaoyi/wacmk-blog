(function () {
    "use strict";

    var configEl = document.getElementById("access-gate-config");
    var dataEl = document.getElementById("access-check-data");
    if (!configEl || !dataEl) return;

    var config = JSON.parse(configEl.textContent);
    var accessData = JSON.parse(dataEl.textContent);
    var checkUrl = config.checkUrl;
    var isAccessGate = config.isAccessGate;

    var card = document.querySelector(".access-gate-card");
    if (!card) return;

    var tableWrapper = card.querySelector("[data-gate-table-wrapper]");
    var passwordForm = card.querySelector("[data-gate-password-form]");
    var passwordInput = card.querySelector("[data-gate-password-input]");
    var passwordError = card.querySelector("[data-gate-password-error]");
    var passwordConfirm = card.querySelector("[data-gate-password-confirm]");
    var passwordCancel = card.querySelector("[data-gate-password-cancel]");
    var purchaseForm = card.querySelector("[data-gate-purchase-form]");
    var purchaseInfo = card.querySelector("[data-gate-purchase-info]");
    var purchaseError = card.querySelector("[data-gate-purchase-error]");
    var purchaseConfirm = card.querySelector("[data-gate-purchase-confirm]");
    var purchaseCancel = card.querySelector("[data-gate-purchase-cancel]");
    var enterBtn = card.querySelector("[data-gate-enter]");
    var titleEl = card.querySelector("[data-gate-title]");

    var activeRow = null;

    function updateAllGranted() {
        var allGreen = true;
        card.querySelectorAll(".access-gate-row").forEach(function (row) {
            if (row.getAttribute("data-condition-status") !== "granted") {
                allGreen = false;
            }
        });
        enterBtn.disabled = !allGreen;
    }

    function showInlineForm(row, form) {
        activeRow = row;
        tableWrapper.hidden = true;
        form.hidden = false;
    }

    function hideInlineForm() {
        tableWrapper.hidden = false;
        passwordForm.hidden = true;
        purchaseForm.hidden = true;
        activeRow = null;
    }

    function setRowUpdating(row) {
        row.classList.add("access-gate-row-updating");
    }

    function clearRowUpdating(row) {
        row.classList.remove("access-gate-row-updating");
    }

    function updateRow(row, condition) {
        row.setAttribute("data-condition-status", condition.status);
        var actionCell = row.querySelector(".access-gate-col-action");
        var requirementCell = row.querySelector(".access-gate-col-requirement");
        if (requirementCell) {
            requirementCell.innerHTML = buildRequirementHtml(condition);
        }
        if (condition.status === "granted") {
            actionCell.innerHTML =
                '<span class="access-gate-status-granted" title="Granted">' +
                '<i class="fa-solid fa-circle-check"></i></span>';
        } else if (condition.action === "password") {
            actionCell.innerHTML =
                '<button type="button" class="btn btn-sm btn-outline access-gate-verify-btn" data-action="password">Verify</button>';
            bindVerifyBtn(actionCell.querySelector("button"));
        } else if (condition.action === "purchase") {
            actionCell.innerHTML =
                '<button type="button" class="btn btn-sm btn-primary access-gate-purchase-btn" data-action="purchase">Purchase</button>';
            bindPurchaseBtn(actionCell.querySelector("button"));
        } else {
            actionCell.innerHTML =
                '<span class="access-gate-status-denied" title="Cannot satisfy">' +
                '<i class="fa-solid fa-circle-xmark"></i></span>';
        }
    }

    function submitAction(action, extraData) {
        if (!activeRow) return;
        setRowUpdating(activeRow);

        var formData = new FormData();
        formData.append("action", action);
        if (extraData) {
            Object.keys(extraData).forEach(function (k) {
                formData.append(k, extraData[k]);
            });
        }

        var csrfEl = document.querySelector("[name=csrfmiddlewaretoken]");
        var headers = { "X-Requested-With": "XMLHttpRequest" };
        if (csrfEl) {
            headers["X-CSRFToken"] = csrfEl.value;
        }

        fetch(checkUrl, {
            method: "POST",
            headers: headers,
            body: formData,
        })
            .then(function (resp) {
                return resp.json().then(function (d) {
                    return { ok: resp.ok, data: d };
                });
            })
            .then(function (result) {
                clearRowUpdating(activeRow);
                if (!result.ok) {
                    if (action === "password") {
                        passwordError.textContent = result.data.message || "Error";
                        passwordError.hidden = false;
                    } else {
                        purchaseError.textContent = result.data.message || "Error";
                        purchaseError.hidden = false;
                    }
                    return;
                }

                hideInlineForm();

                var updated = result.data.access_check;
                if (updated && updated.conditions) {
                    card.querySelectorAll(".access-gate-row").forEach(function (row) {
                        var type = row.getAttribute("data-condition-type");
                        var cond = null;
                        for (var i = 0; i < updated.conditions.length; i++) {
                            if (updated.conditions[i].type === type) {
                                cond = updated.conditions[i];
                                break;
                            }
                        }
                        if (cond) {
                            updateRow(row, cond);
                        }
                    });
                }
                updateAllGranted();
            })
            .catch(function () {
                clearRowUpdating(activeRow);
                if (action === "password") {
                    passwordError.textContent = "Network error";
                    passwordError.hidden = false;
                } else {
                    purchaseError.textContent = "Network error";
                    purchaseError.hidden = false;
                }
            });
    }

    function bindVerifyBtn(btn) {
        btn.addEventListener("click", function () {
            var row = btn.closest(".access-gate-row");
            passwordInput.value = "";
            passwordError.hidden = true;
            showInlineForm(row, passwordForm);
            passwordInput.focus();
        });
    }

    function bindPurchaseBtn(btn) {
        btn.addEventListener("click", function () {
            var row = btn.closest(".access-gate-row");
            var requirementCell = row.querySelector(".access-gate-col-requirement");
            var cost = requirementCell ? requirementCell.childNodes[0].textContent.trim() : "";
            purchaseInfo.textContent = "Cost: " + cost + " coins";
            purchaseError.hidden = true;
            showInlineForm(row, purchaseForm);
        });
    }

    passwordConfirm.addEventListener("click", function () {
        var pw = passwordInput.value.trim();
        if (!pw) {
            passwordError.textContent = "Password is required";
            passwordError.hidden = false;
            return;
        }
        submitAction("password", { password: pw });
    });

    passwordCancel.addEventListener("click", hideInlineForm);

    purchaseConfirm.addEventListener("click", function () {
        submitAction("purchase");
    });

    purchaseCancel.addEventListener("click", hideInlineForm);

    passwordInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") passwordConfirm.click();
    });

    enterBtn.addEventListener("click", function () {
        if (enterBtn.disabled) return;
        window.location.reload();
    });

    card.querySelectorAll(".access-gate-verify-btn").forEach(bindVerifyBtn);
    card.querySelectorAll(".access-gate-purchase-btn").forEach(bindPurchaseBtn);

    updateAllGranted();
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
})();
