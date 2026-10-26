import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api";

const CACHE_KEY = "wacmk_site_runtime";
const CACHE_TTL = 5 * 60 * 1000;

export const SiteRuntimeContext = createContext(null);

function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (
      !cached?.config ||
      !cached.version ||
      !Number.isFinite(cached.expiresAt)
    )
      return null;
    return cached;
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache({ config, version, expiresAt }) {
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ config, version, expiresAt }),
  );
}

export default function SiteRuntimeProvider({ children }) {
  const location = useLocation();
  const cached = useRef(readCache()).current;
  const [config, setConfig] = useState(cached?.config || null);
  const [version, setVersion] = useState(cached?.version || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const requestRef = useRef(null);
  const channelRef = useRef(null);
  const configRef = useRef(cached?.config || null);
  const versionRef = useRef(cached?.version || null);
  const expiresAtRef = useRef(cached?.expiresAt || 0);

  const invalidate = useCallback(() => {
    expiresAtRef.current = 0;
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  const refresh = useCallback(
    async ({ force = false, broadcast = false } = {}) => {
      if (
        !force &&
        !broadcast &&
        configRef.current &&
        Date.now() < expiresAtRef.current
      )
        return;
      if (requestRef.current) return requestRef.current;

      setLoading(true);
      const request = api.runtime
        .getConfig(versionRef.current)
        .then(({ status, data }) => {
          const expiresAt = Date.now() + CACHE_TTL;
          if (status === 204) {
            expiresAtRef.current = expiresAt;
            writeCache({
              config: configRef.current,
              version: versionRef.current,
              expiresAt,
            });
            return;
          }
          configRef.current = data.values;
          versionRef.current = data.version;
          expiresAtRef.current = expiresAt;
          setConfig(data.values);
          setVersion(data.version);
          writeCache({ config: data.values, version: data.version, expiresAt });
          setError(null);
          if (broadcast)
            channelRef.current?.postMessage({ type: "runtime-config-updated" });
        })
        .catch((nextError) => setError(nextError))
        .finally(() => {
          requestRef.current = null;
          setLoading(false);
        });

      requestRef.current = request;
      return request;
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [location.pathname, location.search, refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel("wacmk-site-runtime");
    channelRef.current = channel;
    channel.onmessage = (event) => {
      if (event.data?.type === "runtime-config-updated") {
        invalidate();
        void refresh({ force: true });
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [invalidate, refresh]);

  useEffect(() => {
    const site = config?.["basic.site"];
    const assets = config?.["basic.assets"];
    if (site?.title) document.title = site.title;
    let icon = document.querySelector("link[rel='icon']");
    if (!assets?.site_icon) {
      icon?.remove();
      return undefined;
    }
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = `${assets.site_icon}${assets.site_icon.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "")}`;
    return undefined;
  }, [config, version]);

  return (
    <SiteRuntimeContext.Provider
      value={{ config, version, loading, error, refresh }}
    >
      {children}
    </SiteRuntimeContext.Provider>
  );
}
