import { apiClient } from "./client";

// ============ Auth ============
export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthSessionResponse {
  token: string;
  expires_at: string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
  profile: {
    node_count: number | null;
    core_per_node: number | null;
    has_history: number; // 0/1
    updated_at?: string;
  };
}

export async function authRegister(payload: {
  username: string;
  password: string;
}): Promise<void> {
  await apiClient.post("/api/auth/register", payload);
}

export async function authLogin(payload: {
  username: string;
  password: string;
}): Promise<AuthSessionResponse> {
  const response = await apiClient.post<AuthSessionResponse>(
    "/api/auth/login",
    payload,
  );
  return response.data;
}

export async function authLogout(): Promise<void> {
  await apiClient.post("/api/auth/logout");
}

export async function authMe(): Promise<MeResponse> {
  const response = await apiClient.get<MeResponse>("/api/auth/me");
  return response.data;
}

// ============ 历史数据树 ============

export interface HistoryDay {
  date: string;
}

export interface HistoryMonth {
  month: number;
  days: HistoryDay[];
}

export interface HistoryYear {
  year: number;
  months: HistoryMonth[];
}

export interface HistoryTreeResponse {
  years: HistoryYear[];
}

export async function fetchHistoryTree(): Promise<HistoryTreeResponse> {
  const response =
    await apiClient.get<HistoryTreeResponse>("/api/history/tree");
  return response.data;
}

export interface ClusterStats {
  total_nodes: number;
  core_per_node: number;
  total_cores: number;
  data_days: number;
  latest_date: string | null;
  avg_utilization: number;
}

export interface PredictionResponse {
  labels: string[];
  // 主曲线：某一天的实际负载或基准负载
  full_load: number[];
  // 对比曲线：节能方案或预测负载
  energy_saving: number[];
  // 历史同期平均负载（可选）
  history_avg?: number[];
  strategy: {
    sleep_periods: string;
    running_nodes: string;
    to_sleep_nodes: string;
    sleeping_nodes: string;
  };
  effects: {
    avg_utilization: string;
    optimized_utilization: string;
    load_stability: string;
    peak_utilization: string;
    min_utilization: string;
    utilization_range: string;
  };
  impact: {
    delay: string;
    queue_risk: string;
    emergency_response: string;
  };
}

export type NodeStatus = "running" | "sleeping" | "to_sleep";

export interface NodeState {
  node_id: number;
  status: NodeStatus;
}

export interface NodeMatrixResponse {
  total_nodes: number;
  nodes: NodeState[];
}

export type ChatAuthor = "user" | "ai";

export interface ChatMessage {
  id: number;
  author: ChatAuthor;
  text: string;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatSessionsResponse {
  sessions: ChatSession[];
}

export interface ChatHistoryResponse {
  session_id: number;
  messages: ChatMessage[];
}

export async function fetchClusterStats(): Promise<ClusterStats> {
  const response = await apiClient.get<ClusterStats>("/api/stats");
  return response.data;
}

export async function fetchPrediction(): Promise<PredictionResponse> {
  const response = await apiClient.get<PredictionResponse>("/api/prediction");
  return response.data;
}

export async function fetchNodeMatrix(): Promise<NodeMatrixResponse> {
  const response = await apiClient.get<NodeMatrixResponse>("/api/nodes");
  return response.data;
}

export async function fetchChatSessions(): Promise<ChatSessionsResponse> {
  const response =
    await apiClient.get<ChatSessionsResponse>("/api/chat/sessions");
  return response.data;
}

export async function fetchChatHistory(
  sessionId?: number,
): Promise<ChatHistoryResponse> {
  const response = await apiClient.get<ChatHistoryResponse>(
    "/api/chat/history",
    { params: sessionId ? { session_id: sessionId } : {} },
  );
  return response.data;
}

export async function sendChatMessage(
  text: string,
  sessionId?: number,
  contextDate?: string,
): Promise<ChatHistoryResponse> {
  const response = await apiClient.post<ChatHistoryResponse>(
    "/api/chat/message",
    { text, session_id: sessionId, context_date: contextDate },
    // DeepSeek 调用可能较慢，避免前端 10s 超时导致“发送失败”
    { timeout: 60000 },
  );
  return response.data;
}

export async function updateClusterConfig(payload: {
  node_count: number;
  core_per_node: number;
}): Promise<void> {
  await apiClient.post("/api/config", payload);
}

export interface LoadPredictionRequest {
  history_24h: number[];
  last_timestamp: string;
}

export interface LoadPredictionResponse {
  predicted_load: number;
  suggested_nodes: number;
}

export async function predictLoad(
  payload: LoadPredictionRequest,
): Promise<LoadPredictionResponse> {
  const response = await apiClient.post<LoadPredictionResponse>(
    "/api/predict-load",
    payload,
  );
  return response.data;
}

export interface DatePredictionResponse {
  date: string;
  labels: string[];
  predicted_loads: (number | null)[];
  suggested_nodes: (number | null)[];
  actual_loads?: (number | null)[];
  history_avg_loads?: (number | null)[];
  utilization: number[];
  energy_saving: number[];
  strategy: {
    sleep_periods: string;
    running_nodes: string;
    to_sleep_nodes: string;
    sleeping_nodes: string;
  };
  effects: {
    avg_utilization: string;
    optimized_utilization: string;
    load_stability: string;
    peak_utilization: string;
    min_utilization: string;
    utilization_range: string;
  };
  impact: {
    delay: string;
    queue_risk: string;
    emergency_response: string;
  };
}

export async function fetchPredictionForDate(
  date: string,
  range?: string, // e.g. "今日" / "未来3天" / "未来7天"
): Promise<DatePredictionResponse> {
  const response = await apiClient.get<DatePredictionResponse>(
    "/api/predict-date",
    {
      params: { date, range },
      // LSTM 预测可能较慢，单次请求延长超时时间
      timeout: 60000,
    },
  );
  return response.data;
}

export async function uploadHistory(file: File): Promise<{
  success: boolean;
  rows_imported: number;
  estimated_nodes: number;
  core_per_node: number;
  suggested_date?: string;
  data_range?: {
    start: string;
    end: string;
  };
}> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post("/api/upload-history", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}
