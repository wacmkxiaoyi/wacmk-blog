import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../../components/layout/AuthLayout";
import Input from "../../../components/ui/Input";
import PasswordInput from "../../../components/ui/PasswordInput";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import api, { setTokens } from "../../../api";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import { getPostAuthRedirectPath } from "../../../utils/authRedirect";
import "./ForgotPasswordPage.css";

export default function ForgotPasswordPage() {
  const { fetchUser } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error",
  });
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = setTimeout(() => setCodeCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [codeCooldown]);

  async function handleSendCode() {
    if (!username.trim()) {
      setToast({
        visible: true,
        message: t("error.usernameRequired"),
        type: "error",
      });
      return;
    }

    setSendingCode(true);
    try {
      const data = await api.auth.sendPasswordResetCode(username.trim());
      setCodeCooldown(data.resend_in || 60);
      setToast({ visible: true, message: data.detail, type: "success" });
    } catch (err) {
      const msg =
        err.response?.data?.username?.[0] ||
        err.response?.data?.detail ||
        t("error.sendCodeFailed");
      setToast({ visible: true, message: msg, type: "error" });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();

    if (!code.trim() || !newPassword) {
      setToast({
        visible: true,
        message: t("error.requiredFields"),
        type: "error",
      });
      return;
    }

    if (newPassword.length < 8) {
      setToast({
        visible: true,
        message: t("error.passwordMinLength"),
        type: "error",
      });
      return;
    }

    setResetting(true);
    try {
      const data = await api.auth.resetPassword(
        username.trim(),
        code.trim(),
        newPassword,
      );

      if (data.tokens) {
        setTokens(data.tokens.access, data.tokens.refresh);
        await fetchUser();
      }

      setDone(true);
    } catch (err) {
      const msg = err.response?.data?.detail || t("error.resetFailed");
      setToast({ visible: true, message: msg, type: "error" });
    } finally {
      setResetting(false);
    }
  }

  function goToHome() {
    navigate(getPostAuthRedirectPath(location.search), { replace: true });
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="auth-panel-header">
          <div className="auth-title-wrap">
            <div className="auth-title-decor">
              <span className="decor-dot decor-dot--pink" />
              <span className="decor-star" />
              <span className="decor-dot decor-dot--blue" />
            </div>
            <h1
              className="auth-title"
              style={{ fontSize: "clamp(1.8rem, 4vw, 2.2rem)" }}
            >
              {t("auth.allSet")}
            </h1>
          </div>
        </div>

        <Toast
          type="success"
          message={t("auth.passwordResetSuccess")}
          visible
        />

        <div className="auth-actions" style={{ marginTop: 24 }}>
          <Button type="button" fullWidth onClick={goToHome}>
            {t("auth.goHome")}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-panel-header">
        <div className="auth-title-wrap">
          <h1
            className="auth-title"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)" }}
          >
            {t("auth.forgotPassword").replace("?", "")}
          </h1>
        </div>
        <p className="auth-side-link">
          {t("auth.remembered")} <Link to="/">{t("auth.signIn")}</Link>
        </p>
      </div>

      <div className="auth-messages">
        <Toast
          type={toast.type}
          message={toast.message}
          visible={toast.visible}
          onClose={() =>
            setToast({ visible: false, message: "", type: "error" })
          }
        />
      </div>

      <form className="auth-form" onSubmit={handleReset} noValidate>
        <div className="field-group">
          <label className="field-label">{t("field.usernameOrEmail")}</label>
          <div className="email-row">
            <input
              className="input-control email-row__input"
              placeholder={t("field.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <button
              type="button"
              className="btn btn--secondary email-row__btn"
              onClick={handleSendCode}
              disabled={sendingCode || codeCooldown > 0}
            >
              {codeCooldown > 0
                ? `${codeCooldown}s`
                : sendingCode
                  ? "..."
                  : t("auth.sendCode")}
            </button>
          </div>
        </div>

        <Input
          label={t("auth.verificationCode")}
          placeholder={t("auth.codePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          autoComplete="one-time-code"
        />

        <PasswordInput
          label={t("auth.newPassword")}
          placeholder={t("field.newPasswordPlaceholder")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />

        <div className="auth-actions">
          <Button type="submit" fullWidth loading={resetting}>
            {t("auth.resetPassword")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
