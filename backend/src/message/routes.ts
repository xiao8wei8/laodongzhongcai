import express from 'express';
import { createMessage, getUserMessages, getUnreadMessageCount, markMessageAsRead, markAllMessagesAsRead, deleteMessage } from './controller';
import { auth } from '../middleware/auth';

const router = express.Router();

// 创建消息
router.post('/', auth, createMessage);

// 获取用户消息列表
router.get('/', auth, getUserMessages);

// 获取未读消息数量
router.get('/unread-count', auth, getUnreadMessageCount);

// 标记消息为已读
router.put('/:messageId/read', auth, markMessageAsRead);

// 标记所有消息为已读
router.put('/read-all', auth, markAllMessagesAsRead);

// 删除消息
router.delete('/:messageId', auth, deleteMessage);

export default router;