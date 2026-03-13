# HPCIES - HPC 智能节能调度系统

High-performance Computers Intelligent Energy-saving Scheduler

这是一个端到端的 HPC 集群智能节能调度系统，包括：

- **后端（`backend/`）**：FastAPI + SQLite，负责用户认证、历史数据导入、对接 LSTM 预测服务、调用 DeepSeek AI、生成节能策略并管理节点状态。
- **前端（`frontend/`）**：React + TypeScript + Vite，提供预测曲线、节能策略、节点矩阵与 AI 助手的可视化界面。

完整文档请查看 `docs/` 目录。

---

## 目录结构概览

```text
HPCIES/
├── backend/          # 后端服务（FastAPI）
├── frontend/         # 前端应用（React + TS + Vite）
├── docs/             # 顶层文档（使用指南、API 约定等）
├── node_modules/     # 根依赖（如有）
├── .vscode/          # 开发环境配置
└── .gitignore
```

各子项目有自己的 README 与详细文档：

- 后端：`backend/README.md`，以及 `backend/docs/` 下的：
  - `API.md`、`STRUCTURE.md`、`FLOW.md`
- 前端：`frontend/README.md`，以及 `frontend/docs/` 下的：
  - `API.md`、`STRUCTURE.md`、`FLOW.md`
- 总体说明与使用指南：`docs/README.md`、`docs/USAGE_GUIDE.md`、`docs/NODE_COUNT_FLOW.md`、`docs/API.md`

---

## 快速运行（开发环境）

### 1. 启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# 或 source .venv/bin/activate  # Linux / macOS

pip install -r requirements.txt

cd src
uvicorn main:app --reload
```

默认监听 `http://127.0.0.1:8000`。

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认监听 `http://127.0.0.1:5173`。

请确保前端的 `VITE_API_BASE_URL` 指向后端地址（见 `frontend/README.md`）。

---

## 功能简介

- **负载预测与节能策略**
  - 上传历史 CSV 数据，由后端写入 SQLite。
  - 调用外部 LSTM 模型，对指定日期执行 24 小时单步滚动预测。
  - 使用 DeepSeek AI 对预测结果做分析，生成节能策略（休眠时段 + 节点分布）、负载特征与任务影响评估。
  - 节能策略中的节点分布会同步到 `node_states` 表，前端以节点矩阵形式展示。

- **AI 助手**
  - 多会话聊天，支持历史会话列表、新建会话、删除会话。
  - 用户在主页就某一天的预测曲线提问时，前端会把当前选中的日期传给后端，后端自动将该日真实数据与预测摘要注入给 DeepSeek，保证回答贴合实际。

更多细节（接口、结构与流程）请参考 `docs/` 及前后端各自的文档目录。


