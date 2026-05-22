document.addEventListener("DOMContentLoaded", function () {
    var toggleButtons = document.querySelectorAll("[data-password-toggle]");
    var sendCodeButton = document.querySelector("[data-send-code]");
    var forgotPasswordButton = document.querySelector("[data-forgot-password]");
    var csrfInput = document.querySelector("input[name='csrfmiddlewaretoken']");
    var appModal = document.querySelector("[data-app-modal]");
    var appModalDialog = document.querySelector("[data-app-modal-dialog]");
    var appModalKicker = document.querySelector("[data-app-modal-kicker]");
    var appModalTitle = document.querySelector("[data-app-modal-title]");
    var appModalMessage = document.querySelector("[data-app-modal-message]");
    var appModalCancelSlot = document.querySelector("[data-app-modal-cancel-slot]");
    var appModalConfirmSlot = document.querySelector("[data-app-modal-confirm-slot]");
    var appModalCloseButtons = document.querySelectorAll("[data-app-modal-close]");
    var modalState = {
        restoreFocus: null,
        onConfirm: null,
        onCancel: null,
    };
    var modalToneClasses = ["is-attention", "is-warning", "is-error"];

    function closeModal() {
        if (!appModal) {
            return;
        }

        appModal.hidden = true;
        appModal.classList.remove("is-attention", "is-warning", "is-error");
        document.body.classList.remove("modal-open");
        appModalKicker.textContent = "";
        appModalTitle.textContent = "";
        appModalMessage.textContent = "";
        appModalCancelSlot.innerHTML = "";
        appModalConfirmSlot.innerHTML = "";

        if (modalState.restoreFocus) {
            modalState.restoreFocus.focus();
        }

        modalState.restoreFocus = null;
        modalState.onConfirm = null;
        modalState.onCancel = null;
    }

    function createModalButton(className, label, onClick) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = label;
        button.addEventListener("click", onClick);
        return button;
    }

    function openModal(options) {
        if (!appModal || !appModalDialog) {
            return;
        }

        closeModal();

        var tone = options.tone || "notice";
        modalState.restoreFocus = document.activeElement;
        modalState.onConfirm = options.onConfirm || null;
        modalState.onCancel = options.onCancel || null;

        appModal.hidden = false;
        document.body.classList.add("modal-open");
        modalToneClasses.forEach(function (className) {
            appModal.classList.remove(className);
        });
        if (tone === "attention") {
            appModal.classList.add("is-attention");
        } else if (tone === "warning") {
            appModal.classList.add("is-warning");
        } else if (tone === "error") {
            appModal.classList.add("is-error");
        }

        appModalKicker.textContent = options.kicker || "";
        appModalTitle.textContent = options.title || "";
        appModalMessage.textContent = options.message || "";

        if (options.cancelText) {
            appModalCancelSlot.appendChild(
                createModalButton("app-modal-secondary-button", options.cancelText, function () {
                    if (modalState.onCancel) {
                        modalState.onCancel();
                    }
                    closeModal();
                })
            );
        }

        if (options.confirmText) {
            appModalConfirmSlot.appendChild(
                createModalButton("primary-button", options.confirmText, function () {
                    if (modalState.onConfirm) {
                        modalState.onConfirm();
                    }
                    closeModal();
                })
            );
        }

        window.requestAnimationFrame(function () {
            var confirmButton = appModalConfirmSlot.querySelector("button");
            var cancelButton = appModalCancelSlot.querySelector("button");
            (confirmButton || cancelButton || appModalDialog).focus();
        });
    }

    appModalCloseButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            if (modalState.onCancel) {
                modalState.onCancel();
            }
            closeModal();
        });
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && appModal && !appModal.hidden) {
            if (modalState.onCancel) {
                modalState.onCancel();
            }
            closeModal();
        }
    });

    toggleButtons.forEach(function (toggleButton) {
        var targetSelector = toggleButton.getAttribute("data-target");
        var passwordInput = targetSelector ? document.querySelector(targetSelector) : null;

        if (!passwordInput) {
            return;
        }

        var showLabel = toggleButton.getAttribute("data-show-label") || "Show password";
        var hideLabel = toggleButton.getAttribute("data-hide-label") || "Hide password";
        var srOnlyLabel = toggleButton.querySelector(".sr-only");

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

    if (sendCodeButton) {
        var emailInput = document.querySelector(sendCodeButton.getAttribute("data-email-input") || "");
        var messageNode = document.querySelector("[data-send-code-message]");
        var sendCodeUrl = sendCodeButton.getAttribute("data-url");
        var defaultLabel = sendCodeButton.getAttribute("data-default-label") || "Send code";
        var waitLabel = sendCodeButton.getAttribute("data-wait-label") || "Resend in %(seconds)s s";
        var fallbackError = sendCodeButton.getAttribute("data-fallback-error") || "Request failed.";
        var waitSeconds = Number(sendCodeButton.getAttribute("data-wait-seconds") || "60");
        var csrfToken = csrfInput ? csrfInput.value : "";
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

        sendCodeButton.addEventListener("click", function () {
            if (!emailInput || !sendCodeUrl || !csrfToken) {
                return;
            }

            if (countdownTimer) {
                return;
            }

            sendCodeButton.disabled = true;
            setMessage("");

            var body = new URLSearchParams();
            body.append("email", emailInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(sendCodeUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString()
            })
                .then(function (response) {
                    return response.json().catch(function () {
                        return { ok: false, message: defaultLabel };
                    }).then(function (data) {
                        return {
                            ok: response.ok && data.ok,
                            status: response.status,
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
    }

    if (forgotPasswordButton) {
        var usernameInput = document.querySelector(forgotPasswordButton.getAttribute("data-username-input") || "");
        var forgotPasswordUrl = forgotPasswordButton.getAttribute("data-url");
        var forgotPasswordSuccessTitle = forgotPasswordButton.getAttribute("data-success-title") || "";
        var forgotPasswordSuccess = forgotPasswordButton.getAttribute("data-success-message") || "";
        var forgotPasswordErrorTitle = forgotPasswordButton.getAttribute("data-error-title") || "";
        var forgotPasswordFallback = forgotPasswordButton.getAttribute("data-fallback-error") || "Request failed.";
        var forgotPasswordConfirmText = forgotPasswordButton.getAttribute("data-confirm-text") || "OK";
        var csrfToken = csrfInput ? csrfInput.value : "";
        var passwordInput = document.querySelector("#id_password");

        forgotPasswordButton.addEventListener("click", function () {
            if (!usernameInput || !forgotPasswordUrl || !csrfToken) {
                return;
            }

            if (!usernameInput.value.trim()) {
                return;
            }

            forgotPasswordButton.disabled = true;

            var body = new URLSearchParams();
            body.append("username", usernameInput.value || "");
            body.append("csrfmiddlewaretoken", csrfToken);

            fetch(forgotPasswordUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: body.toString()
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
                            confirmText: forgotPasswordConfirmText,
                        });
                    } else if (result.message) {
                        openModal({
                            tone: "error",
                            kicker: forgotPasswordErrorTitle,
                            title: forgotPasswordErrorTitle,
                            message: result.message,
                            confirmText: forgotPasswordConfirmText,
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
                        confirmText: forgotPasswordConfirmText,
                    });
                    forgotPasswordButton.disabled = false;
                });
        });
    }
});
