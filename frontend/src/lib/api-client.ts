import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type RawAxiosHeaders,
} from "axios";

const ACCESS_TOKEN_KEY = "the_introspective_psychologist_production_proof_access_token";
const REFRESH_TOKEN_KEY = "the_introspective_psychologist_production_proof_refresh_token";
const AUTH_NOTICE_KEY = "launchkit_auth_notice";

export const AUTH_SESSION_EXPIRED_EVENT =
  "launchkit:auth-session-expired";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

type RefreshResponse = {
  tokens: AuthTokens;
};

type RetriableRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

export const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ??
    "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

export function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function saveStoredAuthTokens(tokens: AuthTokens) {
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    tokens.access_token,
  );
  localStorage.setItem(
    REFRESH_TOKEN_KEY,
    tokens.refresh_token,
  );
}

export function clearStoredAuth() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function recordSessionExpiry() {
  clearStoredAuth();

  try {
    sessionStorage.setItem(
      AUTH_NOTICE_KEY,
      "session-expired",
    );
  } catch {
    // The redirect still works when session storage is unavailable.
  }

  window.dispatchEvent(
    new Event(AUTH_SESSION_EXPIRED_EVENT),
  );
}

function normalizeRequestPath(url?: string) {
  const withoutQuery = (url ?? "").split("?")[0];

  if (!withoutQuery.startsWith("http")) {
    return withoutQuery;
  }

  try {
    return new URL(withoutQuery).pathname;
  } catch {
    return withoutQuery;
  }
}

function requestCanUseRefresh(url?: string) {
  const path = normalizeRequestPath(url);

  if (!path.startsWith("/auth/")) {
    return true;
  }

  return path === "/auth/me";
}

let refreshPromise: Promise<string> | null = null;

async function refreshStoredSession() {
  const refreshToken = getStoredRefreshToken();

  if (!refreshToken) {
    throw new Error("No refresh token is available.");
  }

  const baseUrl = String(
    apiClient.defaults.baseURL ?? "",
  ).replace(/\/$/, "");

  const response = await axios.post<RefreshResponse>(
    `${baseUrl}/auth/refresh`,
    {
      refresh_token: refreshToken,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  saveStoredAuthTokens(response.data.tokens);

  return response.data.tokens.access_token;
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest =
      error.config as RetriableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      !requestCanUseRefresh(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    const accessToken = getStoredAccessToken();
    const refreshToken = getStoredRefreshToken();
    const hadStoredSession = Boolean(
      accessToken || refreshToken,
    );

    if (!refreshToken) {
      if (hadStoredSession) {
        recordSessionExpiry();
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshStoredSession().finally(
          () => {
            refreshPromise = null;
          },
        );
      }

      const newAccessToken = await refreshPromise;
      const headers = AxiosHeaders.from(
        (originalRequest.headers ?? {}) as RawAxiosHeaders,
      );

      headers.set(
        "Authorization",
        `Bearer ${newAccessToken}`,
      );

      originalRequest.headers = headers;

      return apiClient(originalRequest);
    } catch (refreshError) {
      recordSessionExpiry();
      return Promise.reject(refreshError);
    }
  },
);

export function resolveApiAssetUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;

  const baseUrl = String(
    apiClient.defaults.baseURL ?? "",
  ).replace(/\/$/, "");

  return value.startsWith("/")
    ? `${baseUrl}${value}`
    : `${baseUrl}/${value}`;
}

export type AppProfileSummary = {
  name: string;
  display_name: string;
  description: string | null;
  modules: string[];
};

export type AppGenerationRuntime = {
  frontend_url: string;
  backend_url: string;
  api_docs_url: string;
  health_url: string;
  mailpit_url: string;
  frontend_port: number;
  backend_port: number;
  postgres_port: number;
  mailpit_ui_port: number;
  mailpit_smtp_port: number;
};

export type AppGenerationCommands = {
  change_directory: string;
  boot: string;
};

export type AppGenerationResponse = {
  status: "success" | "failed";
  profile: string;
  app_name: string;
  client_name: string | null;
  modules: string[];
  warnings: string[];
  command: string;
  returncode: number;
  output_path: string;
  runtime: AppGenerationRuntime | null;
  commands: AppGenerationCommands | null;
  stdout: string;
  stderr: string;
};

export type AppGenerationPayload = {
  profile: string;
  app_name: string;
  client_name?: string | null;
  modules: string[];
};

export async function fetchAppProfiles() {
  const response =
    await apiClient.get<AppProfileSummary[]>(
      "/app-profiles",
    );

  return response.data;
}

export async function generateApp(
  payload: AppGenerationPayload,
) {
  const response =
    await apiClient.post<AppGenerationResponse>(
      "/app-generation/generate",
      payload,
    );

  return response.data;
}
