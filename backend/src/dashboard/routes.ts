import express from 'express';
import { getDashboardData, getStats, getPendingCases, getCaseTrendData, getCaseTypeData, getVisitorTrendData } from './controller';
import { auth } from '../middleware/auth';

const router = express.Router();

// 获取工作台数据
router.get('/', auth, getDashboardData);

// 获取统计数据
router.get('/stats', auth, getStats);

// 获取待办事项
router.get('/pending', auth, getPendingCases);

// 获取案件趋势数据
router.get('/case-trend', auth, getCaseTrendData);

// 获取案件类型分布数据
router.get('/case-type', auth, getCaseTypeData);

// 获取访客趋势数据
router.get('/visitor-trend', auth, getVisitorTrendData);

export default router;
