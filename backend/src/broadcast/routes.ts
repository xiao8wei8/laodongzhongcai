import express from 'express';
import { createBroadcast, getBroadcasts, getBroadcastById, getLatestBroadcasts, approveBroadcast, getPendingBroadcasts, getBroadcastStats, updateRejectedBroadcast } from './controller';
import { auth, optionalAuth, roleAuth } from '../middleware/auth';

const router = express.Router();

// 发布广播
router.post('/', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], createBroadcast);

// 获取广播列表
router.get('/', optionalAuth, getBroadcasts);

// 获取最新广播
router.get('/latest', optionalAuth, getLatestBroadcasts);

// 获取广播详情
router.get('/:id', auth, getBroadcastById);

// 审核广播
router.put('/:id/approve', [auth, roleAuth(['superadmin'])], approveBroadcast);

// 获取待审核广播列表
router.get('/pending/list', [auth, roleAuth(['superadmin', 'tenant_admin'])], getPendingBroadcasts);

// 获取广播阅读统计
router.get('/:id/stats', [auth, roleAuth(['superadmin', 'tenant_admin'])], getBroadcastStats);

// 修改被驳回的广播
router.put('/:id', [auth, roleAuth(['mediator', 'tenant_admin', 'superadmin'])], updateRejectedBroadcast);

export default router;
