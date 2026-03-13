# 后端接口文档（FastAPI）

本文档基于 `backend/src/app/api/routes/` 下现有路由做的整理，所有接口前缀默认为 `/api`（在 `main.py` 中通过 `app.include_router(api_router)` 统一挂载）。

---

## 认证与用户（`auth.py`）

> 路径前缀：`/api/auth`

- **POST `/api/auth/register`**
  - **说明**：注册新用户。
  - **请求体**：
    - `username`: string
    - `password`: string
  - **返回**：`200 OK`，空响应。

- **POST `/api/auth/login`**
  - **说明**：用户登录，返回会话 token。
  - **请求体**：
    - `username`: string
    - `password`: string
  - **返回**：`AuthSessionResponse`
    - `token`: string（用于后续 `Authorization: Bearer <token>`）
    - `expires_at`: string `"YYYY-MM-DD HH:MM:SS"`
    - `user`: `{ id, username }`

- **POST `/api/auth/logout`**
  - **说明**：注销当前会话，令 token 失效。
  - **鉴权**：需要登录。
  - **返回**：`200 OK`。

- **GET `/api/auth/me`**
  - **说明**：获取当前登录用户信息及集群配置。
  - **鉴权**：需要登录。
  - **返回**：
    - `user`: `{ id, username }`
    - `profile`:
      - `node_count`: number \| null
      - `core_per_node`: number \| null
      - `has_history`: 0 \| 1
      - `updated_at`: string \| null

---

## 集群统计与节点矩阵（`others.py`）

- **GET `/api/stats`**
  - **说明**：获取当前用户的集群统计信息。
  - **鉴权**：需要登录。
  - **返回**：`ClusterStats`
    - `total_nodes`: 总节点数
    - `core_per_node`: 每节点核心数
    - `total_cores`: 总核心数
    - `data_days`: 历史数据天数
    - `latest_date`: 最近一条历史数据日期（`YYYY-MM-DD`）
    - `avg_utilization`: 平均利用率（%）

- **GET `/api/nodes`**
  - **说明**：获取当前用户的节点矩阵建议（节能策略对应的节点运行 / 待休眠 / 休眠状态）。
  - **鉴权**：需要登录。
  - **返回**：`NodeMatrixResponse`
    - `total_nodes`: number
    - `nodes`: `Array<{ node_id: number; status: "running" | "sleeping" | "to_sleep" }>`

---

## 历史数据与上传（`others.py`）

- **GET `/api/history/tree`**
  - **说明**：按年 / 月 / 日返回已导入历史数据日期树，用于侧边栏“数据详情”。
  - **鉴权**：需要登录。
  - **返回**：`HistoryTreeResponse`
    - `years: Array<{ year: number; months: Array<{ month: number; days: Array<{ date: string }> }> }>`

- **POST `/api/upload-history`**
  - **说明**：上传历史 CSV 文件，导入 `historical_usage`。
  - **鉴权**：需要登录。
  - **请求**：`multipart/form-data`
    - `file`: CSV 文件，字段名 `file`
  - **返回**：
    - `success`: boolean
    - `rows_imported`: number
    - `estimated_nodes`: number
    - `core_per_node`: number
    - `suggested_date?`: string（推荐预测日期）
    - `data_range?`: `{ start: string; end: string }`

---

## 集群配置（`others.py`）

- **POST `/api/config`**
  - **说明**：更新当前用户的集群配置（节点数、每节点核心数），并重建 `node_states`。
  - **鉴权**：需要登录。
  - **请求体**：`ConfigRequest`
    - `node_count`: number
    - `core_per_node`: number
  - **返回**：`200 OK`，空响应。

---

## LSTM 负载预测相关（`others.py` + `lstm_service.py`）

- **POST `/api/predict-load`**
  - **说明**：包装调用 LSTM 服务，预测未来若干小时的负载（通用内部调试接口）。
  - **鉴权**：需要登录。
  - **请求体**：`LoadPredictionRequest`
    - `history_24h`: `number[24]`，最近 24 小时负载
    - `last_timestamp`: string `"YYYY-MM-DD HH:MM:SS"`
    - （可选）`predict_hours`: number，默认 24，由服务端控制
  - **返回**：`LoadPredictionResponse`
    - `predicted_load`: number
    - `suggested_nodes`: number

- **GET `/api/predict-date`**
  - **说明**：根据用户上传的历史数据 + LSTM 模型，对某一天的 24 小时负载进行“单步滚动预测”，并给出节能策略。
  - **鉴权**：需要登录。
  - **参数**：
    - `date`: string，必填，格式 `YYYY-MM-DD`
    - `range?`: string，当前前端固定为 `"今日"`，预留扩展
  - **返回**：`DatePredictionResponse`
    - `date`: 请求日期
    - `labels`: `string[<=24]`，`"00:00" ~ "23:00"`
    - `predicted_loads`: `(number | null)[]`，LSTM 预测的负载
    - `suggested_nodes`: `(number | null)[]`，每小时建议开启节点数
    - `actual_loads?`: `(number | null)[]`，该日真实负载（如有）
    - `history_avg_loads?`: `(number | null)[]`，历史同期平均负载
    - `utilization`: `number[]`，利用率（%）
    - `energy_saving`: `number[]`，节能曲线
    - `strategy`:
      - `sleep_periods`: string，建议休眠时段（如 `"02:00-06:00"`）
      - `running_nodes`: `"X 个 (Y%)"`
      - `to_sleep_nodes`: `"X 个 (Y%)"`（强约束：比例 ≥ 5%）
      - `sleeping_nodes`: `"X 个 (Y%)"`
    - `effects`: 负载特征分析
    - `impact`: 任务影响分析

---

## AI 对话相关（DeepSeek）（`others.py` + `deepseek_service.py`）

- **GET `/api/chat/sessions`**
  - **说明**：获取当前用户的所有对话会话列表，用于侧边栏“对话历史”。
  - **鉴权**：需要登录。
  - **返回**：`ChatSessionsResponse`
    - `sessions: Array<{ id, title, created_at, updated_at, message_count }>`

- **DELETE `/api/chat/sessions/{session_id}`**
  - **说明**：删除指定会话及其消息（只允许删除自己的会话）。
  - **鉴权**：需要登录。
  - **返回**：`{ "success": true }`

- **GET `/api/chat/history`**
  - **说明**：获取某个会话的消息列表，若不传 `session_id` 则自动选择最近会话 / 创建新会话。
  - **鉴权**：需要登录。
  - **查询参数**：
    - `session_id?`: number
  - **返回**：`ChatHistoryResponse`
    - `session_id`: number
    - `messages`: `Array<{ id, author: "user" | "ai", text, created_at }>`

- **POST `/api/chat/message`**
  - **说明**：发送一条用户消息，后端调用 DeepSeek 生成 AI 回复，保存整个对话并返回最新历史。
  - **鉴权**：需要登录。
  - **请求体**：`ChatMessageCreate`
    - `text`: string，用户问题
    - `session_id?`: number，若为空则创建新会话
    - `context_date?`: string，前端当前选中的预测日期（用于拼装真实数据上下文）
  - **返回**：`ChatHistoryResponse`（同上，包含新生成的 AI 回复）。

---

## 其它

- **GET `/api/prediction`**
  - 仅用于最初的静态 demo（读取 `prediction_points`），当前前端已改用 `/api/predict-date`，线上可视情况保留或下线。
