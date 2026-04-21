# HPCIES 后端（FastAPI + SQLite）

本目录是 **HPC 智能节能调度系统** 的后端服务，基于 FastAPI 构建，负责：

- 用户认证与会话管理
- 历史负载数据 CSV 导入与清洗
- 对接外部 LSTM 预测服务，按日期做 24 小时单步滚动预测
- 调用 DeepSeek 大模型分析预测结果，生成节能策略 / 负载特征 / 任务影响
- 提供节点矩阵、预测曲线和 AI 对话的 REST API 给前端使用

完整接口与结构说明请参考：

- `docs/API.md`：接口文档
- `docs/STRUCTURE.md`：项目结构说明
- `docs/FLOW.md`：主要业务流程说明

---

## 环境准备

- Python ≥ 3.10
- 推荐在虚拟环境中安装依赖：

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# 或 source .venv/bin/activate  # Linux / macOS

pip install -r requirements.txt
```

---

## 配置（环境变量 / `.env`）

后端使用 `pydantic-settings` 读取配置，支持 `.env` 文件。常用配置项包括（实际字段以 `app/core/config.py` 中 `Settings` 为准）：

- `APP_TITLE`：应用标题（默认已设置）
- `APP_VERSION`：版本号
- `DATABASE_URL`：SQLite 路径，默认指向 `src/hpcies.sqlite3`
- `CORS_ORIGINS`：允许访问的前端域名，逗号分隔
- `DEEPSEEK_API_KEY`：DeepSeek 大模型 API 密钥
- `DEEPSEEK_BASE_URL`：DeepSeek API 基础地址

在开发环境下，可以在 `backend/.env` 中配置，例如：

```env
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
CORS_ORIGINS=http://localhost:5173
```

> 注意：`main.py` 所在目录为 `backend/src`，`Settings` 已配置从上一级的 `.env` 读取。

---

## 启动后端服务

在虚拟环境已激活、依赖安装完成后：

```bash
cd backend/src
uvicorn main:app --reload
```

默认监听：`http://127.0.0.1:8000`

前端通过 `http://127.0.0.1:8000/api/...` 访问后端接口。

---

## 核心功能概览

- **认证与用户**
  - 注册、登录、登出、获取当前用户信息（`/api/auth/*`）
  - 使用 PBKDF2-SHA256 存储密码，Session token 24 小时有效

- **历史数据与预测**
  - 上传 CSV 历史数据（`/api/upload-history`），写入 `historical_usage`
  - 获取历史数据日期树（`/api/history/tree`）
  - 配置节点数与每节点核心数（`/api/config`）
  - 指定日期 24 小时滚动预测（`/api/predict-date`），对接 LSTM 服务并返回：
    - 实际负载 / 历史平均 / 预测负载
    - 节能策略（休眠时段 + 节点分布）
    - 负载特征与任务影响分析

- **节能节点矩阵**
  - 节能策略中的三类节点数量（必须运行 / 待休眠 / 休眠）会写入 `node_states`
  - 前端通过 `/api/nodes` 获取并绘制节点矩阵

- **AI 对话（DeepSeek）**
  - 多会话管理：`/api/chat/sessions`、`/api/chat/history`
  - 发送消息并调用 DeepSeek：`/api/chat/message`
    - 可附带 `context_date`，自动将当日预测与统计数据总结为系统提示，提供给大模型
  - 支持删除单个会话：`DELETE /api/chat/sessions/{session_id}`

更详细的字段说明和流程图，请查看 `docs/API.md` 和 `docs/FLOW.md`。

---

## 数据存储

默认使用 SQLite 数据库 `backend/src/hpcies.sqlite3`，表结构由 `app/core/db.py:init_db()` 负责创建与轻量迁移，包含：

- `users`：用户信息
- `sessions`：登录会话（token）
- `user_profile`：节点数 / 每节点核心数 / 历史数据标记
- `historical_usage`：历史负载时间序列
- `node_states`：节点矩阵状态（running/to_sleep/sleeping）
- `chat_sessions` / `chat_messages`：AI 对话会话与消息
- `prediction_points`：早期 demo 用的静态预测数据（目前主要用于兼容老接口）

---

## 演示阶段数据库脚本

- 迁移 `historical_usage`、`node_states` 去除 `user_id` 字段：

```bash
cd backend
python scripts/migrate_remove_user_id.py
```

- 从本地 CSV 导入核使用数据到 `historical_usage`：

```bash
cd backend
python scripts/import_usage_csv.py
```
