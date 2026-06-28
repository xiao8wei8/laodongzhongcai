import express from 'express';
import { createVisitorRecord, getVisitorRecords, getVisitorRecordById, getTodayVisitorRecords } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 创建到访记录
router.post('/', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], createVisitorRecord);

// 获取到访记录列表
router.get('/', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], getVisitorRecords);

// 获取今日到访记录
router.get('/today', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], getTodayVisitorRecords);

// 获取到访记录详情
router.get('/:id', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], getVisitorRecordById);

export default router;
