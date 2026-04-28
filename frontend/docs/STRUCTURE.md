# 前端项目结构文档（`frontend/`）

本文件说明前端代码的目录组织与各模块职责，对应实际目录结构而非理想化设计文档。

---

## 根目录

- `package.json`：前端依赖与脚本。
- `vite.config.ts`：Vite 构建配置。
- `tsconfig*.json`：TypeScript 配置。
- `eslint.config.js`：ESLint 配置。
- `public/`：静态资源（如 `ies.svg`）。
- `dist/`：构建产物。
- `docs/`：前端说明文档（本目录）。
- `src/`：主要源码目录。

---

## `src/` 目录

### 入口与根组件

- `main.tsx`：
  - 挂载 React 应用、注入 `AuthProvider`。
  - 渲染 `App` 根组件。
- `App.tsx`：
  - 定义路由结构（登录 / 注册 / 首页）。
  - 统一布局入口。
- `index.css`：
  - Vite 默认入口样式，可引入全局 SCSS。

---

### API 层：`src/api/`

- `client.ts`：
  - 封装 Axios 实例 `apiClient`：
    - `baseURL` 由 `VITE_API_BASE_URL` 控制。
    - 统一附加 `Authorization` 头（从本地存储读取 token）。
    - 统一错误处理（如 401 时触发登出等）。
- `index.ts`：
  - 定义全部前端使用的类型和 API 函数（详见 `frontend/docs/API.md`）：
    - 认证：`authLogin`, `authRegister`, `authMe`, `authLogout`
    - 历史数据：`fetchHistoryTree`, `uploadHistory`
    - 集群统计 / 预测：`fetchClusterStats`, `fetchPredictionForDate`, `fetchNodeMatrix`, `updateClusterConfig`, `predictLoad`
    - AI 对话：`fetchChatSessions`, `fetchChatHistory`, `sendChatMessage`, `deleteChatSession`

---

### 认证模块：`src/auth/`

- `AuthProvider.tsx`：
  - 使用 React Context 管理当前用户与 profile 信息。
  - 提供 `useAuth()` hook：
    - `profile`
    - `refreshMe()`
    - 登录 / 登出方法（内部调用 `src/api`）。
- `storage.ts`：
  - 封装对浏览器存储的读写（token、用户信息缓存等）。

---

### UI 与业务组件：`src/components/`

#### `components/layout/`

- `Header/`：
  - `Header.tsx`：顶部导航栏，显示系统标题、当前用户名、退出登录按钮、数据来源说明及折叠按钮。
  - `Header.module.scss`：头部布局与样式。
- `Sidebar/`：
  - `Sidebar.tsx`：
    - 左侧侧边栏，主要展示 AI 对话历史、新对话按钮与删除按钮。
    - 与 `MainPage` 通信：
      - `onSelectSession(sessionId)` 回调切换会话。
      - `collapsed / onToggleCollapse` 控制侧边栏展开与收起。
  - `Sidebar.module.scss`：树状结构 + 会话卡片样式。
- `Scroll/ScrollPanel`：
  - 为主内容区域提供滚动容器和统一留白。

#### `components/common/`

- `StatisticsInfo`：
  - 顶部统计信息卡片，展示总节点数、总核心数、预测准确率、平均节能效率。
- `ChatContainer`：
  - 右下侧聊天区域，展示 AI 会话消息列表与输入框。
  - 接收：
    - `selectedSessionId`
    - `contextDate`（当前选中的预测日期）
    - `onChatUpdated`（用于通知 Sidebar 刷新会话列表）

#### `components/features/`

- `Welcome`：
  - 旧的首次使用配置引导组件，目前演示主流程已不再渲染，但代码仍保留以便后续扩展。
- `LoadPredictor`：
  - 预测相关的功能组件（如手动触发预测）。

#### `components/forms/`

- `LoginForm` / `RegisterForm`：
  - 登录 / 注册表单组件，调用 `authLogin` / `authRegister`。

#### `components/ui/`

- `PredictionChart.tsx`：
  - 使用 `react-chartjs-2` 绘制 24 小时“当天实际 / 节能预测”对比曲线。
  - 提供日期选择器和“显示模式 / 重新计算预测”控制。
  - 在卡片中展示节能策略、负载特征、任务影响等数据。
  - 在每次成功拉取预测数据后触发 `onPredictionUpdated` 回调。
- `NodeMatrix.tsx`：
  - 根据 `/api/nodes` 返回的 `node_states` 绘制节点矩阵。
  - 接收 `refreshTrigger`，在预测数据更新后刷新矩阵。

---

### 页面：`src/pages/`

- `Home/MainPage.tsx`：
  - 系统主界面，负责协调 Header、Sidebar、StatisticsInfo、PredictionChart、NodeMatrix、ChatContainer。
  - 管理关键状态：
    - `selectedDate`
    - `selectedSessionId`
    - `sidebarRefreshTrigger`
    - `nodeMatrixRefreshTrigger`
    - 顶部栏 / 侧边栏折叠状态
  - 通过 props 将这些状态或回调传递给子组件。
- `Login/LoginPage.tsx`：
  - 登录页面，包含 `LoginForm`。
- `Register/RegisterPage.tsx`：
  - 注册页面，包含 `RegisterForm`。

---

### 样式：`src/assets/styles/`

- `_variables.scss`：颜色、间距、字号等基础变量。
- `_mixins.scss`：常用 mixin，如 `flex-center`、`respond-to`、`card`、`button-base` 等。
- `_functions.scss`：颜色 / 间距等函数工具。
- `index.scss`：集中导入上述部分文件，供组件样式 `@use`。

组件级样式全部采用 `*.module.scss`，保证样式局部作用域。
