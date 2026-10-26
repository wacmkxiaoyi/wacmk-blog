import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../../components/layout/AuthLayout";
import Input from "../../../components/ui/Input";
import PasswordInput from "../../../components/ui/PasswordInput";
import Checkbox from "../../../components/ui/Checkbox";
import Button from "../../../components/ui/Button";
import Toast from "../../../components/ui/Toast";
import useAuth from "../../../hooks/useAuth";
import useI18n from "../../../hooks/useI18n";
import useSiteRuntime from "../../../hooks/useSiteRuntime";
import { getPostAuthRedirectPath } from "../../../utils/authRedirect";
import "./LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useSiteRuntime();

  const [form, setForm] = useState({
    username: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [loading, setLoading] = useState(false);
  const registerAvailable = config?.registration?.enable_register === true;

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const fieldErrors = {};
    if (!form.username.trim())
      fieldErrors.username = t("error.usernameRequired");
    if (!form.password) fieldErrors.password = t("error.passwordRequired");

    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const result = await login(
        form.username.trim(),
        form.password,
        form.remember,
      );
      navigate(getPostAuthRedirectPath(location.search), {
        replace: true,
        state: result.login_reward?.awarded
          ? { loginReward: result.login_reward }
          : null,
      });
    } catch (err) {
      const msg = err.response?.data?.detail || t("error.loginFailed");
      setToast({ visible: true, message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-panel-header">
        <div className="auth-title-wrap">
          <div className="auth-title-decor">
            <span className="decor-dot decor-dot--pink" />
            <span className="decor-star" />
            <span className="decor-dot decor-dot--blue" />
          </div>
          <h1 className="auth-title">{t("auth.welcomeBack")}</h1>
        </div>
        {registerAvailable && (
          <p className="auth-side-link">
            {t("auth.noAccount")} <Link to="/register">{t("auth.signUp")}</Link>
          </p>
        )}
      </div>

      <div className="auth-messages">
        <Toast
          type="error"
          message={toast.message}
          visible={toast.visible}
          onClose={() => setToast({ visible: false, message: "" })}
        />
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input
          label={t("field.usernameOrEmail")}
          name="username"
          placeholder={t("field.usernamePlaceholder")}
          value={form.username}
          onChange={handleChange}
          error={errors.username}
          autoComplete="username"
        />

        <PasswordInput
          label={t("field.password")}
          name="password"
          placeholder={t("field.passwordPlaceholder")}
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="auth-field-row">
          <Checkbox
            label={t("field.rememberMe")}
            name="remember"
            checked={form.remember}
            onChange={handleChange}
          />
          <Link to="/forgot-password">{t("auth.forgotPassword")}</Link>
        </div>

        <div className="auth-actions">
          <Button type="submit" fullWidth loading={loading}>
            {t("auth.signIn")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
