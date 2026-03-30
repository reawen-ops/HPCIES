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

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current != null) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

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

  const fetchUserData = useCallback(async (): Promise<{
    user: StoredAuth["user"] | null;
    profile: MeResponse["profile"] | null;
  }> => {
    const stored = readStoredAuth();
    if (!stored || isExpired(stored.expiresAt)) {
      clearStoredAuth();
      return { user: null, profile: null };
    }
    try {
      const me = await authMe();
      scheduleAutoLogout(stored.expiresAt);
      return { user: me.user, profile: me.profile };
    } catch {
      clearStoredAuth();
      return { user: null, profile: null };
    }
  }, [scheduleAutoLogout]);

  // 保留 refreshMe 作为公开方法，但内部使用 fetchUserData
  const refreshMe = useCallback(async () => {
    const { user: newUser, profile: newProfile } = await fetchUserData();
    setUser(newUser);
    setProfile(newProfile);
  }, [fetchUserData]);

  // Effect 中只做初始化，不直接触发状态更新链
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const { user: newUser, profile: newProfile } = await fetchUserData();
      if (isMounted) {
        setUser(newUser);
        setProfile(newProfile);
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      clearLogoutTimer();
    };
  }, [fetchUserData, clearLogoutTimer]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await authLogin({ username, password });
      applySession(session);
      const { user: newUser, profile: newProfile } = await fetchUserData();
      setUser(newUser);
      setProfile(newProfile);
    },
    [applySession, fetchUserData],
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
