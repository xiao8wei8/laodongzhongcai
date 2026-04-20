import express from 'express';
import { trackEvents, getAnalyticsData, getPageStats, getErrorStats } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 接收埋点数据，不需要认证
router.post('/track', trackEvents);

// 获取分析数据，只允许管理员访问
router.get('/data', [auth, roleAuth(['admin'])], getAnalyticsData);

// 获取页面访问统计，只允许管理员访问
router.get('/page-stats', [auth, roleAuth(['admin'])], getPageStats);

// 获取错误统计，只允许管理员访问
router.get('/error-stats', [auth, roleAuth(['admin'])], getErrorStats);

export default router;
