# 劳动仲裁调解系统API服务分析

## 1. 页面与API服务对应关系

### 1.1 Dashboard (工作台)
- **API服务**：
  - `GET /api/dashboard` - 获取工作台数据（统计数据、待办案件、通知）
  - `GET /api/broadcast/latest` - 获取最新广播
- **对应数据表**：
  - `Case` - 案件表
  - `VisitorRecord` - 到访登记表
  - `Broadcast` - 广播表
  - `Schedule` - 日程表
  - `Message` - 消息表
- **访问情况**：需要认证

### 1.2 CaseQuery (案件查询)
- **API服务**：
  - `GET /api/case` - 获取案件列表（支持关键词搜索）
  - `POST /api/case/:id/progress` - 提交调解员留言
- **对应数据表**：
  - `Case` - 案件表
  - `CaseProgress` - 案件进度表
- **访问情况**：需要认证

### 1.3 CaseApply (申请调解)
- **API服务**：
  - `POST /api/application` - 提交调解申请
- **对应数据表**：
  - `Application` - 申请表
  - `Case` - 案件表（申请成功后创建）
- **访问情况**：需要认证，仅限个人、企业和管理员

### 1.4 Broadcast (站内广播)
- **API服务**：
  - `GET /api/broadcast` - 获取广播列表
  - `GET /api/broadcast/latest` - 获取最新广播
  - `GET /api/broadcast/:id` - 获取广播详情
  - `POST /api/broadcast` - 发布广播（仅限调解员和管理员）
- **对应数据表**：
  - `Broadcast` - 广播表
- **访问情况**：获取需要认证，发布仅限调解员和管理员

### 1.5 UserManagement (用户管理)
- **API服务**：
  - `GET /api/user` - 获取用户列表（仅限管理员）
  - `POST /api/user` - 创建用户（仅限管理员）
  - `PUT /api/user/:id` - 更新用户信息（仅限管理员）
  - `DELETE /api/user/:id` - 删除用户（仅限管理员）
- **对应数据表**：
  - `User` - 用户表
- **访问情况**：仅限管理员

### 1.6 VisitorRegister (到访登记)
- **API服务**：
  - `POST /api/visitor` - 创建到访登记
  - `GET /api/visitor` - 获取到访登记列表
- **对应数据表**：
  - `VisitorRecord` - 到访登记表
- **访问情况**：需要认证，创建仅限调解员和管理员

### 1.7 DataAnalysis (数据分析)
- **API服务**：
  - `GET /api/dashboard/case-trend` - 获取案件趋势数据
  - `GET /api/dashboard/case-type` - 获取案件类型分布数据
  - `GET /api/dashboard/visitor-trend` - 获取访客趋势数据
- **对应数据表**：
  - `Case` - 案件表
  - `VisitorRecord` - 到访登记表
- **访问情况**：需要认证

### 1.8 MessageCenter (消息中心)
- **API服务**：
  - `GET /api/message` - 获取消息列表
  - `PUT /api/message/:id/read` - 标记消息为已读
- **对应数据表**：
  - `Message` - 消息表
- **访问情况**：需要认证

### 1.9 ScheduleManagement (日程管理)
- **API服务**：
  - `GET /api/case/:id/schedule` - 获取案件日程
  - `POST /api/case/:id/schedule` - 添加案件日程（仅限调解员和管理员）
  - `PUT /api/case/:id/schedule/:scheduleId` - 更新案件日程（仅限调解员和管理员）
  - `DELETE /api/case/:id/schedule/:scheduleId` - 删除案件日程（仅限调解员和管理员）
- **对应数据表**：
  - `Schedule` - 日程表
- **访问情况**：获取需要认证，修改仅限调解员和管理员

### 1.10 SystemSettings (系统设置)
- **API服务**：
  - `GET /api/system-settings` - 获取系统设置
  - `PUT /api/system-settings` - 更新系统设置（仅限管理员）
- **对应数据表**：
  - `SystemSettings` - 系统设置表
- **访问情况**：获取需要认证，修改仅限管理员

## 2. API服务访问情况

| API路径 | 方法 | 功能 | 访问权限 | 对应页面 |
|---------|------|------|----------|----------|
| `/api/dashboard` | GET | 获取工作台数据 | 需要认证 | Dashboard |
| `/api/broadcast/latest` | GET | 获取最新广播 | 需要认证 | Dashboard |
| `/api/case` | GET | 获取案件列表 | 需要认证 | CaseQuery |
| `/api/case/:id/progress` | POST | 提交调解员留言 | 需要认证 | CaseQuery |
| `/api/application` | POST | 提交调解申请 | 个人/企业/管理员 | CaseApply |
| `/api/broadcast` | GET | 获取广播列表 | 需要认证 | Broadcast |
| `/api/broadcast` | POST | 发布广播 | 调解员/管理员 | Broadcast |
| `/api/broadcast/:id` | GET | 获取广播详情 | 需要认证 | Broadcast |
| `/api/user` | GET | 获取用户列表 | 管理员 | UserManagement |
| `/api/user` | POST | 创建用户 | 管理员 | UserManagement |
| `/api/user/:id` | PUT | 更新用户信息 | 管理员 | UserManagement |
| `/api/user/:id` | DELETE | 删除用户 | 管理员 | UserManagement |
| `/api/visitor` | POST | 创建到访登记 | 调解员/管理员 | VisitorRegister |
| `/api/visitor` | GET | 获取到访登记列表 | 需要认证 | VisitorRegister |
| `/api/dashboard/case-trend` | GET | 获取案件趋势数据 | 需要认证 | DataAnalysis |
| `/api/dashboard/case-type` | GET | 获取案件类型分布数据 | 需要认证 | DataAnalysis |
| `/api/dashboard/visitor-trend` | GET | 获取访客趋势数据 | 需要认证 | DataAnalysis |
| `/api/message` | GET | 获取消息列表 | 需要认证 | MessageCenter |
| `/api/message/:id/read` | PUT | 标记消息为已读 | 需要认证 | MessageCenter |
| `/api/case/:id/schedule` | GET | 获取案件日程 | 需要认证 | ScheduleManagement |
| `/api/case/:id/schedule` | POST | 添加案件日程 | 调解员/管理员 | ScheduleManagement |
| `/api/case/:id/schedule/:scheduleId` | PUT | 更新案件日程 | 调解员/管理员 | ScheduleManagement |
| `/api/case/:id/schedule/:scheduleId` | DELETE | 删除案件日程 | 调解员/管理员 | ScheduleManagement |
| `/api/system-settings` | GET | 获取系统设置 | 需要认证 | SystemSettings |
| `/api/system-settings` | PUT | 更新系统设置 | 管理员 | SystemSettings |

## 3. 数据表与页面对应关系

| 数据表 | 存储内容 | 对应页面 | 相关API |
|--------|----------|----------|---------|
| `Case` | 案件信息 | Dashboard, CaseQuery, DataAnalysis | `/api/case`, `/api/dashboard` |
| `User` | 用户信息 | UserManagement | `/api/user` |
| `VisitorRecord` | 到访登记信息 | VisitorRegister, Dashboard | `/api/visitor`, `/api/dashboard` |
| `Broadcast` | 广播信息 | Dashboard, Broadcast | `/api/broadcast` |
| `Message` | 消息信息 | MessageCenter | `/api/message` |
| `Schedule` | 日程信息 | ScheduleManagement, Dashboard | `/api/case/:id/schedule` |
| `Application` | 调解申请信息 | CaseApply | `/api/application` |
| `CaseProgress` | 案件进度信息 | CaseQuery | `/api/case/:id/progress` |
| `SystemSettings` | 系统设置信息 | SystemSettings | `/api/system-settings` |

## 4. 可视化建议

### 4.1 建议可视化的内容

1. **系统架构图**：
   - 前端页面与后端API的对应关系
   - API服务与数据表的对应关系
   - 数据流方向

2. **API调用流程图**：
   - 每个页面的API调用顺序
   - 权限验证流程
   - 数据处理流程

3. **数据表关系图**：
   - 各数据表之间的关联关系
   - 字段结构
   - 数据流向

4. **访问权限矩阵**：
   - 不同角色对各API的访问权限
   - 权限验证流程

### 4.2 可视化工具建议

1. **架构图**：使用 Draw.io、Lucidchart 或 Mermaid
2. **流程图**：使用 Draw.io、Lucidchart 或 Mermaid
3. **数据表关系图**：使用 DB Diagram、Lucidchart 或 Mermaid
4. **访问权限矩阵**：使用 Excel、Google Sheets 或 Markdown 表格

### 4.3 可视化的好处

1. **提高开发效率**：开发人员可以快速了解系统架构和数据流
2. **便于维护**：管理人员可以清晰了解系统的整体结构
3. **降低学习成本**：新成员可以快速熟悉系统
4. **发现潜在问题**：通过可视化可以发现系统中的潜在问题和优化空间

## 5. 结论

劳动仲裁调解系统的API服务和页面结构已经相对完善，通过可视化这些信息，可以帮助开发团队更好地理解和维护系统。建议创建系统架构图、API调用流程图、数据表关系图和访问权限矩阵，以便更清晰地展示系统的整体结构和数据流。