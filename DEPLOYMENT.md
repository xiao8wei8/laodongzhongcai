# 劳动仲裁调解系统 - 生产环境部署指南

## 📋 部署概述

本文档说明如何将劳动仲裁调解系统部署到生产环境。

### 技术栈
- **前端**: React 18 + Vite + TypeScript
- **后端**: Node.js 18+ + Express + TypeScript
- **数据库**: MySQL 8.0+
- **进程管理**: PM2
- **Web服务器**: Nginx

### 访问地址
- **前台地址**: https://www.saifchat.com/laodongzhongcai
- **API地址**: https://www.saifchat.com/laodongzhongcai/api
- **后端端口**: 5003

---

## 🚀 第一步：服务器环境准备

### 1.1 确保基础环境

```bash
# 检查 Node.js 版本
node --version  # 需要 18+

# 检查 npm 版本
npm --version

# 检查 MySQL
mysql --version

# 检查 Git
git --version

# 检查 PM2
pm2 --version
```

### 1.2 安装 PM2（如果没有）

```bash
npm install -g pm2
```

### 1.3 安装 MySQL（如果没有）

```bash
# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

---

## 📥 第二步：拉取代码

### 2.1 创建项目目录

```bash
sudo mkdir -p /var/www/laodongzhongcai
cd /var/www/laodongzhongcai
```

### 2.2 克隆代码

```bash
sudo git clone https://github.com:xiao8wei8/laodongzhongcai.git .
sudo chown -R $USER:$USER /var/www/laodongzhongcai
```

---

## 🗄️ 第三步：配置数据库

### 3.1 创建 MySQL 数据库和用户

```bash
mysql -u root -p
```

在 MySQL 命令行中执行：

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS laodongzhongcai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户并授权
CREATE USER 'newuser'@'%' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON laodongzhongcai.* TO 'newuser'@'%';
FLUSH PRIVILEGES;

-- 退出
EXIT;
```

### 3.2 配置后端环境变量

```bash
cd /var/www/laodongzhongcai/backend

# 编辑 .env 文件
nano .env
```

确保包含以下配置：

```env
# 服务器配置
PORT=5003
NODE_ENV=production

# 数据库环境切换
DB_ENV=production

# MySQL 数据库配置（新增）
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=newuser
MYSQL_PASSWORD=StrongPassword123!
MYSQL_DATABASE=laodongzhongcai

# MongoDB 配置（可选，仅用于数据迁移）
MONGO_URI_PROD=mongodb://127.0.0.1:27017/laodong

# JWT配置
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# 其他配置...
```

---

## 📦 第四步：安装依赖和构建

### 4.1 安装后端依赖

```bash
cd /var/www/laodongzhongcai/backend
npm install
```

### 4.2 初始化数据库（首次部署）

```bash
npm run db:init
```

这会自动：
- 创建所有表结构
- 插入默认账户

**默认账户**：
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 调解员 | mediator | mediator123 |

### 4.3 构建后端

```bash
npm run build
```

### 4.4 安装前端依赖并构建

```bash
cd /var/www/laodongzhongcai/frontend
npm install
npm run build
```

---

## ⚙️ 第五步：配置 PM2 进程管理

### 5.1 创建 PM2 配置文件

在项目根目录创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'laodongzhongcai-backend',
      script: 'dist/server.js',
      cwd: '/var/www/laodongzhongcai/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5003
      },
      error_file: '/var/log/pm2/laodongzhongcai-error.log',
      out_file: '/var/log/pm2/laodongzhongcai-out.log',
      log_file: '/var/log/pm2/laodongzhongcai-combined.log',
      time: true
    }
  ]
};
```

### 5.2 创建日志目录

```bash
sudo mkdir -p /var/log/pm2
sudo chmod 777 /var/log/pm2
```

### 5.3 启动服务

```bash
cd /var/www/laodongzhongcai
pm2 start ecosystem.config.js
```

### 5.4 保存 PM2 配置

```bash
pm2 save
pm2 startup
```

### 5.5 管理命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs laodongzhongcai-backend

# 重启服务
pm2 restart laodongzhongcai-backend

# 停止服务
pm2 stop laodongzhongcai-backend
```

---

## 🌐 第六步：配置 Nginx

### 6.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/conf.d/laodongzhongcai.conf
```

### 6.2 配置文件内容

```nginx
server {
    listen 80;
    server_name www.saifchat.com;

    # 重定向 HTTP 到 HTTPS（可选）
    # return 301 https://$server_name$request_uri;

    # 前端静态文件
    root /var/www/laodongzhongcai/frontend/dist;
    index index.html;

    # 前端路由
    location /laodongzhongcai/ {
        try_files $uri $uri/ /laodongzhongcai/index.html;
    }

    # API 反向代理到后端
    location /laodongzhongcai/api {
        rewrite ^/laodongzhongcai/api/(.*) /$1 break;
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /laodongzhongcai/socket.io {
        rewrite ^/laodongzhongcai/socket.io/(.*) /socket.io/$1 break;
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 上传文件目录
    location /laodongzhongcai/uploads {
        alias /var/www/laodongzhongcai/backend/public/uploads;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location /laodongzhongcai/assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

### 6.3 测试和重载 Nginx

```bash
# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx

# 如果需要重启
sudo systemctl restart nginx
```

### 6.4 设置权限

```bash
sudo chown -R nginx:nginx /var/www/laodongzhongcai/frontend/dist
sudo chmod -R 755 /var/www/laodongzhongcai/frontend/dist
```

---

## 🔒 第七步：配置防火墙

```bash
# 开放必要端口
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=5003/tcp

# 重载防火墙
sudo firewall-cmd --reload

# 或者使用 ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5003/tcp
```

---

## ✅ 第八步：验证部署

### 8.1 检查服务状态

```bash
# 检查 PM2
pm2 status

# 检查端口
netstat -tlnp | grep 5003

# 检查 Nginx
sudo nginx -t
```

### 8.2 测试 API

```bash
# 测试后端服务
curl http://127.0.0.1:5003/api/services/status

# 测试完整路径
curl -X POST http://127.0.0.1:5003/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"events":[{"event":"test"}]}'
```

### 8.3 浏览器访问

打开浏览器访问：
- https://www.saifchat.com/laodongzhongcai
- https://www.saifchat.com/laodongzhongcai/api/docs（API文档）

---

## 🔄 常用维护命令

### 更新代码

```bash
cd /var/www/laodongzhongcai

# 拉取最新代码
git pull origin main

# 重新构建
cd backend && npm run build && cd ..
cd frontend && npm run build && cd ..

# 重启服务
pm2 restart laodongzhongcai-backend
```

### 数据库备份

```bash
# 备份 MySQL
mysqldump -u newuser -p laodongzhongcai > backup_$(date +%Y%m%d).sql

# 备份上传文件
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/public/uploads/
```

### 日志查看

```bash
# PM2 日志
pm2 logs laodongzhongcai-backend --lines 100

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 常见问题

### 1. 502 Bad Gateway

**原因**: 后端服务未启动或端口不匹配

**解决**:
```bash
pm2 status
pm2 restart laodongzhongcai-backend
```

### 2. 500 Internal Server Error

**原因**: 权限问题或代码错误

**解决**:
```bash
# 检查权限
sudo chown -R $USER:$USER /var/www/laodongzhongcai

# 查看错误日志
pm2 logs laodongzhongcai-backend --err
```

### 3. 数据库连接失败

**原因**: MySQL 配置错误

**解决**:
- 检查 `.env` 文件中的 MySQL 配置
- 确认 MySQL 服务正在运行
- 验证用户权限

### 4. 404 Not Found

**原因**: 路由配置错误

**解决**:
```bash
# 检查 Nginx 配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 5. 前端静态资源加载失败

**原因**: 路径配置问题

**解决**:
```bash
# 检查 dist 目录
ls -la /var/www/laodongzhongcai/frontend/dist/

# 重新构建前端
cd frontend && npm run build
```

---

## 📞 技术支持

如遇到问题，请检查：
1. PM2 日志: `pm2 logs laodongzhongcai-backend`
2. Nginx 错误日志: `sudo tail -f /var/log/nginx/error.log`
3. MySQL 错误日志: `sudo tail -f /var/log/mysql/error.log`

---

**最后更新**: 2026-06-03
**版本**: 2.0 (MySQL + Production Deployment)
