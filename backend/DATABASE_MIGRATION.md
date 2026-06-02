# 数据库迁移说明

本文档说明了如何将系统从 MongoDB 迁移到 MySQL，以及如何初始化和管理 MySQL 数据库。

## 📋 迁移概述

- **源数据库**: MongoDB
- **目标数据库**: MySQL 8.0+
- **迁移内容**: 13个核心表的所有数据
- **保留的功能**: 所有业务功能、Socket.IO实时通信

## 🚀 快速开始

### 1. 环境要求

- Node.js 16+
- MySQL 8.0+
- TypeScript 5.0+

### 2. 配置环境变量

在 `backend/.env` 文件中配置 MySQL 连接：

```env
# MySQL 数据库配置
MYSQL_HOST=152.136.175.14
MYSQL_PORT=3306
MYSQL_USER=newuser
MYSQL_PASSWORD=StrongPassword123!
MYSQL_DATABASE=laodongzhongcai

# MongoDB (可选，仅用于数据迁移)
MONGODB_URI=mongodb://127.0.0.1:27017/laodong
```

### 3. 安装依赖

```bash
cd backend
npm install
```

## 🛠️ 数据库初始化

### 全新安装（初始化空数据库）

如果您是第一次部署，使用以下命令初始化数据库：

```bash
cd backend
npm run db:init
```

这个命令会：
1. 创建 MySQL 数据库（如果不存在）
2. 创建所有表结构
3. 插入初始数据（默认账户和示例数据）

#### 默认账户信息

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123 | 系统管理员 |
| 调解员 | mediator | mediator123 | 调解员账户 |
| 个人用户 | user1 | 123456 | 示例个人用户 |
| 企业用户 | company1 | 123456 | 示例企业用户 |

## 🔄 从 MongoDB 迁移数据

如果您已有 MongoDB 中的数据需要迁移，请按以下步骤操作：

### 1. 确保 MongoDB 服务运行

确保您的 MongoDB 服务正在运行，并且可以连接。

### 2. 执行迁移脚本

```bash
cd backend
npm run db:migrate
```

迁移脚本会：
1. 连接到 MongoDB
2. 读取所有现有数据
3. 清空 MySQL 中的现有数据（⚠️ 注意：会删除MySQL中的数据）
4. 将 MongoDB 数据转换并插入 MySQL
5. 显示迁移统计信息

### 3. 验证数据迁移

迁移完成后，您可以：
1. 启动后端服务：`npm run dev`
2. 登录系统验证数据是否正确
3. 测试各项功能是否正常

## 📊 数据库表结构

系统包含以下13个核心表：

| 表名 | 说明 |
|------|------|
| users | 用户表（管理员、调解员、个人、企业） |
| cases | 案件表 |
| visitor_records | 访客登记表 |
| case_progress | 案件进度表 |
| evidences | 证据表 |
| broadcasts | 广播通知表 |
| messages | 消息表 |
| notifications | 通知表 |
| schedules | 日程表 |
| reminder_settings | 提醒设置表 |
| system_settings | 系统设置表 |
| analytics_events | 分析事件表 |
| ai_usages | AI使用记录表 |

详细表结构请参考：`src/scripts/create_tables.sql`

## 🧪 测试数据库连接

您可以通过以下方式测试数据库连接：

### 方式1：启动服务

```bash
cd backend
npm run dev
```

查看日志确认数据库连接是否成功。

### 方式2：使用服务状态API

启动服务后，访问：
```
GET /api/services/status
```

查看MySQL连接状态。

## 🔧 常见问题

### 问题1：连接MySQL失败

**错误信息**: `Access denied for user 'xxx'@'xxx'`

**解决方法**: 
1. 检查 .env 文件中的 MySQL 用户名和密码
2. 验证 MySQL 用户是否有创建数据库的权限
3. 确认 MySQL 服务正在运行

### 问题2：表已存在

**错误信息**: `Table 'xxx' already exists`

**解决方法**:
1. 如果是全新安装，可以删除数据库重新初始化
2. 或者使用 `db:init` 脚本（它使用 `CREATE TABLE IF NOT EXISTS`）

### 问题3：数据迁移后登录失败

**原因**: MongoDB 的密码哈希格式可能与新系统不兼容

**解决方法**:
1. 使用默认管理员账户重新登录
2. 或者手动重置用户密码

### 问题4：端口被占用

确保没有其他程序占用 3306 端口（MySQL默认端口）或 5003 端口（后端服务端口）。

## 📝 备份和恢复

### 备份 MySQL 数据库

```bash
mysqldump -u newuser -p laodongzhongcai > backup_$(date +%Y%m%d).sql
```

### 恢复 MySQL 数据库

```bash
mysql -u newuser -p laodongzhongcai < backup_20240101.sql
```

## 🎯 下一步

数据库初始化或迁移完成后，您可以：

1. 启动后端服务：`npm run dev`
2. 构建前端：进入 frontend 目录，运行 `npm run build`
3. 部署到生产环境

## 📞 技术支持

如遇到问题，请检查：
1. 后端服务日志
2. MySQL 错误日志
3. 环境变量配置是否正确

---

**最后更新**: 2026-06-02
**版本**: 2.0 (MySQL Migration)
