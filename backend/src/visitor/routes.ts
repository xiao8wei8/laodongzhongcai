import express from 'express';
import { createVisitorRecord, getVisitorRecords, getVisitorRecordById, getTodayVisitorRecords, sendSmsLink } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 创建到访记录
router.post('/', [auth, roleAuth(['mediator', 'admin'])], createVisitorRecord);

// 获取到访记录列表
router.get('/', [auth, roleAuth(['mediator', 'admin'])], getVisitorRecords);

// 获取今日到访记录
router.get('/today', [auth, roleAuth(['mediator', 'admin'])], getTodayVisitorRecords);

// 获取到访记录详情
router.get('/:id', [auth, roleAuth(['mediator', 'admin'])], getVisitorRecordById);

// 发送短信链接
router.post('/sms-link', [auth, roleAuth(['mediator', 'admin'])], sendSmsLink);

export default router;
