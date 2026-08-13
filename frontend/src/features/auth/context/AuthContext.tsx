import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_SESSION_EXPIRED_EVENT,
  apiClient,
  clearStoredAuth,
  getStoredAccessToken,
  getStoredRefreshToken,
  saveStoredAuthTokens,
  type AuthTokens,
} from "../../../lib/api-client";
import {
  hasUserPermission,
  type Role,
} from "../lib/permissions";

export type User = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: Role[];
};

type AuthResponse = {
  tokens: AuthTokens;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined,
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function handleExpiredSession() {
      clearStoredAuth();
      setUser(null);
      setIsLoading(false);
    }

    window.addEventListener(
      AUTH_SESSION_EXPIRED_EVENT,
      handleExpiredSession,
    );

    return () => {
      window.removeEventListener(
        AUTH_SESSION_EXPIRED_EVENT,
        handleExpiredSession,
      );
    };
  }, []);

  useEffect(() => {
    async function loadCurrentUser() {
      const accessToken = getStoredAccessToken();
      const refreshToken = getStoredRefreshToken();

      if (!accessToken && !refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response =
          await apiClient.get<User>("/auth/me");

        setUser(response.data);
      } catch {
        clearStoredAuth();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadCurrentUser();
  }, []);

  async function login(
    email: string,
    password: string,
  ) {
    clearStoredAuth();
    setUser(null);

    try {
      const response =
        await apiClient.post<AuthResponse>(
          "/auth/login",
          {
            email,
            password,
          },
        );

      saveStoredAuthTokens(response.data.tokens);
      setUser(response.data.user);
    } catch (error) {
      clearStoredAuth();
      setUser(null);
      throw error;
    }
  }

  async function register(
    email: string,
    password: string,
    fullName?: string,
  ) {
    clearStoredAuth();
    setUser(null);

    try {
      const response =
        await apiClient.post<AuthResponse>(
          "/auth/register",
          {
            email,
            password,
            full_name: fullName,
          },
        );

      saveStoredAuthTokens(response.data.tokens);
      setUser(response.data.user);
    } catch (error) {
      clearStoredAuth();
      setUser(null);
      throw error;
    }
  }

  async function logout() {
    const refreshToken = getStoredRefreshToken();

    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", {
          refresh_token: refreshToken,
        });
      } catch {
        // Local authentication is cleared either way.
      }
    }

    clearStoredAuth();
    setUser(null);
  }

  function hasPermission(permission: string) {
    return hasUserPermission(user, permission);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
      hasPermission,
    }),
    [user, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}
