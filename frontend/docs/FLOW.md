# 前端项目流程文档（主要用户路径）

本文件从“用户操作 → 前端组件 → API 调用”的角度，说明前端主要功能的工作流程。

---

## 1. 应用启动与路由

1. **浏览器访问前端地址**（开发环境：`http://localhost:5173`）
2. `src/main.tsx`：
   - 创建 React 根节点。
   - 用 `AuthProvider` 包裹 `App`，提供认证上下文。
3. `src/App.tsx`：
   - 根据路由呈现：
     - `/login` → `LoginPage`
     - `/register` → `RegisterPage`
     - `/`（默认）→ `MainPage`

---

## 2. 登录 / 注册流程

### 注册

1. 用户访问 `/register`，渲染 `RegisterPage` → `RegisterForm`。
2. 填写用户名和密码，点击“注册”：
   - 表单组件调用 `authRegister({ username, password })`。
   - 成功后通常跳转到登录页或自动登录（由页面逻辑控制）。

### 登录

1. 用户访问 `/login`，渲染 `LoginPage` → `LoginForm`。
2. 填写用户名和密码，点击“登录”：
   - `LoginForm` 调用 `authLogin(payload)`。
   - 成功后：
     - `AuthProvider` 存储 token（storage.ts）。
     - 跳转到 `/`（首页 MainPage）。

3. 进入首页后，`MainPage` 在 `useEffect` 中调用 `refreshMe()`：
   - 触发 `authMe()` 请求，获取 `user` + `profile`。
   - 决定是否显示 Welcome 向导（未配置节点 / 未上传历史数据时显示）。

---

## 3. 首次使用：上传历史数据 & 配置集群

1. `MainPage` 发现 `needsSetup === true`，在主界面上方渲染 `Welcome` 组件。
2. 用户在 `Welcome` 中：
   - 上传 CSV 文件 → 调用 `uploadHistory(file)`：
     - 返回导入条数、推断节点数、每节点核心数、建议预测日期等。
   - 调整或确认节点数和每节点核心数 → 调用 `updateClusterConfig({ node_count, core_per_node })`。
3. `Welcome` 完成后调用 `onComplete(config)`：
   - `MainPage` 中：
     - 再次 `refreshMe()`，确保 profile 最新。
     - 更新 `selectedDate`（优先使用 `suggestedDate`，否则取昨天）。
     - 触发 `sidebarRefreshTrigger`，让 Sidebar 重新拉取历史树。

---

## 4. 首页整体数据流（`MainPage` 中心协调）

`MainPage` 是前端的“调度中心”，负责：

- Header：显示用户信息和系统标题。
- Sidebar：选择历史日期、切换/新建对话。
- StatisticsInfo：展示集群统计概览。
- PredictionChart：展示 24 小时预测，对应选中日期。
- NodeMatrix：展示节点矩阵，与节能策略对应。
- ChatContainer：AI 对话区域。

关键状态：

- `selectedDate: string`：当前选中的预测日期。
- `selectedSessionId: number | null`：当前选中的对话会话。
- `sidebarRefreshTrigger: number`：侧边栏数据刷新计数。
- `nodeMatrixRefreshTrigger: number`：节点矩阵刷新计数。

这些状态通过 props 与子组件联动，实现以下流程。

---

## 5. 预测曲线与节点矩阵联动

### 选择日期

1. 用户在 Sidebar 的“数据详情”中点击某个日期：
   - `Sidebar` 调用 `onSelectDate(day.date)`。
   - `MainPage` 更新 `selectedDate`。

2. 或者用户在 `PredictionChart` 的日期输入框中手动选择日期：
   - 触发 `onChangeDate` 回调。
   - 同样更新 `selectedDate`。

### 拉取预测数据

1. `PredictionChart` 通过 props 接收到 `selectedDate`。
2. 在 `useEffect` 中调用：
   - `fetchPredictionForDate(selectedDate, range)`（当前 range 固定为 "今日"）。
3. 收到数据后：
   - 构造 Chart.js 所需的 `chartData`。
   - 绘制“当天实际 / 历史平均 / 节能预测”三条曲线。
   - 显示来自后端 / DeepSeek 的 `strategy`、`effects`、`impact`。
4. 成功拉取数据时，调用 `onPredictionUpdated()` 回调：
   - `MainPage` 将 `nodeMatrixRefreshTrigger` 自增。

### 刷新节点矩阵

1. `NodeMatrix` 接收到新的 `refreshTrigger`：
   - 在 `useEffect` 中调用 `fetchNodeMatrix()`。
2. 使用返回的 `NodeMatrixResponse`：
   - 将 `nodes` 按 `status` 映射为不同颜色的格子（running/to_sleep/sleeping）。
   - 与“节能策略”中的节点分布描述保持一一对应。

> 总结：**日期 → 预测曲线 → 节能策略 → 重建 node_states（后端） → 前端刷新 NodeMatrix**，形成完整闭环。

---

## 6. AI 对话流程

### 侧边栏会话管理

1. `Sidebar` 在 `useEffect` 中调用：
   - `fetchChatSessions()` 获取会话列表。
   - 首次进入页面时自动选中最新会话（除非用户已经手动点击过“新对话”）。
2. 用户点击“对话历史”下方的“新对话”按钮：
   - 将本地 `selectedSession` 设为 `null`。
   - 调用 `onSelectSession(null)`，通知 `MainPage`。
3. 用户点击某个会话卡片：
   - 更新 `selectedSession`。
   - 调用 `onSelectSession(session.id)`，通知 `MainPage`。
4. 用户在会话项右上角的删除按钮点击：
   - 弹出确认框。
   - 调用 `deleteChatSession(session.id)`。
   - 成功后重新调用 `fetchChatSessions()` 刷新列表。

### ChatContainer 加载历史

1. `MainPage` 将 `selectedSessionId` 作为 props 传给 `ChatContainer`。
2. `ChatContainer` 在 `useEffect` 中监听 `selectedSessionId`：
   - 若为 `null`：显示欢迎提示“向 HPC 能源管家 AI 助手提问”。
   - 若有值：调用 `fetchChatHistory(sessionId)` 拉取历史消息。

### 发送消息与上下文日期

1. 用户在 `ChatContainer` 输入问题并点击发送：
   - 调用：
     ```ts
     sendChatMessage(text, currentSessionId ?? undefined, contextDate);
     ```
   - 其中 `contextDate` 由 `MainPage` 传入，为当前预测曲线的 `selectedDate`。
2. 后端：
   - 根据 `session_id` 决定是否创建新会话。
   - 将用户消息写入 `chat_messages`。
   - 如果传入了 `context_date`：
     - 拉取该日期的预测 / 历史数据，生成“真实数据摘要”系统消息。
     - 与当前会话历史消息一起发送给 DeepSeek。
   - 接收 AI 回复，做格式规范化后写回 `chat_messages`。
   - 返回完整 `ChatHistoryResponse`。
3. 前端：
   - 用新的消息列表更新 `ChatContainer`。
   - 调用 `onChatUpdated()`，`MainPage` 自增 `sidebarRefreshTrigger`，让 Sidebar 刷新会话列表（更新时间和消息数）。

---

## 7. Header 与退出登录

1. `Header` 通过 `useAuth()` 获取当前用户信息。
2. 用户点击“退出登录”按钮：
   - 调用 `authLogout()`。
   - 清理本地 token（在 `AuthProvider` / `storage.ts` 内部完成）。
   - 跳转回登录页。

---

## 8. 小结

- 整个前端以 `MainPage` 为中心，通过 props 与事件回调协调各业务模块。
- 所有与后端通信的逻辑集中在 `src/api/`（便于统一维护 baseURL、鉴权和错误处理）。
- 预测曲线、节能策略、节点矩阵和 AI 对话之间通过“预测日期”和“会话 ID”两条主线串联，既保证数据一致性，也方便用户从不同角度理解同一天的运行与节能情况。
