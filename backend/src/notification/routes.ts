import express from 'express';
import { sendNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead } from './controller';

const router = express.Router();

// 通知相关路由
router.post('/', sendNotification);
router.get('/', getNotifications);
router.get('/unread', getUnreadCount);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;
