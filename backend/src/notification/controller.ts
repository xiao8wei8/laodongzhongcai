import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import notificationRepository from '../repositories/notificationRepository';
import { auth } from '../middleware/auth';
import smsService from '../services/smsService';
import emailService from '../services/emailService';

// 发送通知
export const sendNotification = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { userId, type, content } = req.body;

      if (!userId || !type || !content) {
        return res.status(400).json({ message: '缺少必要参数' });
      }

      // 创建通知记录
      const notification = await notificationRepository.create({
        id: uuidv4(),
        userId,
        type,
        title: content.substring(0, 50),
        content,
        isRead: false,
        createdAt: new Date()
      } as any);

      // 根据类型发送不同的通知
      if (type === 'sms') {
        console.log('发送短信通知:', content);
      } else if (type === 'email') {
        console.log('发送邮件通知:', content);
      }

      res.status(201).json({ success: true, notification });
    } catch (error) {
      console.error('发送通知失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取通知列表
export const getNotifications = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10 } = req.query;
      
      // 简单实现：获取用户的所有通知，然后进行分页
      const allNotifications = await notificationRepository.findByUser(userId!);
      
      // 按创建时间倒序排序
      allNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // 应用分页
      const startIndex = (Number(page) - 1) * Number(limit);
      const notifications = allNotifications.slice(startIndex, startIndex + Number(limit));
      const total = allNotifications.length;

      res.json({
        notifications,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('获取通知列表失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取未读通知数量
export const getUnreadCount = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const count = await notificationRepository.countUnreadNotifications(userId!);
      res.json({ unreadCount: count });
    } catch (error) {
      console.error('获取未读通知数量失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 标记通知为已读
export const markAsRead = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // 先检查通知是否属于该用户
      const notification = await notificationRepository.findById(id);
      if (!notification || notification.userId !== userId) {
        return res.status(404).json({ message: '通知不存在' });
      }

      const updatedNotification = await notificationRepository.markAsRead(id);

      res.json({ success: true, notification: updatedNotification });
    } catch (error) {
      console.error('标记通知已读失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 标记所有通知为已读
export const markAllAsRead = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;

      await notificationRepository.markAllAsRead(userId!);

      res.json({ success: true });
    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];
