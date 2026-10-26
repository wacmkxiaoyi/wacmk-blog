import { useContext } from "react";
import LanguageSwitcher from "../ui/LanguageSwitcher";
import { SiteRuntimeContext } from "../../contexts/SiteRuntimeContext";
import "../../styles/auth.css";

export default function AuthLayoutWide({ children }) {
  const { config } = useContext(SiteRuntimeContext);
  const background = config?.["basic.assets"]?.auth_background;
  return (
    <main
      className="auth-layout"
      style={
        background
          ? {
              backgroundImage: `linear-gradient(rgba(255, 240, 250, .42), rgba(230, 245, 255, .50)), url(${background})`,
            }
          : undefined
      }
    >
      <section className="auth-card auth-card--wide">
        <LanguageSwitcher />
        <span className="card-spark" />
        <span className="card-heart" />
        <div className="auth-panel">{children}</div>
      </section>
    </main>
  );
}
