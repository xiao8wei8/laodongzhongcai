import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Swagger API文档
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
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

// 路由配置
app.use('/api/auth', authRoutes);
app.use('/api/case', caseRoutes);
app.use('/api/visitor', visitorRoutes);
app.use('/api/application', applicationRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/user', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/system/settings', systemSettingsRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/backup', backupRoutes);

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
    console.error('MySQL连接失败:', error);
    process.exit(1);
  }
};

// 初始化数据库
initDatabase();

// 创建HTTP服务器
const server = http.createServer(app);

// 配置Socket.io
const io = new Server(server, {
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
