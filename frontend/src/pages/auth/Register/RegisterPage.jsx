import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayoutWide from "../../../components/layout/AuthLayoutWide";
import Input from "../../../components/ui/Input";
import PasswordInput from "../../../components/ui/PasswordInput";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import api from "../../../api";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import { getPostAuthRedirectPath } from "../../../utils/authRedirect";
import "./RegisterPage.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useSiteRuntime();
  const registrationAvailable = config?.registration?.enable_register === true;

  const [form, setForm] = useState({
    username: "",
    email: "",
    verificationCode: "",
    password: "",
    password2: "",
  });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "error",
  });
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeCooldown, setCodeCooldown] = useState(0);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = setTimeout(() => setCodeCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [codeCooldown]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  async function handleSendCode() {
    const email = form.email.trim();
    if (!email) {
      setErrors((prev) => ({ ...prev, email: t("error.emailRequired") }));
      return;
    }

    setSendingCode(true);
    try {
      const data = await api.auth.sendRegistrationCode(email);
      setCodeCooldown(data.resend_in || 60);
      setToast({
        visible: true,
        message: data.detail || "Code sent.",
        type: "success",
      });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        t("error.sendCodeFailed");
      setToast({ visible: true, message: msg, type: "error" });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const fieldErrors = {};
    if (!form.username.trim())
      fieldErrors.username = t("error.usernameRequiredShort");
    if (!form.email.trim()) fieldErrors.email = t("error.emailRequired");
    if (!form.verificationCode.trim())
      fieldErrors.verificationCode = t("error.codeRequired");
    if (!form.password) fieldErrors.password = t("error.passwordRequired");
    else if (form.password.length < 8)
      fieldErrors.password = t("error.passwordMinLength");
    if (form.password !== form.password2)
      fieldErrors.password2 = t("error.passwordsMismatch");

    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        verification_code: form.verificationCode.trim(),
        password: form.password,
        password2: form.password2,
      });
      navigate(getPostAuthRedirectPath(location.search), { replace: true });
    } catch (err) {
      const data = err.response?.data;
      let msg = t("error.registerFailed");

      if (data) {
        if (typeof data === "string") {
          msg = data;
        } else {
          const serverErrors = {};
          for (const [key, val] of Object.entries(data)) {
            const fieldKey =
              key === "verification_code" ? "verificationCode" : key;
            serverErrors[fieldKey] = Array.isArray(val) ? val[0] : val;
          }
          setErrors((prev) => ({ ...prev, ...serverErrors }));
          msg = Object.values(serverErrors)[0] || msg;
        }
      }

      setToast({ visible: true, message: msg, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayoutWide>
      <div className="auth-panel-header">
        <div className="auth-title-wrap">
          <div className="auth-title-decor">
            <span className="decor-dot decor-dot--pink" />
            <span className="decor-star" />
            <span className="decor-dot decor-dot--blue" />
          </div>
          <h1 className="auth-title">{t("auth.joinUs")}</h1>
        </div>
        <p className="auth-side-link">
          {t("auth.hasAccount")} <Link to="/">{t("auth.signIn")}</Link>
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

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label={t("field.username")}
          name="username"
          placeholder={t("field.usernameChoosePlaceholder")}
          value={form.username}
          onChange={handleChange}
          error={errors.username}
          autoComplete="username"
        />

        <div className="field-group">
          <label className="field-label">{t("field.email")}</label>
          <div className="email-row">
            <input
              className={`input-control email-row__input${errors.email ? " input-control--error" : ""}`}
              name="email"
              type="email"
              placeholder={t("field.emailPlaceholder")}
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            <button
              type="button"
              className="btn btn--secondary email-row__btn"
              onClick={handleSendCode}
              disabled={
                !registrationAvailable || sendingCode || codeCooldown > 0
              }
            >
              {codeCooldown > 0
                ? `${codeCooldown}s`
                : sendingCode
                  ? "..."
                  : t("auth.sendCode")}
            </button>
          </div>
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <Input
          label={t("auth.verificationCode")}
          name="verificationCode"
          placeholder={t("auth.codePlaceholder")}
          value={form.verificationCode}
          onChange={handleChange}
          error={errors.verificationCode}
          maxLength={6}
          autoComplete="one-time-code"
        />

        <PasswordInput
          label={t("field.password")}
          name="password"
          placeholder={t("field.passwordCreatePlaceholder")}
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="new-password"
        />

        <PasswordInput
          label={t("field.confirmPassword")}
          name="password2"
          placeholder={t("field.passwordConfirmPlaceholder")}
          value={form.password2}
          onChange={handleChange}
          error={errors.password2}
          autoComplete="new-password"
        />

        <div className="auth-actions">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={!registrationAvailable}
          >
            {t("auth.createAccount")}
          </Button>
        </div>
      </form>
    </AuthLayoutWide>
  );
}
