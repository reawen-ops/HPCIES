import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? // 空值合并运算符，优先使用自定义的vite环境变量
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8000"); // 否则判断是否为生产环境，开发环境默认使用本地地址，生产环境默认使用相对路径

// 导出变量
export const apiClient = axios.create({
  // 创建axios实例，设置基础URL和请求超时时间
  baseURL,
  timeout: 10000,
});

interface AuthData {
  token?: string;
  expiresAt?: string;
}

// 自动携带登录 token（若存在）
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 请求拦截器，接收一个函数作为参数，该函数在每次发送请求前被调用，允许我们修改请求配置
  try {
    const raw = localStorage.getItem("hpcies_auth"); // 从浏览器的本地存储中获取用户的认证信息
    if (raw) {
      const parsed = JSON.parse(raw) as AuthData; // 使用断言语法，定义解析后的对象类型
      if (parsed?.token) {
        config.headers = config.headers ?? {}; // 如果config.headers存在就用它，否则创建空对象
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch {
    // 静默失败，避免localStorage解析失败影响请求发送
  }
  return config; // 返回修改后的config对象，继续发送请求
});
