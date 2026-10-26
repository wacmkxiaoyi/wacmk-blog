import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AppHeader from "./AppHeader";
import Toast from "../ui/Toast";
import useI18n from "../../hooks/useI18n";
import useSiteRuntime from "../../hooks/useSiteRuntime";
import "./AppLayout.css";

export default function AppLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { config } = useSiteRuntime();
  const [notice, setNotice] = useState(null);
  const background = config?.["basic.assets"]?.app_background;

  useEffect(() => {
    const reward = location.state?.loginReward;
    if (!reward?.awarded) return;
    const rewards = [];
    const bonuses = [];
    if (reward.base_money > 0)
      rewards.push(t("auth.loginReward.money", { amount: reward.base_money }));
    if (reward.base_points > 0)
      rewards.push(
        t("auth.loginReward.points", { amount: reward.base_points }),
      );
    if (reward.vip_money > 0)
      bonuses.push(t("auth.loginReward.money", { amount: reward.vip_money }));
    if (reward.vip_points > 0)
      bonuses.push(t("auth.loginReward.points", { amount: reward.vip_points }));
    const message = [
      rewards.length &&
        t("auth.loginReward.base", {
          rewards: rewards.join(t("auth.loginReward.separator")),
        }),
      bonuses.length &&
        t("auth.loginReward.vip", {
          level: reward.vip_level,
          rewards: bonuses.join(t("auth.loginReward.separator")),
        }),
    ]
      .filter(Boolean)
      .join(" ");
    if (message) setNotice(message);
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    });
  }, [location, navigate, t]);

  return (
    <div
      className="app-layout"
      style={
        background
          ? {
              backgroundImage: `linear-gradient(rgba(255, 255, 255, .70), rgba(255, 255, 255, .70)), url(${background})`,
            }
          : undefined
      }
    >
      <AppHeader />
      <Outlet />
      <Toast
        visible={Boolean(notice)}
        type="success"
        message={notice}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}
