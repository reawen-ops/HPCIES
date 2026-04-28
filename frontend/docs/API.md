# 前端 API 调用文档（`src/api`）

本文件说明前端通过 `src/api/index.ts` 封装的所有主要 API 调用方式。所有请求最终都指向后端的 `/api/*` 接口，底层由 `apiClient`（基于 Axios）统一处理：

```ts
// src/api/client.ts
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
  withCredentials: true,
});
// 并在此处设置 Authorization 拦截器等
```

---

## 认证相关

### `authRegister(payload)`

- **描述**：注册新用户。
- **签名**：
  ```ts
  authRegister(payload: { username: string; password: string }): Promise<void>
  ```
- **后端接口**：`POST /api/auth/register`

### `authLogin(payload)`

- **描述**：登录并获取 token。
- **签名**：
  ```ts
  authLogin(payload: { username: string; password: string }): Promise<AuthSessionResponse>
  ```
- **返回**：
  - `token: string`
  - `expires_at: string`
  - `user: { id: number; username: string }`
- **后端接口**：`POST /api/auth/login`

### `authLogout()`

- **描述**：注销当前登录。
- **签名**：`authLogout(): Promise<void>`
- **后端接口**：`POST /api/auth/logout`

### `authMe()`

- **描述**：获取当前用户和集群配置。
- **签名**：
  ```ts
  authMe(): Promise<MeResponse>
  ```
- **返回**：
  - `user: { id, username }`
  - `profile: { node_count, core_per_node, has_history }`
- **后端接口**：`GET /api/auth/me`

---

## 历史数据与统计

### `fetchHistoryTree()`

- **描述**：获取历史数据按年/月/日划分的树，用于侧边栏“数据详情”。
- **签名**：
  ```ts
  fetchHistoryTree(): Promise<HistoryTreeResponse>
  ```
- **返回结构**：
  - `years: Array<{ year: number; months: Array<{ month: number; days: Array<{ date: string }> }> }>`
- **后端接口**：`GET /api/history/tree`

### `fetchClusterStats()`

- **描述**：获取集群总体统计信息（首页顶部卡片）。
- **签名**：
  ```ts
  fetchClusterStats(): Promise<ClusterStats>
  ```
- **返回结构**：
  - `total_nodes, core_per_node, total_cores, data_days, latest_date, avg_utilization`
- **后端接口**：`GET /api/stats`

### `uploadHistory(file)`

- **描述**：上传历史 CSV 文件并导入后端。当前演示模式下主流程不要求用户在前端执行此操作，但接口仍保留。
- **签名**：
  ```ts
  uploadHistory(file: File): Promise<{
    success: boolean;
    rows_imported: number;
    estimated_nodes: number;
    core_per_node: number;
    suggested_date?: string;
    data_range?: { start: string; end: string };
  }>
  ```
- **后端接口**：`POST /api/upload-history`（`multipart/form-data`）

---

## 预测与节点矩阵

### `fetchPredictionForDate(date, range?)`

- **描述**：请求指定日期的 24 小时预测结果与节能策略，用于首页预测曲线与“节能策略”面板。
- **签名**：
  ```ts
  fetchPredictionForDate(date: string, range?: string): Promise<DatePredictionResponse>
  ```
- **关键字段**：
  - `labels: string[]`（如 `"00:00" ~ "23:00"`）
  - `predicted_loads: (number | null)[]`
  - `suggested_nodes: (number | null)[]`
  - `actual_loads?: (number | null)[]`
  - `history_avg_loads?: (number | null)[]`
  - `utilization: number[]`
  - `energy_saving: number[]`
  - `strategy.*` / `effects.*` / `impact.*`
  - `effects.suggested_daily_energy?`: 建议策略日耗电量（后端统一计算）
  - `effects.actual_daily_energy?`: 实际日耗电估算量（后端统一计算）
  - `effects.saving_efficiency?`: 节能效率（后端统一计算）
  - `impact.immediate_capacity?`: 可立即启动容量
- **后端接口**：`GET /api/predict-date`

### `fetchNodeMatrix()`

- **描述**：获取当前“节能策略”对应的节点矩阵（每个节点的 running/to_sleep/sleeping）。
- **签名**：
  ```ts
  fetchNodeMatrix(): Promise<NodeMatrixResponse>
  ```
- **返回结构**：
  - `total_nodes: number`
  - `nodes: Array<{ node_id: number; status: "running" | "sleeping" | "to_sleep" }>`
- **后端接口**：`GET /api/nodes`

### `updateClusterConfig(payload)`

- **描述**：更新集群配置（节点数 / 每节点核心数）。当前演示模式下新注册用户已默认初始化为 `38` 节点、`64` 核/节点，接口仍保留用于手动调整。
- **签名**：
  ```ts
  updateClusterConfig(payload: { node_count: number; core_per_node: number }): Promise<void>
  ```
- **后端接口**：`POST /api/config`

### `predictLoad(payload)`

- **描述**：单点预测封装，用于调试 LSTM 模型（普通页面未直接使用）。
- **签名**：
  ```ts
  predictLoad(payload: LoadPredictionRequest): Promise<LoadPredictionResponse>
  ```
- **后端接口**：`POST /api/predict-load`

---

## AI 对话相关

### `fetchChatSessions()`

- **描述**：获取当前用户的对话会话列表，用于侧边栏“对话历史”。
- **签名**：
  ```ts
  fetchChatSessions(): Promise<ChatSessionsResponse>
  ```
- **返回**：
  - `sessions: Array<{ id, title, created_at, updated_at, message_count }>`
- **后端接口**：`GET /api/chat/sessions`

### `deleteChatSession(sessionId)`

- **描述**：删除指定会话及其消息（在 Sidebar 中悬浮删除）。
- **签名**：
  ```ts
  deleteChatSession(sessionId: number): Promise<void>
  ```
- **后端接口**：`DELETE /api/chat/sessions/{session_id}`

### `fetchChatHistory(sessionId?)`

- **描述**：获取指定会话的历史消息；如不传 `sessionId`，后端会返回最新会话或自动创建。
- **签名**：
  ```ts
  fetchChatHistory(sessionId?: number): Promise<ChatHistoryResponse>
  ```
- **返回**：
  - `session_id`
  - `messages: Array<{ id, author, text, created_at }>`
- **后端接口**：`GET /api/chat/history`

### `sendChatMessage(text, sessionId?, contextDate?)`

- **描述**：发送用户问题，后端调用 DeepSeek 返回 AI 回复，并更新会话历史。
- **签名**：
  ```ts
  sendChatMessage(
    text: string,
    sessionId?: number,
    contextDate?: string,
  ): Promise<ChatHistoryResponse>
  ```
- **参数说明**：
  - `text`: 用户输入的问题。
  - `sessionId`: 可选，当前会话 ID，若为空表示新对话。
  - `contextDate`: 可选，当前页面选中的预测日期（用于让后端拼接该日预测/历史数据给大模型）。
- **后端接口**：`POST /api/chat/message`

---

## 其他

### `fetchPrediction()`

- **描述**：早期 demo 用的静态预测接口封装（当前主页面使用 `fetchPredictionForDate`）。
- **后端接口**：`GET /api/prediction`
