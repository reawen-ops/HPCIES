# 后端项目结构说明

后端基于 **FastAPI + SQLite** 构建，代码位于 `backend/src/` 目录下。

## 顶层结构（`backend/`）

- `requirements.txt`：后端依赖列表。
- `README.md`：后端使用说明。
- `docs/`：后端文档（当前目录）。
- `scripts/`：数据库迁移、CSV 导入、用户默认配置重置、数据预览等脚本。
- `src/`：
  - `main.py`：FastAPI 入口。
  - `hpcies.sqlite3`：默认 SQLite 数据库文件。
  - `app/`：主应用包。

---

## 应用包结构（`backend/src/app/`）

- `api/`
  - `__init_.py`：聚合路由，导出 `router` 并在 `main.py` 中挂载。
  - `routes/`
    - `__init__.py`：创建 `APIRouter`，并 `include_router(auth.router, others.router)`。
    - `auth.py`：认证与用户相关接口（注册 / 登录 / 登出 / 当前用户信息）。
    - `others.py`：业务主路由：
      - 集群统计：`/stats`
      - 节能节点矩阵：`/nodes`
      - 历史数据树 & 上传：`/history/tree`, `/upload-history`
      - 集群配置：`/config`
      - LSTM 预测：`/predict-load`, `/predict-date`
      - AI 对话：`/chat/sessions`, `/chat/history`, `/chat/message`

- `core/`
  - `config.py`：全局配置（`Settings`），包括：
    - 数据库路径
    - CORS 配置
    - DeepSeek / LSTM API 相关环境变量
  - `db.py`：
    - `init_db()`：启动时初始化 / 迁移 SQLite 表结构。
    - `get_connection()`：提供请求级数据库连接（FastAPI 依赖注入）。
    - 建表逻辑：`users`, `sessions`, `user_profile`, `historical_usage`, `node_states`, `chat_sessions`, `chat_messages`, `prediction_points` 等。

- `crud/`
  - `__init__.py`：提供基础数据访问函数，例如 `get_user_by_id`（供认证 / 业务逻辑复用）。

- `schemas/`
  - `__init__.py`：集中定义 Pydantic 模型：
    - 请求模型：如 `ConfigRequest`, `ChatMessageCreate`, `LoadPredictionRequest`
    - 响应模型：如 `ClusterStats`, `PredictionResponse`, `NodeMatrixResponse`, `DatePredictionResponse`, `ChatSessionsResponse`, `ChatHistoryResponse`

- `services/`
  - `deepseek_service.py`：
    - 负责调用 DeepSeek Chat Completion API。
    - `chat_with_deepseek()`：统一封装 HTTP 请求，返回文本。
    - `get_hpc_system_prompt()`：HPC 能源管家系统级提示词。
    - `format_chat_history_for_api()`：将数据库聊天记录转换为模型消息格式。
    - `analyze_prediction_data()` / `generate_rule_based_analysis()`：对预测结果做 AI/规则分析，生成节能策略（包含节点分布）。
  - `lstm_service.py`：
    - `predict_24h_load()`：对接 LSTM 云函数，发送历史 24 小时负载，获取未来负载预测。
    - 处理异常 / 降级策略。

- `utils/`
  - `security.py`：
    - 密码哈希 / 验证：`hash_password`, `verify_password`
    - 会话 token 生成：`create_session`
    - `rebuild_node_states()`：根据总节点数生成默认 `node_states` 建议矩阵（全局），后续可能被 DeepSeek 节能策略覆盖。

---

## 启动流程（简要）

1. `uvicorn main:app --reload` 启动：
   - 读取 `app.core.config.settings`，创建 `FastAPI(app_title, app_version, ...)`。
   - `app.include_router(api_router)` 注册所有路由。
   - 加载 `CORSMiddleware`，允许前端域名访问。
2. `@app.on_event("startup")` 调用 `init_db()`：
   - 建表 / 轻量迁移（如旧版 `chat_messages` → 新结构）。
3. 每个请求：
   - 通过 `get_connection()` 获取 SQLite 连接。
   - 使用 `get_current_user()`（在 `auth.py`）从 `sessions` + `users` 表校验 token。
   - 业务路由在此基础上读写 `user_profile` / `historical_usage` / `node_states` / `chat_*` 等表。

---

## 常用脚本（`backend/scripts/`）

- `migrate_remove_user_id.py`：将 `historical_usage`、`node_states` 迁移为无 `user_id` 的新结构。
- `import_usage_csv.py`：交互式导入本地 CSV 到 `historical_usage`。
- `reset_user_profile_defaults.py`：将所有用户配置重置为演示默认值（`38` 节点、`64` 核、`has_history=1`）。
- `preview_db_tables.py`：预览数据库中各表前 50 条数据。
