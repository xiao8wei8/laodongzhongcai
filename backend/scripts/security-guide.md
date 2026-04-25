# MongoDB 权限控制和日志监控配置指南

## 3. 权限控制

### 3.1 最小权限原则

**步骤1：创建专用数据库用户**

```bash
# 1. 连接到MongoDB
mongosh

# 2. 切换到admin数据库
use admin

# 3. 创建管理员用户
db.createUser({
  user: "admin",
  pwd: "your_admin_password",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})

# 4. 创建应用专用用户（只读权限）
db.createUser({
  user: "laodong_read",
  pwd: "your_read_password",
  roles: [
    { role: "read", db: "laodong" }
  ]
})

# 5. 创建应用专用用户（读写权限）
db.createUser({
  user: "laodong_write",
  pwd: "your_write_password",
  roles: [
    { role: "readWrite", db: "laodong" }
  ]
})
```

**步骤2：启用认证**

```bash
# 1. 编辑MongoDB配置文件
sudo nano /etc/mongod.conf

# 2. 添加认证配置
security:
  authorization: enabled

# 3. 重启MongoDB
sudo systemctl restart mongod
```

### 3.2 禁用危险操作

**方法1：使用角色权限限制**

```bash
# 只授予必要的权限，不授予dbOwner或root等高级权限
db.createUser({
  user: "app_user",
  pwd: "your_password",
  roles: [
    { role: "readWrite", db: "laodong" }
  ]
})
```

**方法2：使用MongoDB审计**

```bash
# 1. 编辑MongoDB配置文件
sudo nano /etc/mongod.conf

# 2. 添加审计配置
auditLog:
  destination: file
  path: /var/log/mongodb/audit.log
  format: JSON

# 3. 重启MongoDB
sudo systemctl restart mongod
```

### 3.3 用户管理

**定期检查用户权限**

```bash
# 1. 连接到MongoDB（带认证）
mongosh -u admin -p your_admin_password --authenticationDatabase admin

# 2. 查看所有用户
db.adminCommand({ usersInfo: 1 })

# 3. 查看特定数据库的用户
use laodong
db.getUsers()

# 4. 更新用户密码
db.updateUser("laodong_write", {
  pwd: "new_password"
})

# 5. 撤销权限
db.revokeRolesFromUser("laodong_write", [
  { role: "readWrite", db: "laodong" }
])

# 6. 授予权限
db.grantRolesToUser("laodong_write", [
  { role: "readWrite", db: "laodong" }
])
```

## 4. 日志监控

### 4.1 监控MongoDB日志中的删除操作

**方法1：实时监控**

```bash
# 实时监控删除操作
sudo tail -f /var/log/mongodb/mongod.log | grep -i "drop\|delete\|remove"
```

**方法2：定期检查**

```bash
# 创建监控脚本
sudo nano /root/laodongzhongcai/backend/scripts/monitor-delete-operations.sh
```

**脚本内容：**

```bash
#!/bin/bash
# 监控MongoDB删除操作

LOG_FILE="/var/log/mongodb/mongod.log"
ALERT_FILE="/root/laodongzhongcai/backups/delete_operations.log"

# 查找删除操作
echo "=========================================" >> $ALERT_FILE
echo "删除操作监控 - $(date '+%Y-%m-%d %H:%M:%S')" >> $ALERT_FILE
echo "=========================================" >> $ALERT_FILE

# 搜索删除相关操作
grep -i "drop\|delete\|remove\|dropDatabase" $LOG_FILE | tail -50 >> $ALERT_FILE

# 检查是否有异常删除
DELETE_COUNT=$(grep -i "drop\|delete\|remove" $LOG_FILE | wc -l)
if [ $DELETE_COUNT -gt 5 ]; then
    echo "警告：发现大量删除操作（$DELETE_COUNT次）" >> $ALERT_FILE
    # 这里可以添加邮件告警
fi

echo "=========================================" >> $ALERT_FILE
```

**设置定时任务：**

```bash
# 添加到crontab
crontab -e

# 每小时检查一次
0 * * * * /root/laodongzhongcai/backend/scripts/monitor-delete-operations.sh
```

### 4.2 监控数据量变化

**使用之前创建的check-data-count.sh脚本**

```bash
# 查看数据量变化日志
tail -f /root/laodongzhongcai/backups/data_check.log
```

## 5. 完整的安全配置

**建议的MongoDB配置文件：**

```yaml
# mongod.conf

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

storage:
  dbPath: /var/lib/mongo
  journal:
    enabled: true

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: 27017
  bindIp: 127.0.0.1,152.136.175.14

security:
  authorization: enabled

auditLog:
  destination: file
  path: /var/log/mongodb/audit.log
  format: JSON
```

## 6. 实施步骤

1. **创建用户**：按照步骤3.1创建专用用户
2. **启用认证**：按照步骤3.2启用MongoDB认证
3. **配置审计**：按照步骤3.2和4.1配置审计和监控
4. **更新应用配置**：在应用中使用新创建的用户连接数据库
5. **设置监控**：按照步骤4设置定时监控任务
6. **定期检查**：每周检查用户权限和监控日志

## 7. 紧急恢复

如果发生数据丢失：

```bash
# 1. 停止应用
pm2 stop laodongzhongcai-backend

# 2. 从最新备份恢复
mongorestore --host 152.136.175.14 --port 27017 --db laodong --archive=/root/laodongzhongcai/backups/laodong_20260425_020000.archive --gzip

# 3. 启动应用
pm2 start laodongzhongcai-backend
```

## 8. 最佳实践

1. **定期备份**：每天自动备份，保留30天
2. **权限最小化**：应用只使用必要的权限
3. **审计日志**：启用审计，监控危险操作
4. **定期检查**：每周检查用户权限和数据完整性
5. **多层防护**：结合应用层面和数据库层面的保护
6. **灾难恢复**：定期测试数据恢复流程
