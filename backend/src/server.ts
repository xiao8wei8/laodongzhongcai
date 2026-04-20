import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';

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
const PORT = process.env.PORT || 5002;

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

// 测试调教员123的数据
app.get('/api/test/mediator123', async (req, res) => {
  try {
    const mediatorId = '69a9a6d917bcb1d9978a5222';
    const Case = require('./models/Case').default;
    const VisitorRecord = require('./models/VisitorRecord').default;
    
    // 查询调教员123的正式案件
    const cases: any[] = await Case.find({ mediatorId });
    console.log('调教员123的正式案件:', cases.length, cases.map((c: any) => c.caseNumber));
    
    // 查询调教员123的到访登记
    const visitors: any[] = await VisitorRecord.find({ mediatorId });
    console.log('调教员123的到访登记:', visitors.length, visitors.map((v: any) => v.registerNumber));
    
    // 计算总数
    const total = cases.length + visitors.length;
    console.log('调教员123的总案件数:', total);
    
    res.json({
      cases: cases.length,
      visitors: visitors.length,
      total: total,
      caseNumbers: cases.map((c: any) => c.caseNumber),
      visitorNumbers: visitors.map((v: any) => v.registerNumber)
    });
  } catch (error) {
    console.error('测试错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// 测试工作台数据
app.get('/api/test/dashboard', async (req, res) => {
  try {
    const mediatorId = '69a9a6d917bcb1d9978a5222';
    const Case = require('./models/Case').default;
    const VisitorRecord = require('./models/VisitorRecord').default;
    
    const caseQuery: any = { mediatorId };
    const visitorQuery: any = { mediatorId };
    
    console.log('Dashboard stats query:', {
      userId: mediatorId,
      role: 'mediator',
      caseQuery,
      visitorQuery
    });
    
    // 获取案件总数
    const totalCases = await Case.countDocuments(caseQuery);
    const totalVisitors = await VisitorRecord.countDocuments(visitorQuery);
    const total = totalCases + totalVisitors;
    
    console.log('Dashboard stats counts:', {
      totalCases,
      totalVisitors,
      total
    });
    
    // 调试：直接查询调解员123的案件和到访记录
    console.log('=== 调教员123数据调试 ===');
    const mediatorCases = await Case.find({ mediatorId });
    console.log('调教员123的正式案件:', mediatorCases.length, mediatorCases.map((c: any) => c.caseNumber));
    
    const mediatorVisitors = await VisitorRecord.find({ mediatorId });
    console.log('调教员123的到访登记:', mediatorVisitors.length, mediatorVisitors.map((v: any) => v.registerNumber));
    
    // 获取各状态案件数量
    const pendingCases = await Case.countDocuments({ ...caseQuery, status: 'pending' }) + 
                        await VisitorRecord.countDocuments({ ...visitorQuery });
    const processingCases = await Case.countDocuments({ ...caseQuery, status: 'processing' });
    const completedCases = await Case.countDocuments({ ...caseQuery, status: 'completed' });
    const failedCases = await Case.countDocuments({ ...caseQuery, status: 'failed' });
    
    console.log('Dashboard status counts:', {
      pendingCases,
      processingCases,
      completedCases,
      failedCases
    });
    
    // 获取今日到访记录数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayVisitors = await VisitorRecord.countDocuments({
      ...visitorQuery,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    console.log('Dashboard today visitors:', todayVisitors);
    
    const stats = {
      totalCases: total,
      pendingCases,
      processingCases,
      completedCases,
      failedCases,
      todayVisitors
    };
    
    console.log('调教员123的工作台数据:', stats);
    
    res.json(stats);
  } catch (error) {
    console.error('测试工作台数据错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
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

// 数据库连接 - 根据环境变量选择数据库
const dbEnv = process.env.DB_ENV || 'development';
let mongoUri = '';
if (dbEnv === 'production') {
  mongoUri = process.env.MONGO_URI_PROD || 'mongodb://152.136.175.14:27017/laodong';
  console.log('使用生产环境数据库:', mongoUri);
} else {
  mongoUri = process.env.MONGO_URI_DEV || 'mongodb://localhost:27017/laodong';
  console.log('使用开发环境数据库:', mongoUri);
}

mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB连接成功');
  })
  .catch((error) => {
    console.error('MongoDB连接失败:', error);
  });

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