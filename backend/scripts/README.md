# 备份脚本使用文档

## 概述

本脚本用于执行系统数据备份和表结构导出操作，支持通过API调用或直接执行命令行工具进行备份。

## 目录结构

```
backend/
├── scripts/
│   ├── backup.js          # 备份脚本
│   └── README.md          # 本文档
├── backups/               # 备份文件存储目录
│   ├── schemas/           # 表结构备份
│   ├── data/              # 数据库备份
│   └── redis/             # Redis备份
```

## 使用方法

### 查看帮助信息

```bash
npm run backup
```

### 导出表结构

```bash
npm run backup export-schema
```

**功能**：导出数据库表结构到JSON文件

**输出**：
- 表结构文件存储在 `backups/schemas/` 目录
- 文件名格式：`schema_YYYY-MM-DD.json`

### 备份数据库

```bash
npm run backup backup-database
```

**功能**：备份MongoDB数据库到压缩文件

**输出**：
- 数据库备份文件存储在 `backups/data/` 目录
- 文件名格式：`backup_YYYY-MM-DD_TIMESTAMP.gz`

### 备份Redis

```bash
npm run backup backup-redis
```

**功能**：备份Redis数据到RDB文件

**输出**：
- Redis备份文件存储在 `backups/redis/` 目录
- 文件名格式：`redis_backup_YYYY-MM-DD_TIMESTAMP.rdb`

### 执行所有备份操作

```bash
npm run backup backup-all
```

**功能**：依次执行表结构导出、数据库备份和Redis备份

### 列出所有备份文件

```bash
npm run backup list-backups
```

**功能**：显示所有备份文件的列表，包括文件大小和创建时间

## 工作原理

1. **API调用**：首先尝试通过API调用执行备份操作
2. **命令行工具**：如果API调用失败，尝试直接执行命令行工具
3. **容错机制**：即使API服务不可用，也能通过命令行工具完成备份

## 环境配置

脚本从 `.env` 文件加载以下配置：

- `PORT`：后端服务端口（默认：5002）
- `MONGO_URI`：MongoDB连接字符串
- `REDIS_URI`：Redis连接字符串
- `AUTH_TOKEN`：API认证令牌（可选）

## 注意事项

1. **权限要求**：执行脚本需要有足够的权限访问数据库和文件系统
2. **存储空间**：确保备份目录有足够的存储空间
3. **备份周期**：建议定期执行备份操作，特别是在系统更新前
4. **备份保留**：定期清理过期的备份文件，避免占用过多存储空间
5. **恢复测试**：定期测试备份文件的恢复能力，确保备份的可靠性

## 故障排除

### API调用失败

如果API调用失败，脚本会尝试直接执行命令行工具。常见原因：

- 后端服务未运行
- 认证令牌无效
- API接口变更

### 命令行工具失败

如果命令行工具执行失败，常见原因：

- MongoDB或Redis未安装
- 命令行工具路径未添加到环境变量
- 数据库连接配置错误

### 权限错误

如果出现权限错误，尝试以管理员权限运行脚本：

```bash
sudo npm run backup [command]
```

## 示例输出

### 导出表结构

```
正在导出表结构...
表结构导出成功!
导出文件: /path/to/backend/backups/schemas/schema_2026-03-16.json
导出时间: 2026-03-16T12:00:00.000Z
```

### 备份数据库

```
正在备份数据库...
数据库备份成功!
备份文件: /path/to/backend/backups/data/backup_2026-03-16_1234567890.gz
文件大小: 10.24 MB
备份时间: 2026-03-16T12:00:00.000Z
```

### 列出备份文件

```
备份文件列表:
================================================================================

SCHEMAS 备份:
----------------------------------------
  schema_2026-03-16.json (0.01 MB) - 2026-03-16 12:00:00

DATA 备份:
----------------------------------------
  backup_2026-03-16_1234567890.gz (10.24 MB) - 2026-03-16 12:00:00

REDIS 备份:
----------------------------------------
  redis_backup_2026-03-16_1234567890.rdb (0.50 MB) - 2026-03-16 12:00:00

================================================================================
```

## 自动化备份

可以通过crontab设置定时执行备份脚本：

```bash
# 每天凌晨2点执行全量备份
0 2 * * * cd /path/to/backend && npm run backup backup-all >> /path/to/backup.log 2>&1

# 每周日凌晨3点执行表结构导出
0 3 * * 0 cd /path/to/backend && npm run backup export-schema >> /path/to/backup.log 2>&1
```

## 恢复数据

### 从数据库备份恢复

```bash
# 恢复数据库
mongorestore --uri="mongodb://localhost:27017/labor-arbitration" --gzip --archive=/path/to/backup.gz
```

### 从Redis备份恢复

```bash
# 停止Redis服务
sudo service redis stop

# 复制RDB文件到Redis数据目录
sudo cp /path/to/redis_backup.rdb /var/lib/redis/dump.rdb

# 启动Redis服务
sudo service redis start
```