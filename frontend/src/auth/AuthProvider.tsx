import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  type AuthSessionResponse,
  type MeResponse,
} from "../api";
import {
  clearStoredAuth,
  isExpired,
  readStoredAuth,
  writeStoredAuth,
  type StoredAuth,
} from "./storage";

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: StoredAuth["user"] | null;
  profile: MeResponse["profile"] | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<StoredAuth["user"] | null>(null);
  const [profile, setProfile] = useState<MeResponse["profile"] | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  // 优化：包裹在 useCallback 中以保持引用稳定
  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current != null) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  // 优化：包裹在 useCallback 中，依赖稳定的 clearLogoutTimer
  const scheduleAutoLogout = useCallback(
    (expiresAt: string) => {
      clearLogoutTimer();
      const ms = Date.parse(expiresAt) - Date.now();
      if (!Number.isFinite(ms) || ms <= 0) return;
      logoutTimerRef.current = window.setTimeout(() => {
        clearStoredAuth();
        setUser(null);
        setProfile(null);
      }, ms);
    },
    [clearLogoutTimer],
  );

  // 优化：包裹在 useCallback 中，依赖稳定的 scheduleAutoLogout 和 setUser
  const applySession = useCallback(
    (session: AuthSessionResponse) => {
      const expiresAtIso = new Date(
        session.expires_at.replace(" ", "T") + "Z",
      ).toISOString();
      const stored: StoredAuth = {
        token: session.token,
        expiresAt: expiresAtIso,
        user: session.user,
      };
      writeStoredAuth(stored);
      setUser(session.user);
      scheduleAutoLogout(expiresAtIso);
    },
    [scheduleAutoLogout],
  );

  const refreshMe = useCallback(async () => {
    const stored = readStoredAuth();
    if (!stored || isExpired(stored.expiresAt)) {
      clearStoredAuth();
      setUser(null);
      setProfile(null);
      return;
    }
    try {
      const me = await authMe();
      setUser(me.user);
      setProfile(me.profile);
      scheduleAutoLogout(stored.expiresAt);
    } catch {
      clearStoredAuth();
      setUser(null);
      setProfile(null);
    }
  }, [scheduleAutoLogout]);

  useEffect(() => {
    // 修复：移除同步 setState，依赖初始状态 true
    refreshMe().finally(() => setIsLoading(false));
    return () => clearLogoutTimer();
  }, [refreshMe, clearLogoutTimer]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await authLogin({ username, password });
      applySession(session);
      await refreshMe();
    },
    [applySession, refreshMe],
  );

  const register = useCallback(async (username: string, password: string) => {
    await authRegister({ username, password });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authLogout();
    } catch {
      // ignore
    }
    clearStoredAuth();
    setUser(null);
    setProfile(null);
    clearLogoutTimer();
  }, [clearLogoutTimer]);

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      user,
      profile,
      login,
      register,
      logout,
      refreshMe,
    }),
    [isLoading, user, profile, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
