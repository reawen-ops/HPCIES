# HPCIES - HPC 智能节能调度系统

一个基于 React + TypeScript + Vite + Python FastAPI + SQLite 的现代化 HPC（高性能计算）集群智能节能调度系统前端应用。

## 📋 项目简介

HPCIES（HPC Intelligent Energy Saving）是一个智能化的高性能计算集群能源管理系统，旨在通过 AI 预测和智能调度策略，优化 HPC 集群的能源消耗，在保证任务执行效率的同时实现节能减排。

### 核心功能

- 🎯 **智能预测**：基于历史数据的核使用率预测曲线
- 📊 **实时监控**：节点状态矩阵可视化展示
- 💬 **AI 助手**：智能对话系统，提供节能建议
- 📈 **统计分析**：节能效果和任务影响分析
- ⚙️ **策略配置**：灵活的节能策略配置和管理

## 🛠️ 技术栈

### 前端技术栈

- **框架**: React 19.2.0
- **语言**: TypeScript 5.9.3
- **构建工具**: Vite 7.2.4
- **路由**: React Router DOM 7.13.0
- **样式**: SCSS/SASS 1.97.3
- **HTTP 客户端**: Axios 1.13.4
- **图标**: React Icons 5.5.0

### 后端技术栈

- **框架**: Python FastAPI
- **数据库**: SQLite
- **API**: RESTful API

## 📁 项目结构

```
frontend/
├── public/                 # 静态资源
│   └── ies.svg
├── src/
│   ├── api/               # API 相关
│   │   ├── endpoints/     # API 端点定义
│   │   ├── hooks/         # API Hooks
│   │   └── index.ts       # API 入口
│   ├── assets/            # 静态资源
│   │   ├── images/        # 图片资源
│   │   └── styles/        # 全局样式
│   │       ├── _variables.scss    # SCSS 变量
│   │       ├── _mixins.scss       # SCSS Mixins
│   │       ├── _functions.scss    # SCSS 函数
│   │       └── index.scss         # 样式入口
│   ├── components/        # React 组件
│   │   ├── common/        # 通用组件
│   │   │   ├── ChatContainer/    # 聊天容器
│   │   │   └── StatisticsInfo/    # 统计信息
│   │   ├── features/      # 功能组件
│   │   │   └── Welcome/          # 欢迎引导
│   │   ├── forms/         # 表单组件
│   │   │   ├── LoginForm/        # 登录表单
│   │   │   └── RegisterForm/     # 注册表单
│   │   ├── layout/        # 布局组件
│   │   │   ├── Header/           # 头部导航
│   │   │   ├── Sidebar/          # 侧边栏
│   │   │   └── Scroll/           # 滚动面板
│   │   └── ui/            # UI 组件
│   │       ├── Button/           # 按钮组件
│   │       ├── Card/             # 卡片组件
│   │       └── Chart/            # 图表组件
│   │           ├── NodeMatrix/           # 节点矩阵
│   │           └── PredictionChart/      # 预测曲线
│   ├── hooks/             # 自定义 Hooks
│   ├── pages/             # 页面组件
│   │   ├── Home/          # 主页
│   │   ├── Login/         # 登录页
│   │   └── Register/     # 注册页
│   ├── router/            # 路由配置
│   ├── store/             # 状态管理
│   ├── utils/             # 工具函数
│   ├── App.tsx            # 根组件
│   ├── App.css            # 全局样式
│   ├── index.css          # 入口样式
│   └── main.tsx           # 应用入口
├── tests/                 # 测试文件
├── .gitignore
├── eslint.config.js       # ESLint 配置
├── package.json
├── tsconfig.json          # TypeScript 配置
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts         # Vite 配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

### 代码检查

```bash
npm run lint
```

## 🎨 样式系统

项目采用 **SCSS Modules** 进行样式管理，充分利用 SCSS 的特性：

### SCSS 特性使用

- ✅ **变量系统** (`_variables.scss`): 统一的颜色、间距、字体等变量
- ✅ **Mixins** (`_mixins.scss`): 可复用的样式片段
  - Flexbox 工具类 (`flex-center`, `flex-between`, `flex-column`)
  - 卡片样式 (`card`, `card-hover`)
  - 按钮样式 (`button-base`, `button-primary`, `button-secondary`)
  - 表单控件 (`form-control`, `form-label`)
  - 响应式断点 (`respond-to`, `respond-above`)
  - 工具类 (`text-truncate`, `custom-scrollbar`)
- ✅ **嵌套语法**: 充分利用 SCSS 嵌套特性
- ✅ **函数** (`_functions.scss`): 颜色处理、间距计算等工具函数
- ✅ **响应式设计**: 使用 mixins 实现统一的响应式断点

### 样式文件命名规范

- 组件样式文件使用 `[ComponentName].module.scss` 命名
- 全局样式文件使用 `_` 前缀（如 `_variables.scss`）表示部分文件
- 样式入口文件使用 `index.scss`

### 使用示例

```scss
// 组件样式文件示例
@use "../../../assets/styles" as *;

.my-component {
  @include card;
  padding: $spacing-xl;

  &-title {
    font-size: $font-size-lg;
    color: $primary-dark;
  }

  @include respond-to(sm) {
    padding: $spacing-md;
  }
}
```

## 📱 响应式设计

项目采用移动优先的响应式设计策略，支持以下断点：

- **xs**: ≤ 480px
- **sm**: ≤ 768px
- **md**: ≤ 992px
- **lg**: ≤ 1200px
- **xl**: ≤ 1440px

使用 `respond-to()` mixin 实现响应式样式：

```scss
.component {
  width: 100%;

  @include respond-to(md) {
    width: 50%;
  }
}
```

## 🔧 开发指南

### 添加新组件

1. 在 `src/components/` 下创建组件目录
2. 创建 `[ComponentName].tsx` 和 `[ComponentName].module.scss`
3. 在 SCSS 文件中导入样式系统：`@use '../../../assets/styles' as *;`
4. 使用 mixins 和变量编写样式

### 添加新页面

1. 在 `src/pages/` 下创建页面目录
2. 创建页面组件和样式文件
3. 在 `src/router/` 中添加路由配置
4. 在 `src/App.tsx` 中注册路由

### API 集成

1. 在 `src/api/endpoints/` 中定义 API 端点
2. 在 `src/api/hooks/` 中创建自定义 Hooks
3. 在组件中使用 Hooks 调用 API

### 状态管理

项目预留了 `src/store/` 目录用于状态管理，可根据需要集成 Redux、Zustand 等状态管理库。

## 📦 构建和部署

### 构建配置

构建配置位于 `vite.config.ts`，可根据需要调整：

- 输出目录
- 公共路径
- 环境变量
- 代理配置

### 环境变量

创建 `.env` 文件定义环境变量：

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=HPCIES
```

### 部署

1. 运行 `npm run build` 构建项目
2. 将 `dist/` 目录部署到静态文件服务器
3. 配置服务器支持 SPA 路由（所有路由重定向到 `index.html`）

## 🧪 测试

测试文件位于 `tests/` 目录，可根据需要添加单元测试和集成测试。

## 📝 代码规范

- 使用 ESLint 进行代码检查
- 遵循 TypeScript 严格模式
- 组件使用函数式组件和 Hooks
- 样式使用 SCSS Modules
- 文件命名使用 PascalCase（组件）和 kebab-case（文件）

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 👥 作者

HPCIES 开发团队

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和用户。

---

**注意**: 本项目是 HPCIES 系统的前端部分，需要配合后端 API 服务使用。请确保后端服务已正确配置并运行。
