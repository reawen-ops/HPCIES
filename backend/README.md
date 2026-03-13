# HPCIES Backend

HPC 智能节能调度系统后端服务

## 技术栈

- FastAPI 0.128.0
- SQLite 数据库
- Pydantic 数据验证
- Pandas 数据处理
- Requests HTTP 客户端

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并根据需要修改：

```bash
cp .env.example .env
```

主要配置项：
- `LSTM_API_URL`: LSTM 预测 API 地址
- `CORS_ORIGINS`: 允许的前端域名（逗号分隔）

### 3. 启动服务

```bash
cd src
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务将在 `http://localhost:8000` 启动

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── middleware/      # 中间件
│   │   │   └── routes/          # API 路由
│   │   │       ├── auth.py      # 认证相关
│   │   │       └── others.py    # 其他业务接口
│   │   ├── core/
│   │   │   ├── config.py        # 配置管理
│   │   │   └── db.py            # 数据库连接
│   │   ├── crud/                # 数据库操作
│   │   ├── models/              # 数据模型
│   │   ├── schemas/             # Pydantic 模型
│   │   ├── services/            # 业务逻辑
│   │   │   └── lstm_service.py  # LSTM API 调用
│   │   └── utils/               # 工具函数
│   │       └── security.py      # 安全相关
│   ├── main.py                  # 应用入口
│   └── hpcies.sqlite3           # SQLite 数据库
├── requirements.txt             # Python 依赖
└── .env.example                 # 环境变量示例
```

## 核心功能

### 1. 用户认证

- 注册：`POST /api/auth/register`
- 登录：`POST /api/auth/login`
- 登出：`POST /api/auth/logout`
- 获取用户信息：`GET /api/auth/me`

### 2. 数据管理

- 上传历史数据：`POST /api/upload-history`
  - 支持 CSV 格式
  - 自动推断集群配置
  - 格式 1：日期、小时、CPU核时使用量
  - 格式 2：时间戳、负载值

### 3. 预测功能

- 获取指定日期预测：`GET /api/predict-date?date=YYYY-MM-DD`
  - 调用 LSTM API 获取 24 小时预测
  - 计算节能模式曲线
  - 生成节能策略建议
  - 评估节能效果和任务影响

- 单点预测：`POST /api/predict-load`
  - 基于前 24 小时数据预测下一小时

### 4. 集群监控

- 获取统计信息：`GET /api/stats`
- 获取节点矩阵：`GET /api/nodes`
- 获取历史数据树：`GET /api/history/tree`

### 5. AI 对话

- 获取聊天历史：`GET /api/chat/history`
- 发送消息：`POST /api/chat/message`

## LSTM API 集成

系统集成了外部 LSTM 预测服务，用于负载预测。

### API 请求格式

```json
{
  "history_24h": [10.5, 12.3, 8.7, ...],
  "last_timestamp": "2025-12-01 23:00:00",
  "predict_hours": 24
}
```

### API 响应格式

```json
{
  "predictions": [
    {
      "timestamp": "2025-12-02 00:00:00",
      "predicted_load": 15.6,
      "suggested_nodes": 8
    },
    ...
  ]
}
```

### 错误处理

- 超时：30 秒后返回降级结果（简单平均）
- 连接失败：返回 503 错误
- 响应格式错误：返回 503 错误

## 测试

当前仓库未内置自动化测试用例（如需添加，可使用 `pytest`/前端测试框架自行扩展）。

## 数据库

使用 SQLite 数据库，主要表结构：

- `users`: 用户信息
- `sessions`: 会话管理
- `user_profile`: 用户配置
- `historical_usage`: 历史使用数据
- `node_states`: 节点状态
- `chat_messages`: 聊天记录
- `cluster_stats`: 集群统计
- `prediction_points`: 预测数据点

## 安全性

- 密码使用 PBKDF2-SHA256 哈希存储
- Session token 24 小时过期
- CORS 配置可限制访问来源
- SQL 注入防护（参数化查询）

## 开发建议

1. 生产环境务必修改 `CORS_ORIGINS` 限制访问来源
2. 定期清理过期 session
3. 考虑添加 Redis 缓存预测结果
4. 监控 LSTM API 调用频率和响应时间
5. 添加日志记录和错误追踪

## 常见问题

### Q: LSTM API 调用失败怎么办？

A: 系统会自动降级到简单平均算法，确保基本功能可用。检查：
- 网络连接是否正常
- API URL 是否正确
- API 服务是否在线

### Q: 上传 CSV 失败？

A: 检查 CSV 格式：
- 编码为 UTF-8
- 包含必需的列（日期、小时、CPU核时使用量）
- 数据类型正确（数值列不含非数字字符）

### Q: 预测数据不准确？

A: 可能原因：
- 历史数据不足（需要至少 24 小时）
- 历史数据质量差（缺失值、异常值）
- LSTM 模型需要重新训练

## 许可证

MIT License
