# 劳动仲裁调解系统 API 文档

## 1. 认证授权 API

### 1.1 注册
- **请求方法**: POST
- **请求路径**: `/api/auth/register`
- **请求体**:
  ```json
  {
    "username": "admin",
    "password": "password123",
    "name": "Admin User",
    "phone": "13800138000",
    "email": "admin@example.com",
    "role": "admin"
  }
  ```
- **响应**:
  ```json
  {
    "message": "注册成功",
    "userId": "698894a27af852ab39e1d0ce"
  }
  ```

### 1.2 登录
- **请求方法**: POST
- **请求路径**: `/api/auth/login`
- **请求体**:
  ```json
  {
    "username": "admin",
    "password": "password123",
    "role": "admin"
  }
  ```
- **响应**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userInfo": {
      "id": "698894a27af852ab39e1d0ce",
      "username": "admin",
      "name": "Admin User",
      "phone": "13800138000",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
  ```

### 1.3 获取当前用户信息
- **请求方法**: GET
- **请求路径**: `/api/auth/me`
- **请求头**: `Authorization: Bearer <token>`
- **响应**:
  ```json
  {
    "userInfo": {
      "id": "698894a27af852ab39e1d0ce",
      "username": "admin",
      "name": "Admin User",
      "phone": "13800138000",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
  ```

### 1.4 刷新令牌
- **请求方法**: POST
- **请求路径**: `/api/auth/refresh`
- **请求头**: `Authorization: Bearer <token>`
- **响应**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

## 2. 工作台 API

### 2.1 获取工作台数据
- **请求方法**: GET
- **请求路径**: `/api/dashboard`
- **请求头**: `Authorization: Bearer <token>`
- **响应**: 工作台数据（包含统计信息和待办事项）

### 2.2 获取统计数据
- **请求方法**: GET
- **请求路径**: `/api/dashboard/stats`
- **请求头**: `Authorization: Bearer <token>`
- **响应**:
  ```json
  {
    "totalCases": 1,
    "pendingCases": 1,
    "processingCases": 0,
    "completedCases": 0,
    "failedCases": 0,
    "todayVisitors": 1
  }
  ```

### 2.3 获取待办事项
- **请求方法**: GET
- **请求路径**: `/api/dashboard/pending`
- **请求头**: `Authorization: Bearer <token>`
- **响应**: 待办事项列表

## 3. 案件管理 API

### 3.1 获取案件列表
- **请求方法**: GET
- **请求路径**: `/api/case`
- **请求头**: `Authorization: Bearer <token>`
- **查询参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `status`: 案件状态（可选）
  - `disputeType`: 纠纷类型（可选）
- **响应**:
  ```json
  {
    "cases": [
      {
        "_id": "698892cc66b1347337d1b856",
        "caseNumber": "LA20260208876",
        "applicantId": {
          "_id": "698892cc66b1347337d1b851",
          "username": "user_1770558156655",
          "name": "李四"
        },
        "respondentId": {
          "_id": "698892cc66b1347337d1b854",
          "username": "user_1770558156718_resp",
          "name": "ABC公司"
        },
        "disputeType": "工资纠纷",
        "caseAmount": 50000,
        "status": "pending",
        "createdAt": "2026-02-08T13:42:36.779Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```

### 3.2 获取案件详情
- **请求方法**: GET
- **请求路径**: `/api/case/:id`
- **请求头**: `Authorization: Bearer <token>`
- **响应**: 案件详细信息

### 3.3 创建案件
- **请求方法**: POST
- **请求路径**: `/api/case`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "respondentId": "698892cc66b1347337d1b854",
    "disputeType": "工资纠纷",
    "caseAmount": 50000,
    "requestItems": "1. 支付拖欠工资30000元\n2. 支付经济补偿金20000元",
    "factsReasons": "公司自2025年10月起开始拖欠工资，至今已拖欠3个月，多次协商无果，特申请调解。"
  }
  ```
- **响应**:
  ```json
  {
    "message": "案件创建成功",
    "caseId": "698892cc66b1347337d1b856"
  }
  ```

### 3.4 更新案件状态
- **请求方法**: PUT
- **请求路径**: `/api/case/:id/status`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "status": "processing",
    "mediatorId": "6988920666b1347337d1b836"
  }
  ```
- **响应**:
  ```json
  {
    "message": "案件状态更新成功"
  }
  ```

## 4. 到访登记 API

### 4.1 创建到访记录
- **请求方法**: POST
- **请求路径**: `/api/visitor`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "visitorName": "张三",
    "phone": "13812345678",
    "visitType": "visit",
    "disputeType": "工资纠纷",
    "reason": "公司拖欠工资3个月",
    "mediatorId": "6988920666b1347337d1b836"
  }
  ```
- **响应**:
  ```json
  {
    "message": "到访记录创建成功",
    "recordId": "6988929566b1347337d1b84d"
  }
  ```

### 4.2 获取到访记录列表
- **请求方法**: GET
- **请求路径**: `/api/visitor`
- **请求头**: `Authorization: Bearer <token>`
- **查询参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
- **响应**: 到访记录列表

### 4.3 获取今日到访记录
- **请求方法**: GET
- **请求路径**: `/api/visitor/today`
- **请求头**: `Authorization: Bearer <token>`
- **响应**:
  ```json
  {
    "records": [
      {
        "_id": "6988929566b1347337d1b84d",
        "registerNumber": "VR20260208869",
        "visitorName": "张三",
        "phone": "13812345678",
        "visitType": "visit",
        "disputeType": "工资纠纷",
        "reason": "公司拖欠工资3个月",
        "mediatorId": {
          "_id": "6988920666b1347337d1b836",
          "name": "管理员"
        },
        "createdAt": "2026-02-08T13:41:41.600Z"
      }
    ]
  }
  ```

### 4.4 获取到访记录详情
- **请求方法**: GET
- **请求路径**: `/api/visitor/:id`
- **请求头**: `Authorization: Bearer <token>`
- **响应**: 到访记录详细信息

## 5. 调解申请 API

### 5.1 创建调解申请
- **请求方法**: POST
- **请求路径**: `/api/application`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "caseId": "698892cc66b1347337d1b856",
    "mediatorId": "6988920666b1347337d1b836",
    "applicationDate": "2026-02-08T13:42:36.779Z",
    "status": "pending"
  }
  ```
- **响应**:
  ```json
  {
    "message": "调解申请创建成功",
    "applicationId": "698892cc66b1347337d1b858"
  }
  ```

### 5.2 获取调解申请列表
- **请求方法**: GET
- **请求路径**: `/api/application`
- **请求头**: `Authorization: Bearer <token>`
- **查询参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `status`: 申请状态（可选）
- **响应**: 调解申请列表

### 5.3 更新调解申请状态
- **请求方法**: PUT
- **请求路径**: `/api/application/:id/status`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "status": "accepted"
  }
  ```
- **响应**:
  ```json
  {
    "message": "调解申请状态更新成功"
  }
  ```

## 6. 广播消息 API

### 6.1 创建广播消息
- **请求方法**: POST
- **请求路径**: `/api/broadcast`
- **请求头**: `Authorization: Bearer <token>`
- **请求体**:
  ```json
  {
    "title": "系统上线通知",
    "content": "劳动仲裁调解系统已正式上线，请所有调解员和管理员熟悉系统功能，做好相关工作。",
    "type": "special",
    "urgency": "important",
    "creatorId": "6988920666b1347337d1b836"
  }
  ```
- **响应**:
  ```json
  {
    "message": "广播消息创建成功",
    "broadcastId": "698892dc66b1347337d1b85a"
  }
  ```

### 6.2 获取广播消息列表
- **请求方法**: GET
- **请求路径**: `/api/broadcast`
- **请求头**: `Authorization: Bearer <token>`
- **查询参数**:
  - `page`: 页码（默认1）
  - `limit`: 每页数量（默认10）
  - `type`: 消息类型（可选）
  - `urgency`: 紧急程度（可选）
- **响应**: 广播消息列表

### 6.3 获取最新广播消息
- **请求方法**: GET
- **请求路径**: `/api/broadcast/latest`
- **请求头**: `Authorization: Bearer <token>`
- **响应**:
  ```json
  {
    "broadcasts": [
      {
        "_id": "698892dc66b1347337d1b85a",
        "title": "系统上线通知",
        "content": "劳动仲裁调解系统已正式上线，请所有调解员和管理员熟悉系统功能，做好相关工作。",
        "type": "special",
        "urgency": "important",
        "creatorId": {
          "_id": "6988920666b1347337d1b836",
          "name": "管理员"
        },
        "createdAt": "2026-02-08T13:42:52.916Z"
      }
    ]
  }
  ```

### 6.4 获取广播消息详情
- **请求方法**: GET
- **请求路径**: `/api/broadcast/:id`
- **请求头**: `Authorization: Bearer <token>`
- **响应**: 广播消息详细信息

## 7. 公共 API

### 7.1 健康检查
- **请求方法**: GET
- **请求路径**: `/api/health`
- **响应**:
  ```json
  {
    "status": "ok"
  }
  ```

## 8. 响应状态码

- **200 OK**: 请求成功
- **201 Created**: 资源创建成功
- **400 Bad Request**: 请求参数错误
- **401 Unauthorized**: 未授权或登录失败
- **403 Forbidden**: 权限不足
- **404 Not Found**: 资源不存在
- **500 Internal Server Error**: 服务器内部错误

## 9. 认证机制

- **JWT Token**: 系统使用 JWT（JSON Web Token）进行认证
- **Token 传递**: 在请求头中使用 `Authorization: Bearer <token>` 传递
- **Token 过期**: 默认过期时间为 24 小时
- **Token 刷新**: 使用 `/api/auth/refresh` 接口刷新令牌

## 10. 角色权限

- **admin**: 管理员，拥有所有权限
- **mediator**: 调解员，可处理案件、登记到访、管理调解申请
- **personal**: 个人用户，可申请调解、查询案件
- **company**: 企业用户，可申请调解、查询案件

## 11. 接口速率限制

- **默认限制**: 每IP每分钟60个请求
- **认证用户**: 每用户每分钟120个请求
- **特殊接口**: 登录、注册接口每IP每分钟10个请求

## 12. 数据安全

- **密码加密**: 使用 bcryptjs 对密码进行加密存储
- **HTTPS**: 生产环境强制使用 HTTPS
- **输入验证**: 使用 express-validator 对所有输入进行验证
- **XSS 防护**: 对用户输入进行 XSS 防护
- **CSRF 防护**: 实现 CSRF 令牌验证

## 13. 错误处理

- **统一错误响应格式**:
  ```json
  {
    "message": "错误信息"
  }
  ```
- **详细错误日志**: 服务器端记录详细错误日志
- **友好错误提示**: 向客户端返回友好的错误提示

## 14. 版本控制

- **API 版本**: 当前版本为 v1
- **版本管理**: 计划通过 URL 路径进行版本管理，如 `/api/v2/auth/login`
- **向后兼容**: 确保 API 变更向后兼容

## 15. 接口测试

- **测试工具**: 推荐使用 Postman 或 curl 进行测试
- **测试环境**: `http://localhost:5002/api`
- **生产环境**: `https://api.example.com/api`

## 16. 最佳实践

- **使用 HTTPS**: 生产环境必须使用 HTTPS
- **设置合理的超时时间**: 建议设置 30 秒超时
- **实现重试机制**: 对网络错误实现自动重试
- **缓存频繁请求的数据**: 使用 Redis 缓存热点数据
- **监控 API 性能**: 定期监控 API 响应时间和错误率
