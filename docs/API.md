# HPCIES API 文档

## 基础信息

- 基础 URL: `http://localhost:8000`
- 认证方式: Bearer Token
- 内容类型: `application/json`

## 认证接口

### 注册用户

```http
POST /api/auth/register
```

请求体：
```json
{
  "username": "string (2-64字符)",
  "password": "string (6-128字符)"
}
```

响应：
```json
{
  "success": true
}
```

### 登录

```http
POST /api/auth/login
```

请求体：
```json
{
  "username": "string",
  "password": "string"
}
```

响应：
```json
{
  "token": "string",
  "expires_at": "2025-12-03 12:00:00",
  "user": {
    "id": 1,
    "username": "test_user"
  }
}
```

### 登出

```http
POST /api/auth/logout
Authorization: Bearer {token}
```

响应：
```json
{
  "success": true
}
```

### 获取当前用户信息

```http
GET /api/auth/me
Authorization: Bearer {token}
```

响应：
```json
{
  "user": {
    "id": 1,
    "username": "test_user"
  },
  "profile": {
    "node_count": 32,
    "core_per_node": 32,
    "has_history": 1,
    "updated_at": "2025-12-02 10:00:00"
  }
}
```

## 数据管理接口

### 上传历史数据

```http
POST /api/upload-history
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

表单数据：
- `file`: CSV 文件

CSV 格式要求：
1. 格式 1（推荐）：
   - 列：日期、小时、CPU核时使用量
   - 示例：
     ```csv
     日期,小时,CPU核时使用量
     2025-12-01,0,150.5
     2025-12-01,1,145.2
     ```

2. 格式 2：
   - 第一列：时间戳
   - 第二列：负载值
   - 示例：
     ```csv
     2025-12-01 00:00:00,150.5
     2025-12-01 01:00:00,145.2
     ```

响应：
```json
{
  "success": true,
  "rows_imported": 1000,
  "estimated_nodes": 32,
  "core_per_node": 32
}
```

### 更新集群配置

```http
POST /api/config
Authorization: Bearer {token}
```

请求体：
```json
{
  "node_count": 32,
  "core_per_node": 32
}
```

响应：
```json
{
  "success": true
}
```

## 预测接口

### 获取指定日期预测

```http
GET /api/predict-date?date=2025-12-02
Authorization: Bearer {token}
```

查询参数：
- `date`: 目标日期，格式 YYYY-MM-DD（必需）
- `range`: 预测范围，可选值：今日、未来3天、未来7天（可选）

响应：
```json
{
  "date": "2025-12-02",
  "labels": ["00:00", "01:00", "02:00", ...],
  "predicted_loads": [150.5, 145.2, 140.8, ...],
  "suggested_nodes": [8, 7, 7, ...],
  "utilization": [58.5, 56.2, 54.8, ...],
  "energy_saving": [95.2, 91.5, 89.3, ...],
  "strategy": {
    "sleep_periods": "02:00-06:00, 14:00-16:00",
    "node_distribution": {
      "running": "16 个 (50%)",
      "to_sleep": "5 个 (16%)",
      "sleeping": "11 个 (34%)"
    },
    "wake_ahead": "提前 15 分钟唤醒"
  },
  "effects": {
    "saving_percent": "50.0%",
    "saving_core_hours": "384 核时/天",
    "saving_power": "~38.4 kWh/天"
  },
  "impact": {
    "delay": "< 5 分钟",
    "queue_risk": "低",
    "emergency_response": "优秀"
  }
}
```

### 单点负载预测

```http
POST /api/predict-load
Authorization: Bearer {token}
```

请求体：
```json
{
  "history_24h": [150.5, 145.2, 140.8, ...],
  "last_timestamp": "2025-12-01 23:00:00"
}
```

响应：
```json
{
  "predicted_load": 155.3,
  "suggested_nodes": 8
}
```

## 监控接口

### 获取集群统计

```http
GET /api/stats
Authorization: Bearer {token}
```

响应：
```json
{
  "today_saving_percent": null,
  "total_nodes": 32,
  "running_nodes": null,
  "today_tasks": null
}
```

### 获取节点矩阵

```http
GET /api/nodes
Authorization: Bearer {token}
```

响应：
```json
{
  "total_nodes": 32,
  "nodes": [
    {"node_id": 1, "status": "running"},
    {"node_id": 2, "status": "running"},
    {"node_id": 3, "status": "to_sleep"},
    {"node_id": 4, "status": "sleeping"}
  ]
}
```

节点状态：
- `running`: 运行中
- `to_sleep`: 待休眠
- `sleeping`: 休眠中

### 获取历史数据树

```http
GET /api/history/tree
Authorization: Bearer {token}
```

响应：
```json
{
  "years": [
    {
      "year": 2025,
      "months": [
        {
          "month": 12,
          "days": [
            {"date": "2025-12-01"},
            {"date": "2025-12-02"}
          ]
        }
      ]
    }
  ]
}
```

## 对话接口

### 获取聊天历史

```http
GET /api/chat/history
Authorization: Bearer {token}
```

响应：
```json
{
  "messages": [
    {
      "id": 1,
      "author": "user",
      "text": "今天的节能效果如何？"
    },
    {
      "id": 2,
      "author": "ai",
      "text": "Echo: 今天的节能效果如何？"
    }
  ]
}
```

### 发送消息

```http
POST /api/chat/message
Authorization: Bearer {token}
```

请求体：
```json
{
  "text": "今天的节能效果如何？"
}
```

响应：同获取聊天历史

## 错误响应

所有接口在出错时返回标准错误格式：

```json
{
  "detail": "错误描述信息"
}
```

常见状态码：
- `400`: 请求参数错误
- `401`: 未登录或登录已过期
- `403`: 无权限访问
- `404`: 资源不存在
- `409`: 资源冲突（如用户名已存在）
- `500`: 服务器内部错误
- `503`: 外部服务不可用（如 LSTM API）

## 使用示例

### Python 示例

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. 注册
response = requests.post(
    f"{BASE_URL}/api/auth/register",
    json={"username": "test_user", "password": "test123456"}
)

# 2. 登录
response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": "test_user", "password": "test123456"}
)
token = response.json()["token"]

# 3. 上传数据
headers = {"Authorization": f"Bearer {token}"}
with open("data.csv", "rb") as f:
    files = {"file": ("data.csv", f, "text/csv")}
    response = requests.post(
        f"{BASE_URL}/api/upload-history",
        files=files,
        headers=headers
    )

# 4. 获取预测
response = requests.get(
    f"{BASE_URL}/api/predict-date",
    params={"date": "2025-12-02"},
    headers=headers
)
prediction = response.json()
```

### JavaScript 示例

```javascript
const BASE_URL = "http://localhost:8000";

// 1. 注册
const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "test_user",
    password: "test123456"
  })
});

// 2. 登录
const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "test_user",
    password: "test123456"
  })
});
const { token } = await loginResponse.json();

// 3. 上传数据
const formData = new FormData();
formData.append("file", fileInput.files[0]);

const uploadResponse = await fetch(`${BASE_URL}/api/upload-history`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${token}` },
  body: formData
});

// 4. 获取预测
const predictionResponse = await fetch(
  `${BASE_URL}/api/predict-date?date=2025-12-02`,
  {
    headers: { "Authorization": `Bearer ${token}` }
  }
);
const prediction = await predictionResponse.json();
```

## 注意事项

1. Token 有效期为 24 小时，过期后需要重新登录
2. 上传的 CSV 文件需要至少包含 24 小时的数据才能进行预测
3. LSTM API 调用可能需要几秒钟，请设置合理的超时时间
4. 建议在生产环境中使用 HTTPS
5. 大文件上传建议分批处理
