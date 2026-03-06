import { apiClient } from "./client";

export interface ClusterStats {
  // 下列三个字段未来由大模型提供，目前可能为 null
  today_saving_percent: number | null;
  total_nodes: number;
  running_nodes: number | null;
  today_tasks: number | null;
}

export interface PredictionResponse {
  labels: string[];
  full_load: number[];
  energy_saving: number[];
  strategy: {
    sleep_periods: string;
    node_distribution: {
      running: string;
      to_sleep: string;
      sleeping: string;
    };
    wake_ahead: string;
  };
  effects: {
    saving_percent: string;
    saving_core_hours: string;
    saving_power: string;
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
}

export interface ChatHistoryResponse {
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

export async function fetchChatHistory(): Promise<ChatHistoryResponse> {
  const response =
    await apiClient.get<ChatHistoryResponse>("/api/chat/history");
  return response.data;
}

export async function sendChatMessage(
  text: string,
): Promise<ChatHistoryResponse> {
  const response = await apiClient.post<ChatHistoryResponse>(
    "/api/chat/message",
    { text },
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
}

export async function fetchPredictionForDate(
  date: string,
): Promise<DatePredictionResponse> {
  const response = await apiClient.get<DatePredictionResponse>(
    "/api/predict-date",
    { params: { date } },
  );
  return response.data;
}

export async function uploadHistory(file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  await apiClient.post("/api/upload-history", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
