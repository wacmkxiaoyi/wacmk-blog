import { getCsrfToken, openModal } from "../../core/app.js";

export function initPasswordToggles(rootNode) {
    Array.prototype.forEach.call((rootNode || document).querySelectorAll("[data-password-toggle]"), function (toggleButton) {
        var targetSelector = toggleButton.getAttribute("data-target");
        var passwordInput = targetSelector ? document.querySelector(targetSelector) : null;
        var showLabel = "";
        var hideLabel = "";
        var srOnlyLabel = null;

        if (!passwordInput || toggleButton.getAttribute("data-password-toggle-bound") === "true") {
            return;
        }

        toggleButton.setAttribute("data-password-toggle-bound", "true");
        showLabel = toggleButton.getAttribute("data-show-label") || "";
        hideLabel = toggleButton.getAttribute("data-hide-label") || "";
        srOnlyLabel = toggleButton.querySelector(".sr-only");

        toggleButton.addEventListener("click", function () {
            var isPassword = passwordInput.getAttribute("type") === "password";
            var nextLabel = isPassword ? hideLabel : showLabel;

            passwordInput.setAttribute("type", isPassword ? "text" : "password");
            toggleButton.classList.toggle("is-visible", isPassword);
            toggleButton.setAttribute("aria-label", nextLabel);
            toggleButton.setAttribute("aria-pressed", isPassword ? "true" : "false");
            if (srOnlyLabel) {
                srOnlyLabel.textContent = nextLabel;
            }
        });
    });
}

export function initSendCodeButtons(rootNode) {
    Array.prototype.forEach.call((rootNode || document).querySelectorAll("[data-send-code]"), function (sendCodeButton) {
        var emailInput = document.querySelector(sendCodeButton.getAttribute("data-email-input") || "");
        var messageNode = sendCodeButton.closest(".field-group, .user-manage-field, .profile-email-code-field")
            ? sendCodeButton.closest(".field-group, .user-manage-field, .profile-email-code-field").querySelector("[data-send-code-message]")
            : document.querySelector("[data-send-code-message]");
        var sendCodeUrl = sendCodeButton.getAttribute("data-url");
        var defaultLabel = sendCodeButton.getAttribute("data-default-label") || "";
        var waitLabel = sendCodeButton.getAttribute("data-wait-label") || "Resend in %(seconds)s s";
        var fallbackError = sendCodeButton.getAttribute("data-fallback-error") || "";
        var waitSeconds = Number(sendCodeButton.getAttribute("data-wait-seconds") || "60");
        var csrfToken = getCsrfToken();
        var countdownTimer = null;

        function setMessage(text, isError) {
            if (!messageNode) {
                return;
            }
            messageNode.textContent = text || "";
            messageNode.classList.toggle("is-error", Boolean(isError));
        }

        function startCountdown(secondsLeft) {
            var remaining = secondsLeft;
            sendCodeButton.disabled = true;
            sendCodeButton.textContent = waitLabel.replace("%(seconds)s", remaining);

            countdownTimer = window.setInterval(function () {
                remaining -= 1;
                if (remaining <= 0) {
                    window.clearInterval(countdownTimer);
                    countdownTimer = null;
                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                    return;
                }
                sendCodeButton.textContent = waitLabel.replace("%(seconds)s", remaining);
            }, 1000);
        }

        if (sendCodeButton.getAttribute("data-send-code-bound") === "true") {
            return;
        }
        sendCodeButton.setAttribute("data-send-code-bound", "true");

        sendCodeButton.addEventListener("click", function () {
            var body = null;

            if (!emailInput || !sendCodeUrl || !csrfToken || countdownTimer) {
                return;
            }

            sendCodeButton.disabled = true;
            setMessage("");
            body = new URLSearchParams();
            body.append("email", emailInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(sendCodeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString(),
                credentials: "same-origin"
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: defaultLabel };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.ok,
                            message: data.message || ""
                        };
                    });
                })
                .then(function (result) {
                    setMessage(result.message, !result.ok);
                    if (result.ok) {
                        startCountdown(waitSeconds);
                        return;
                    }
                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                })
                .catch(function () {
                    setMessage(fallbackError, true);
                    sendCodeButton.disabled = false;
                    sendCodeButton.textContent = defaultLabel;
                });
        });
    });
}

export function initForgotPassword(rootNode) {
    Array.prototype.forEach.call((rootNode || document).querySelectorAll("[data-forgot-password]"), function (forgotPasswordButton) {
        var usernameInput = document.querySelector(forgotPasswordButton.getAttribute("data-username-input") || "");
        var forgotPasswordUrl = forgotPasswordButton.getAttribute("data-url");
        var forgotPasswordSuccessTitle = forgotPasswordButton.getAttribute("data-success-title") || "";
        var forgotPasswordSuccess = forgotPasswordButton.getAttribute("data-success-message") || "";
        var forgotPasswordErrorTitle = forgotPasswordButton.getAttribute("data-error-title") || "";
        var forgotPasswordFallback = forgotPasswordButton.getAttribute("data-fallback-error") || "";
        var forgotPasswordConfirmText = forgotPasswordButton.getAttribute("data-confirm-text") || "";
        var passwordInput = document.querySelector("#id_password");
        var csrfToken = getCsrfToken();

        if (forgotPasswordButton.getAttribute("data-forgot-password-bound") === "true") {
            return;
        }
        forgotPasswordButton.setAttribute("data-forgot-password-bound", "true");

        forgotPasswordButton.addEventListener("click", function () {
            var body = null;

            if (!usernameInput || !forgotPasswordUrl || !csrfToken || !usernameInput.value.trim()) {
                return;
            }

            forgotPasswordButton.disabled = true;
            body = new URLSearchParams();
            body.append("username", usernameInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(forgotPasswordUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString(),
                credentials: "same-origin"
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: forgotPasswordFallback };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.ok,
                            message: data.message || ""
                        };
                    });
                })
                .then(function (result) {
                    if (result.ok) {
                        if (passwordInput) {
                            passwordInput.value = "";
                        }
                        openModal({
                            tone: "notice",
                            kicker: forgotPasswordSuccessTitle,
                            title: forgotPasswordSuccessTitle,
                            message: result.message || forgotPasswordSuccess,
                            confirmText: forgotPasswordConfirmText
                        });
                    } else if (result.message) {
                        openModal({
                            tone: "error",
                            kicker: forgotPasswordErrorTitle,
                            title: forgotPasswordErrorTitle,
                            message: result.message,
                            confirmText: forgotPasswordConfirmText
                        });
                    }
                    forgotPasswordButton.disabled = false;
                })
                .catch(function () {
                    openModal({
                        tone: "error",
                        kicker: forgotPasswordErrorTitle,
                        title: forgotPasswordErrorTitle,
                        message: forgotPasswordFallback,
                        confirmText: forgotPasswordConfirmText
                    });
                    forgotPasswordButton.disabled = false;
                });
        });
    });
}

export function initUsersAuth(rootNode) {
    initPasswordToggles(rootNode);
    initSendCodeButtons(rootNode);
    initForgotPassword(rootNode);
}
