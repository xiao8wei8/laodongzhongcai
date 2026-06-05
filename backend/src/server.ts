import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import pool from './config/mysql';

// 导入路由
import authRoutes from './auth/routes';
import caseRoutes from './case/routes';
import visitorRoutes from './visitor/routes';
import applicationRoutes from './application/routes';
import broadcastRoutes from './broadcast/routes';
import evidenceRoutes from './evidence/routes';
import notificationRoutes from './notification/routes';
import userRoutes from './user/routes';
import dashboardRoutes from './dashboard/routes';
import serviceRoutes from './services/routes';
import systemSettingsRoutes from './systemSettings/routes';
import messageRoutes from './message/routes';
import analyticsRoutes from './analytics/routes';
import backupRoutes from './backup/routes';

// 导入提醒服务
import reminderService from './services/ReminderService';

// 配置环境变量
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

const app = express();
const PORT = process.env.PORT || 5003;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 前端静态资源（使用已构建的 frontend/dist，挂载到与前端 basename 一致的路径）
// 这样无需启动 Vite dev server 也能访问前端页面
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use('/laodongzhongcai', express.static(frontendDistPath));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/laodongzhongcai/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Swagger API文档
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});
app.use('/laodongzhongcai/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/laodongzhongcai/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

// 测试数据库连接
app.get('/api/test/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', mysql: 'connected', data: rows });
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.status(500).json({ status: 'error', message: '数据库连接失败' });
  }
});
app.get('/laodongzhongcai/api/test/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', mysql: 'connected', data: rows });
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.status(500).json({ status: 'error', message: '数据库连接失败' });
  }
});

// 路由配置
const API_BASE_PATHS = ['/api', '/laodongzhongcai/api'];
for (const base of API_BASE_PATHS) {
  app.use(`${base}/auth`, authRoutes);
  app.use(`${base}/case`, caseRoutes);
  app.use(`${base}/visitor`, visitorRoutes);
  app.use(`${base}/application`, applicationRoutes);
  app.use(`${base}/broadcast`, broadcastRoutes);
  app.use(`${base}/evidence`, evidenceRoutes);
  app.use(`${base}/notification`, notificationRoutes);
  app.use(`${base}/user`, userRoutes);
  app.use(`${base}/dashboard`, dashboardRoutes);
  app.use(`${base}/services`, serviceRoutes);
  app.use(`${base}/system/settings`, systemSettingsRoutes);
  app.use(`${base}/message`, messageRoutes);
  app.use(`${base}/analytics`, analyticsRoutes);
  app.use(`${base}/backup`, backupRoutes);
}

// SPA 路由回退（必须放在 API 路由之后；并且排除 /laodongzhongcai/api/*）
app.get('/laodongzhongcai/*', (req, res, next) => {
  if (req.path.startsWith('/laodongzhongcai/api')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

// 数据库连接 - MySQL
const initDatabase = async () => {
  try {
    // 测试连接
    await pool.query('SELECT 1');
    console.log('MySQL连接成功');
  } catch (error) {
    // 开发/演示场景下允许继续启动，避免因为数据库不可达导致整个服务无法运行
    console.error('MySQL连接失败（将继续启动服务，部分接口可能不可用）:', error);
  }
};

// 初始化数据库
initDatabase();

// 创建HTTP服务器
const server = http.createServer(app);

// 配置Socket.io
// 注意：前端在生产环境使用子目录部署（/laodongzhongcai），socket.io path 也需要一致
const io = new Server(server, {
  path: '/laodongzhongcai/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io事件处理
io.on('connection', (socket) => {
  console.log('新的Socket连接:', socket.id);
  
  // 加入用户房间（用于定向消息）
  socket.on('joinUserRoom', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id}加入用户房间 ${userId}`);
  });
  
  // 加入房间
  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id}加入房间 ${room}`);
  });
  
  // 发送广播消息
  socket.on('broadcastMessage', (message) => {
    io.emit('newBroadcast', message);
  });
  
  // 发送案件更新
  socket.on('caseUpdate', (caseId) => {
    io.emit('caseUpdated', caseId);
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket断开连接:', socket.id);
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  // 启动提醒服务
  reminderService.start();
});

export default app;
export { io };
