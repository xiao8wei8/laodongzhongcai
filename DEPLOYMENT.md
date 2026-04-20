# 劳动仲裁调解系统 - 生产环境部署文档

## 目录

1. [环境要求](#环境要求)
2. [服务器环境准备](#服务器环境准备)
3. [数据库准备](#数据库准备)
4. [项目部署](#项目部署)
5. [Nginx反向代理配置](#nginx反向代理配置)
6. [SSL证书配置](#ssl证书配置)
7. [进程管理](#进程管理)
8. [运维监控](#运维监控)
9. [数据备份](#数据备份)
10. [故障排查](#故障排查)

---

## 环境要求

### 服务器配置
- **操作系统**：Ubuntu 20.04 LTS / CentOS 7+
- **CPU**：2核以上
- **内存**：4GB以上
- **硬盘**：50GB以上

### 软件环境
- **Node.js**：18.x 或更高版本
- **MongoDB**：4.4 或更高版本
- **Nginx**：1.18+
- **PM2**：最新版本

---

## 服务器环境准备

### 1. 更新系统
```bash
# Ubuntu
sudo apt update && sudo apt upgrade -y

# CentOS
sudo yum update -y
```

### 2. 安装Node.js 18.x
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 3. 安装MongoDB
```bash
# Ubuntu 20.04
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt update
sudo apt install -y mongodb-org

# 启动MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 4. 安装Nginx
```bash
# Ubuntu
sudo apt install -y nginx

# CentOS
sudo yum install -y nginx

# 启动Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. 安装PM2
```bash
sudo npm install -g pm2
```

---

## 数据库准备

### 1. 配置MongoDB
```bash
# 编辑MongoDB配置文件
sudo nano /etc/mongod.conf

# 确保以下配置正确
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

# 设置监听的IP地址（允许远程连接）
net:
  port: 27017
  bindIp: 0.0.0.0  # 生产环境建议设置为具体IP

# 重启MongoDB
sudo systemctl restart mongod
```

### 2. 创建数据库和用户
```bash
mongosh

# 创建管理员用户
use admin
db.createUser({
  user: "admin",
  pwd: "your_strong_password",
  roles: [
    { role: "root", db: "admin" }
  ]
})

# 创建应用数据库
use laodong
db.createUser({
  user: "laodong_user",
  pwd: "your_app_password",
  roles: [
    { role: "readWrite", db: "laodong" }
  ]
})

# 退出
exit
```

### 3. 开启认证（生产环境必须）
```bash
sudo nano /etc/mongod.conf

# 添加安全配置
security:
  authorization: enabled

# 重启MongoDB
sudo systemctl restart mongod
```

---

## 项目部署

### 1. 创建部署目录
```bash
sudo mkdir -p /var/www/laodongzhongcai
sudo chown -R $USER:$USER /var/www/laodongzhongcai
```

### 2. 上传项目代码
```bash
# 如果使用Git
cd /var/www/laodongzhongcai
git clone https://your-repo-url/laodongzhongcai.git .

# 或者使用SCP/SFTP上传代码
```

### 3. 配置后端环境变量

**生产环境配置文件** (`backend/.env.production`)：
```env
# 服务器配置
PORT=5003
NODE_ENV=production

# 数据库环境切换
DB_ENV=production

# 生产环境数据库配置
MONGO_URI_PROD=mongodb://laodong_user:your_app_password@127.0.0.1:27017/laodong?authSource=laodong

# JWT配置（生产环境必须使用强密钥）
JWT_SECRET=your_very_strong_random_secret_key_here_minimum_32_characters
JWT_EXPIRES_IN=24h

# 邮件服务配置（腾讯云）
EMAIL_SECRET_ID=your_tencent_cloud_secret_id
EMAIL_SECRET_KEY=your_tencent_cloud_secret_key
EMAIL_REGION=ap-guangzhou
EMAIL_SENDER=your_sender_email@domain.com
EMAIL_TEMPLATE_REGISTER_SUCCESS=your_template_id
EMAIL_TEMPLATE_PASSWORD_RESET=your_template_id
EMAIL_TEMPLATE_CASE_NOTIFICATION=your_template_id

# 短信服务配置（腾讯云）
SMS_SECRET_ID=your_tencent_cloud_secret_id
SMS_SECRET_KEY=your_tencent_cloud_secret_key
SMS_REGION=ap-guangzhou
SMS_SDK_APP_ID=your_sms_sdk_app_id
SMS_SIGN_NAME=your_sms_sign_name
SMS_TEMPLATE_ID_VERIFICATION=your_template_id
SMS_TEMPLATE_ID_NOTIFICATION=your_template_id
```

### 4. 配置前端环境变量

**前端生产配置** (`frontend/.env.production`)：
```env
VITE_API_BASE_URL=https://your-domain.com/api
```

### 5. 构建后端
```bash
cd /var/www/laodongzhongcai/backend

# 安装依赖
npm install

# 构建TypeScript
npm run build
```

### 6. 构建前端
```bash
cd /var/www/laodongzhongcai/frontend

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 7. 配置上传目录权限
```bash
cd /var/www/laodongzhongcai/backend
chmod 755 uploads
```

---

## Nginx反向代理配置

### 1. 创建Nginx配置文件
```bash
sudo nano /etc/nginx/sites-available/laodongzhongcai
```

### 2. 配置内容
```nginx
# 前端静态文件服务
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名

    # 前端静态文件
    root /var/www/laodongzhongcai/frontend/dist;
    index index.html;

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;

        # 添加缓存控制
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端API代理
    location /api {
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 增加超时时间
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO代理
    location /socket.io {
        proxy_pass http://127.0.0.1:5003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket超时设置
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Swagger API文档
    location /api/docs {
        proxy_pass http://127.0.0.1:5003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 上传文件大小限制
    client_max_body_size 50M;
}
```

### 3. 启用站点配置
```bash
# 软链接到sites-enabled
sudo ln -s /etc/nginx/sites-available/laodongzhongcai /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载Nginx
sudo systemctl reload nginx
```

---

## SSL证书配置

### 1. 使用Let's Encrypt免费证书
```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（自动配置Nginx）
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

### 2. 配置自动续期
```bash
# 编辑crontab
sudo crontab -e

# 添加以下行（每天凌晨2点检查续期）
0 2 * * * /usr/bin/certbot renew --quiet
```

---

## 进程管理

### 1. PM2配置文件

项目已提供 `ecosystem.config.js` 配置文件，支持多环境配置：

```javascript
module.exports = {
  apps: [
    {
      name: 'laodongzhongcai-backend',
      script: './dist/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5003,
        DB_ENV: 'production'
      },
      kill_timeout: 5000,
      restart_delay: 4000
    }
  ]
};
```

### 2. 使用PM2启动后端服务
```bash
cd /var/www/laodongzhongcai/backend

# 使用ecosystem.config.js启动（推荐）
pm2 start ecosystem.config.js

# 保存PM2进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### 3. PM2常用命令
```bash
# 查看进程状态
pm2 list

# 查看日志
pm2 logs laodongzhongcai-backend

# 重启服务
pm2 restart laodongzhongcai-backend

# 停止服务
pm2 stop laodongzhongcai-backend

# 删除进程
pm2 delete laodongzhongcai-backend

# 监控资源使用
pm2 monit

# 查看详细进程信息
pm2 show laodongzhongcai-backend
```

### 4. 生产环境启动
```bash
# 1. 进入后端目录
cd /var/www/laodongzhongcai/backend

# 2. 使用生产环境配置启动
NODE_ENV=production DB_ENV=production pm2 start ecosystem.config.js

# 3. 保存进程列表
pm2 save

# 4. 设置开机自启
pm2 startup
```

### 5. 开发环境启动
```bash
cd /var/www/laodongzhongcai/backend

# 使用开发环境配置启动
NODE_ENV=development DB_ENV=development pm2 start ecosystem.config.js
```

---

## 运维监控

### 1. PM2监控
```bash
# 启动PM2 Plus仪表板（可选）
pm2 link <key> <id>

# 或者使用本地仪表板
pm2 monit
```

### 2. 日志管理
```bash
# 查看日志
pm2 logs laodongzhongcai-backend
```

### 3. 系统监控脚本
```bash
# 创建监控脚本
sudo nano /usr/local/bin/monitor.sh
```

```bash
#!/bin/bash
# 系统监控脚本

echo "=== 系统监控报告 - $(date) ==="
echo ""

# CPU和内存使用
echo "CPU和内存使用："
top -bn1 | head -5

echo ""
echo "内存使用："
free -h

echo ""
echo "磁盘使用："
df -h

echo ""
echo "后端服务状态："
pm2 list

echo ""
echo "Nginx状态："
systemctl status nginx | grep Active

echo ""
echo "MongoDB状态："
systemctl status mongod | grep Active

echo ""
echo "最近的错误日志："
tail -n 20 /var/log/nginx/error.log
```

```bash
# 添加执行权限
sudo chmod +x /usr/local/bin/monitor.sh

# 添加到crontab（每小时执行一次）
0 * * * * /usr/local/bin/monitor.sh >> /var/log/monitor.log 2>&1
```

---

## 数据备份

### 1. 数据库备份脚本
```bash
sudo nano /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
# 数据库备份脚本

# 配置
DB_NAME="laodong"
DB_USER="laodong_user"
DB_PASS="your_app_password"
BACKUP_DIR="/var/www/laodongzhongcai/backend/data_backup"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/laodong_${DATE}.gz"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
mongodump --db=$DB_NAME --archive=$BACKUP_FILE --gzip --authenticationDatabase=laodong -u=$DB_USER -p=$DB_PASS

# 删除7天前的备份
find $BACKUP_DIR -name "laodong_*.gz" -mtime +7 -delete

echo "备份完成：$BACKUP_FILE"
```

```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

### 2. 定时备份任务
```bash
# 每天凌晨3点执行备份
0 3 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
```

### 3. 备份验证
```bash
# 手动执行备份测试
/usr/local/bin/backup-db.sh

# 查看备份文件
ls -lh /var/www/laodongzhongcai/backend/data_backup/
```

---

## 故障排查

### 1. 后端服务无法启动
```bash
# 查看详细错误
cd /var/www/laodongzhongcai/backend
node dist/server.js

# 检查端口占用
lsof -i :5003

# 检查PM2日志
pm2 logs laodongzhongcai-backend --err --lines 50
```

### 2. MongoDB连接失败
```bash
# 检查MongoDB状态
systemctl status mongod

# 检查MongoDB日志
tail -f /var/log/mongodb/mongod.log

# 测试连接
mongosh -u laodong_user -p --authenticationDatabase laodong
```

### 3. Nginx 502 Bad Gateway
```bash
# 检查后端服务是否运行
pm2 list

# 检查后端端口
curl http://127.0.0.1:5003/api/health

# 检查Nginx错误日志
tail -f /var/log/nginx/error.log

# 重载Nginx配置
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Socket.IO连接失败
```bash
# 检查WebSocket代理配置
# 确保nginx配置包含：
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";

# 检查防火墙
sudo ufw status

# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 5. 前端资源加载失败
```bash
# 检查前端构建文件
ls -la /var/www/laodongzhongcai/frontend/dist/

# 检查Nginx配置
sudo nano /etc/nginx/sites-available/laodongzhongcai

# 确保root路径正确
```

### 6. 邮件/短信服务无法发送
```bash
# 检查腾讯云配置
# 确认SecretId、SecretKey、Region配置正确

# 检查网络连接
curl -I https://email.ap-guangzhou.tencentcos.com

# 查看后端日志中的邮件错误
pm2 logs laodongzhongcai-backend | grep email
```

---

## 安全建议

### 1. 服务器安全
- 使用SSH密钥登录，禁用密码登录
- 配置防火墙，仅开放必要端口（80, 443, 22）
- 定期更新系统和软件
- 使用fail2ban防止暴力破解

### 2. 应用安全
- 使用强密码和JWT密钥
- 启用MongoDB认证
- 配置CORS白名单
- 定期查看日志，关注异常访问

### 3. 数据安全
- 定期备份数据库
- 启用SSL/TLS加密
- 敏感数据加密存储
- 设置合理的文件上传类型限制

---

## 快速部署清单

- [ ] 服务器环境准备（Node.js、MongoDB、Nginx、PM2）
- [ ] 数据库创建和用户配置
- [ ] 项目代码上传
- [ ] 环境变量配置
- [ ] 后端构建和启动
- [ ] 前端构建
- [ ] Nginx配置
- [ ] SSL证书配置
- [ ] PM2进程管理
- [ ] 备份脚本配置
- [ ] 监控脚本配置
- [ ] 测试验收

---

## 联系支持

如遇问题，请检查：
1. `/var/log/nginx/error.log` - Nginx错误日志
2. `pm2 logs laodong-backend` - 后端运行日志
3. `/var/log/mongodb/mongod.log` - MongoDB日志
4. 系统监控报告 - `/var/log/monitor.log`

---

**文档版本**：1.0
**最后更新**：2024年
**适用版本**：劳动仲裁调解系统 v1.0+
