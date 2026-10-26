import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { setTokens, clearTokens } from "../api";

export const AuthContext = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("access_token")),
  );

  const login = useCallback(async (username, password, rememberMe) => {
    const data = await api.auth.login(username, password, rememberMe);
    setTokens(data.tokens.access, data.tokens.refresh);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (credentials) => {
    const data = await api.auth.register(credentials);
    setTokens(data.tokens.access, data.tokens.refresh);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await api.auth.getMe());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((current) => (current ? { ...current, ...updates } : current));
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      return;
    }

    fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      fetchUser,
      updateUser,
      isAuthenticated: !!user,
    }),
    [user, loading, login, register, logout, fetchUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
