import express from 'express';
import { trackEvents, getAnalyticsData, getPageStats, getErrorStats, getAccessUsers, getOperationLogs } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 接收埋点数据，不需要认证
router.post('/track', trackEvents);

// 获取分析数据，只允许管理员访问
router.get('/data', [auth, roleAuth(['superadmin'])], getAnalyticsData);

// 获取页面访问统计，只允许管理员访问
router.get('/page-stats', [auth, roleAuth(['superadmin'])], getPageStats);

// 获取错误统计，只允许管理员访问
router.get('/error-stats', [auth, roleAuth(['superadmin'])], getErrorStats);

// 获取访问用户数据，只允许超级管理员访问
router.get('/access-users', [auth, roleAuth(['superadmin'])], getAccessUsers);

// 获取操作日志，只允许超级管理员访问
router.get('/operation-logs', [auth, roleAuth(['superadmin'])], getOperationLogs);

export default router;
