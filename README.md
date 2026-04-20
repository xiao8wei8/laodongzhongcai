# 劳动仲裁调解系统

## 项目简介

劳动仲裁调解系统是一个基于 React + TypeScript + Node.js + MongoDB 开发的全栈应用，旨在为劳动争议提供在线调解服务。系统支持个人用户和企业用户申请调解，调解员进行案件处理，管理员进行系统管理。

## 技术栈

### 前端
- React 18
- TypeScript
- Ant Design 5
- Zustand 状态管理
- React Big Calendar 日历组件

### 后端
- Node.js 18+
- Express
- TypeScript
- MongoDB
- Socket.IO
- Swagger API文档

## 系统功能

### 核心功能
- 用户认证与授权
- 案件申请与管理
- 日程管理与安排
- 消息通知系统
- 统计分析
- 服务管理
- API文档

### 角色权限
- **管理员**：系统配置、用户管理、服务管理
- **调解员**：案件处理、日程管理、统计查看
- **个人用户**：案件申请、案件查询
- **企业用户**：案件查询、案件处理

## 快速开始

### 环境要求
- Node.js 18+
- MongoDB 4.4+

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://your-repo-url/laodongzhongcai.git
cd laodongzhongcai
```

#### 2. 安装依赖

**后端依赖**：
```bash
cd backend
npm install
```

**前端依赖**：
```bash
cd ../frontend
npm install
```

#### 3. 配置环境变量

**后端配置** (`backend/.env`)：
```env
# 服务器配置
PORT=5003
NODE_ENV=development

# 数据库环境切换（development 或 production）
DB_ENV=development

# 开发环境数据库配置
MONGO_URI_DEV=mongodb://localhost:27017/laodong

# 生产环境数据库配置
MONGO_URI_PROD=mongodb://152.136.175.14:27017/laodong

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# 邮件服务配置
EMAIL_SECRET_ID=your_tencent_cloud_secret_id
EMAIL_SECRET_KEY=your_tencent_cloud_secret_key
EMAIL_REGION=ap-guangzhou
EMAIL_SENDER=your_sender_email
EMAIL_TEMPLATE_REGISTER_SUCCESS=your_register_success_template_id
EMAIL_TEMPLATE_PASSWORD_RESET=your_password_reset_template_id
EMAIL_TEMPLATE_CASE_NOTIFICATION=your_case_notification_template_id

# 短信服务配置
SMS_SECRET_ID=your_tencent_cloud_secret_id
SMS_SECRET_KEY=your_tencent_cloud_secret_key
SMS_REGION=ap-guangzhou
SMS_SDK_APP_ID=your_sms_sdk_app_id
SMS_SIGN_NAME=your_sms_sign_name
SMS_TEMPLATE_ID_VERIFICATION=your_verification_template_id
SMS_TEMPLATE_ID_NOTIFICATION=your_notification_template_id
```

**前端配置** (`frontend/.env`)：
```env
VITE_API_BASE_URL=http://localhost:5003/api
```

### 启动命令

#### 后端服务
- **开发环境**：`npm run start:dev`
- **生产环境**：`npm run start:prod`
- **开发模式**：`npm run dev`
- **构建**：`npm run build`

#### 前端服务
- **开发模式**：`npm run dev`
- **构建生产版本**：`npm run build`
- **预览生产构建**：`npm run preview`

## 项目结构

### 后端结构
```
backend/
├── src/
│   ├── controllers/     # 控制器
│   ├── models/          # 数据模型
│   ├── routes/          # 路由
│   ├── services/        # 服务
│   ├── config/          # 配置
│   └── server.ts        # 服务器入口
├── scripts/             # 脚本工具
├── public/              # 静态文件
└── .env                 # 环境变量
```

### 前端结构
```
frontend/
├── src/
│   ├── components/      # 组件
│   ├── pages/           # 页面
│   ├── services/        # 服务
│   ├── store/           # 状态管理
│   ├── routes/          # 路由
│   └── main.tsx         # 应用入口
└── public/              # 静态文件
```

## API文档

后端提供了完整的API文档，可通过以下地址访问：
- Swagger UI: `http://localhost:5003/api/docs`
- API文档JSON: `http://localhost:5003/api/docs.json`

## 服务管理

系统提供了服务管理页面，管理员可以查看：
- 后端服务状态
- 前端服务状态
- MongoDB连接状态
- 邮件服务配置
- 短信服务配置
- 数据库环境信息

## 数据库管理

### 数据备份
使用以下命令备份数据库：
```bash
cd backend
npm run backup
```

### 环境切换
- **开发环境**：使用本地MongoDB (`localhost:27017/laodong`)
- **生产环境**：使用远程MongoDB (`152.136.175.14:27017`)

通过环境变量 `DB_ENV` 切换数据库环境。

## 部署说明

### 生产环境部署
1. 构建前端生产版本：`npm run build`
2. 构建后端生产版本：`npm run build`
3. 使用PM2管理进程：
   ```bash
   pm2 start "npm run start:prod" --name backend
   pm2 save
   pm2 startup
   ```
4. 配置Nginx反向代理

## 注意事项

1. 首次启动时，系统会自动创建默认管理员账号
2. 生产环境需要配置真实的邮件和短信服务
3. 定期备份数据库以防止数据丢失
4. 生产环境应设置强密码和JWT密钥

## 许可证

ISC License
