import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
});

// 自动携带登录 token（若存在）
apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("hpcies_auth");
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
      if (parsed?.token) {
        config.headers = config.headers ?? {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (config.headers as any).Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch {
    // ignore
  }
  return config;
});