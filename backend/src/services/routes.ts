import express from 'express';
import { checkServiceStatus, startService, stopService, restartService } from './controller';
import { getMonitoringData, getLogs } from './monitoringController';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 检查服务状态，只允许管理员访问
router.get('/status', [auth, roleAuth(['admin'])], checkServiceStatus);

// 启动服务，只允许管理员访问
router.post('/start', [auth, roleAuth(['admin'])], startService);

// 停止服务，只允许管理员访问
router.post('/stop', [auth, roleAuth(['admin'])], stopService);

// 重启服务，只允许管理员访问
router.post('/restart', [auth, roleAuth(['admin'])], restartService);

// 获取监控数据，只允许管理员访问
router.get('/monitoring', [auth, roleAuth(['admin'])], getMonitoringData);

// 获取日志数据，只允许管理员访问
router.get('/logs', [auth, roleAuth(['admin'])], getLogs);

export default router;
