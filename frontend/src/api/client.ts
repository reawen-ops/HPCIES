import axios from "axios";

// 生产构建（如 Docker + Nginx 同域部署）应走相对路径，请求发到当前页面的域名下的 /api。
// 若未设置 VITE_API_BASE_URL：开发时用本机后端；生产用空 baseURL（同域）。
const baseURL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

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