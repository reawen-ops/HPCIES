# 后端项目流程文档（请求生命周期与关键业务流程）

本文件从“用户视角”和“系统内部视角”两部分，说明后端主要功能的处理流程。

---

## 一、HTTP 请求的通用生命周期

1. **前端发起请求**
   - 请求 URL 形如：`http://localhost:8000/api/...`
   - 鉴权接口（除注册 / 登录外）都带 `Authorization: Bearer <token>` 头。

2. **FastAPI 接收请求（`main.py`）**
   - CORS 中间件通过后，匹配到对应的路由函数（在 `app/api/routes/` 中）。

3. **依赖注入（`Depends`）执行**
   - `get_connection()`：打开一个 SQLite 连接实例 `conn: DbConn`。
   - `get_current_user()`：根据 token 从 `sessions` + `users` 表查出当前用户信息 `user: dict`。

4. **路由处理函数执行业务逻辑**
   - 使用 `conn.cursor()` 读写数据库。
   - 必要时调用 `services` 中的 LSTM / DeepSeek。
   - 组装 Pydantic 响应模型（`schemas`）返回。

5. **响应返回前端**
   - FastAPI 将 Pydantic 模型序列化为 JSON。
   - 前端 Axios / Fetch 解析后更新页面状态。

---

## 二、用户登录与会话管理流程

### 1. 注册 & 登录

1. 前端调用 **`POST /api/auth/register`**
   - `auth.py` 中校验用户名是否存在，使用 `security.hash_password()` 存储哈希密码。

2. 前端调用 **`POST /api/auth/login`**
   - 验证用户名 / 密码：
     - 查询 `users` 表。
     - 使用 `security.verify_password()` 对比哈希。
   - 登录成功：
     - 使用 `security.create_session(conn, user_id)` 写入 `sessions` 表，生成 token 与过期时间。
     - 返回 `AuthSessionResponse` 给前端。

3. 前端将 `token` 持久化（例如 localStorage），之后所有请求通过 Axios 拦截器自动加上 `Authorization` 头。

### 2. 获取当前用户信息

- 前端在进入首页时调用 **`GET /api/auth/me`**
  - 通过 token 查到用户和 `user_profile` 信息。
  - 当前演示模式下，新用户默认已初始化 `38` 个节点、每节点 `64` 核、`has_history=1`，可直接进入主页。

---

## 三、历史数据与预测流程

### 1. 历史数据来源

1. 当前演示模式下，历史核使用数据通常由管理员预先导入 SQLite 数据库中的 `historical_usage(ts, cpu_load)`。
2. 系统仍保留两种导入方式：
   - 通过 **`POST /api/upload-history`**
   - 通过 `backend/scripts/import_usage_csv.py` 脚本
3. 导入流程：
   - 使用 `pandas` 读取 CSV
   - 清洗日期、小时、CPU 核时使用量
   - 写入 `historical_usage(ts, cpu_load)` 表

### 2. 更新集群配置

1. 前端提交 `node_count`, `core_per_node` 至 **`POST /api/config`**。
2. 后端流程：
   - 更新 `user_profile` 中对应字段。
   - 调用 `security.rebuild_node_states()` 生成基础的 `node_states` 建议矩阵（后续可被 DeepSeek 策略覆盖）。

### 3. 按日期请求预测结果

1. 前端在预测曲线组件中选择日期，调用 **`GET /api/predict-date?date=YYYY-MM-DD`**。
2. 后端流程（`others.py` + `lstm_service.py`）：
   - 根据用户 `user_profile` 读取 `node_count`, `core_per_node`。
   - 对该日期的 24 小时执行“**单步滚动预测**”：
     - 对每个小时：
       - 从 `historical_usage` 中取前 24 小时真实负载。
       - 构造请求体 `history_24h` + `last_timestamp`，调用 LSTM 服务 `predict_24h_load(..., predict_hours=1)`。
       - 收集 `predicted_load` / `suggested_nodes`。
   - 统计：
     - `actual_loads`: 该日真实负载（如有）。
     - `history_avg_loads`: 同期历史平均。
     - `utilization`: 负载 / (node*count* core*per_node) * 100。
   - 调用 **`deepseek_service.analyze_prediction_data()`**：
     - 将 24 小时预测负载 + 利用率 + 集群配置组成 Prompt。
     - 优先调用 DeepSeek 返回 JSON；失败则走规则引擎 `generate_rule_based_analysis()`。
   - 得到的结果中：
     - `strategy.sleep_periods/running_nodes/to_sleep_nodes/sleeping_nodes`
     - `effects.*`, `impact.*`
   - 根据 DeepSeek 产生的节点分布：
     - 解析 `"X 个 (Y%)"`，做约束与归一化：
       - `running + to_sleep + sleeping == total_nodes`
       - `to_sleep` 比例 ≥ 5%
       - `running_nodes >= ceil(峰值预测负载 / core_per_node)`
       - 百分比三项之和 = 100%
     - 用这三个数量**重建 `node_states` 表**（覆盖旧数据），保证与前端节点矩阵严格一致。
   - 后端再基于“最终修正后的节点策略”统一计算：
     - `suggested_daily_energy`
     - `actual_daily_energy`
     - `saving_efficiency`
   - 最终返回 `DatePredictionResponse` 给前端。

3. 前端：
   - `PredictionChart.tsx` 使用 `labels` + `actual_loads` + `predicted_loads` 绘制对比曲线。
   - “节能策略”卡片展示 `strategy.*`。
   - “负载特征”中的关键能耗指标直接展示后端计算结果。
   - 通知 `NodeMatrix` 组件刷新 `/api/nodes`，更新可视化矩阵。

---

## 四、AI 对话流程（DeepSeek）

### 1. 会话与消息存储

- 会话表：`chat_sessions(id, user_id, title, created_at, updated_at)`
- 消息表：`chat_messages(id, session_id, user_id, author, text, created_at)`

### 2. 侧边栏“对话历史”

1. 前端加载首页时调用 **`GET /api/chat/sessions`**：
   - 通过 `LEFT JOIN chat_messages` 统计每个会话的 `message_count`。
   - 返回按 `updated_at DESC` 排序的会话列表。

2. 用户点击某个会话：
   - 前端调用 **`GET /api/chat/history?session_id=...`**。
   - 后端从 `chat_messages` 取出完整消息列表，按 `id` 排序返回。

3. 用户点击“新对话”：
   - 前端不传 `session_id` 调用 `POST /api/chat/message`，后端自动创建新会话。

### 3. 发送消息 + 调用 DeepSeek

1. 前端 `ChatContainer` 发送消息：
   - 调用 **`POST /api/chat/message`**，请求体：
     - `text`: 用户问题。
     - `session_id?`: 现有会话 ID 或空。
     - `context_date?`: 当前选中的预测日期。

2. 后端处理（`post_chat_message`）：
   - 若 `session_id` 为空：
     - 以用户消息前 20 个字符生成会话标题，写入 `chat_sessions`。
   - 写入一条 `author='user'` 的消息到 `chat_messages`。
   - 查询该会话最近消息，调用 `format_chat_history_for_api()` 转为 DeepSeek 的对话格式。
   - 如传入 `context_date`：
     - 从 `historical_usage` / LSTM 预测结果中生成“真实数据摘要”系统消息。
     - 插入到对话最前面，作为额外上下文。
   - 调用 `chat_with_deepseek()`：
     - 携带系统级提示词 `get_hpc_system_prompt()`：
       - 明确告诉模型：不要让用户再去跑命令；优先用系统提供的真实数据分析。
     - 获取模型回复文本，做 `_normalize_ai_response()` 处理（去掉多余空行，规范换行）。
   - 将 AI 回复写入 `chat_messages`（`author='ai'`），更新 `chat_sessions.updated_at`。
   - 再次查询该会话完整历史，返回给前端。

3. 前端更新聊天窗口显示，侧边栏的会话列表通过刷新 `/api/chat/sessions` 更新排序和消息数。

### 4. 删除对话

1. 用户在侧边栏 hover 某会话，点击删除图标。
2. 前端调用 **`DELETE /api/chat/sessions/{session_id}`**。
3. 后端：
   - 校验该会话属于当前用户。
   - 删除该会话下的所有 `chat_messages`。
   - 删除 `chat_sessions` 中对应记录。

---

## 五、小结

- **路由层（`api/routes`）**：负责 URL → 业务函数的映射，组合 `Depends` 做鉴权与数据库接入。
- **服务层（`services`）**：封装外部系统（LSTM / DeepSeek）调用与错误处理。
- **数据层（`core/db` + `schemas` + `crud`）**：管理表结构、迁移、Pydantic 模型与简单 CRUD。
- 预测与节能策略的核心流程是：**历史数据 → LSTM 预测 → DeepSeek 分析 → 正规化节点分布 → 重建 `node_states` → 前端曲线 + 节能卡片 + 节点矩阵统一展示**。
