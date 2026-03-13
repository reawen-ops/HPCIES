# HPCIES - HPC 智能节能调度系统

High-performance Computers Intelligent Energy-saving Scheduler

这是一个端到端的 HPC 集群智能节能调度系统，包括：

- **后端（`backend/`）**：FastAPI + SQLite，负责用户认证、历史数据导入、对接 LSTM 预测服务、调用 DeepSeek AI、生成节能策略并管理节点状态。
- **前端（`frontend/`）**：React + TypeScript + Vite，提供预测曲线、节能策略、节点矩阵与 AI 助手的可视化界面。

完整文档请查看 `docs/` 目录以及前后端各自的 `docs/` 子目录。

---

## 目录结构概览

```text
HPCIES/
├── backend/          # 后端服务（FastAPI）
├── frontend/         # 前端应用（React + TS + Vite）
├── node_modules/     # 根依赖（如有）
├── .vscode/          # 开发环境配置
└── .gitignore
```

各子项目有自己的 README 与详细文档：

- 后端：`backend/README.md`，以及 `backend/docs/` 下的：`API.md`、`STRUCTURE.md`、`FLOW.md`
- 前端：`frontend/README.md`，以及 `frontend/docs/` 下的：`API.md`、`STRUCTURE.md`、`FLOW.md`
- 顶层使用与接口约定：`docs/USAGE_GUIDE.md`、`docs/NODE_COUNT_FLOW.md`、`docs/API.md`

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

## 功能简介（从用户视角）

- **负载预测与节能策略**
  - 上传历史 CSV 数据，由后端写入 SQLite。
  - 调用外部 LSTM 模型，对指定日期执行 24 小时单步滚动预测。
  - 使用 DeepSeek AI 对预测结果做分析，生成节能策略（休眠时段 + 节点分布）、负载特征与任务影响评估。
  - 节能策略中的节点分布会同步到 `node_states` 表，前端以节点矩阵形式展示。

- **AI 助手**
  - 多会话聊天，支持历史会话列表、新建会话、删除会话。
  - 用户在主页就某一天的预测曲线提问时，前端会把当前选中的日期传给后端，后端自动将该日真实数据与预测摘要注入给 DeepSeek，保证回答贴合实际。

更多细节（接口、结构与流程）请参考 `backend/docs/*`、`frontend/docs/*` 以及 `docs/USAGE_GUIDE.md`。

---

## 技术栈概览

- **后端**
  - 框架：FastAPI
  - 数据库：SQLite（通过 `app/core/db.py` 统一初始化与迁移）
  - 配置：`pydantic-settings` + `.env`
  - 外部服务：LSTM 预测 API、DeepSeek Chat Completion API

- **前端**
  - 框架：React + TypeScript + Vite
  - 样式：SCSS Modules（集中在 `src/assets/styles`，通过 mixins/variables 统一风格）
  - 数据请求：Axios（封装在 `src/api/client.ts`，所有接口集中在 `src/api/index.ts`）
  - 图表：`react-chartjs-2` + `chart.js`（预测曲线）

---

## 关键模块一览

- **后端核心模块**
  - 路由：`backend/src/app/api/routes/`
    - `auth.py`：登录 / 注册 / 当前用户
    - `others.py`：上传历史数据、统计、预测、节点矩阵、AI 对话等主业务接口
  - 服务：`backend/src/app/services/`
    - `lstm_service.py`：封装对 LSTM 云服务的调用
    - `deepseek_service.py`：封装对 DeepSeek 的调用与节能策略分析
  - 数据与配置：`backend/src/app/core/config.py`、`backend/src/app/core/db.py`

- **前端核心模块**
  - 页面：`frontend/src/pages/Home/MainPage.tsx` 为主页面调度中心
  - 布局：`frontend/src/components/layout/Header`、`Sidebar`、`ScrollPanel`
  - 预测与节能：`frontend/src/components/ui/Chart/PredictionChart.tsx`、`NodeMatrix.tsx`
  - AI 对话：`frontend/src/components/common/ChatContainer.tsx` + 侧边栏会话管理

---

## 开发与调试建议

- **环境变量**
  - 在 `backend/.env` 中配置后端所需环境（尤其是 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`、`CORS_ORIGINS`）。
  - 在 `frontend/.env` 或 `.env.local` 中配置前端 API 地址，例如：
    ```env
    VITE_API_BASE_URL=http://127.0.0.1:8000
    ```

- **常见问题排查思路**
  - 前端提示“发送消息失败 / 预测超时”：
    - 检查浏览器 Network 面板中对应请求的状态码和后端返回的 `detail` 字段。
    - 确认 LSTM API 与 DeepSeek API 的网络连通性和密钥配置。
  - 预测曲线与测试脚本数据不一致：
    - 确认 `/api/predict-date` 是否使用了“单步滚动预测”逻辑。
    - 对比 `backend/src/app/services/lstm_service.py` 与测试脚本的调用参数。
