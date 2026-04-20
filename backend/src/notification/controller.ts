import express from 'express';
import Notification from '../models/Notification';
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
      const notification = new Notification({
        userId,
        type,
        content,
        status: 'unread'
      });

      await notification.save();

      // 根据类型发送不同的通知
      if (type === 'sms') {
        // 这里需要获取用户的手机号
        // const user = await User.findById(userId);
        // if (user?.phone) {
        //   await smsService.sendNotification(user.phone, content);
        // }
        console.log('发送短信通知:', content);
      } else if (type === 'email') {
        // 这里需要获取用户的邮箱
        // const user = await User.findById(userId);
        // if (user?.email) {
        //   await emailService.sendNotification(user.email, content);
        // }
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
      const { status, page = 1, limit = 10 } = req.query;

      const query: any = { userId };
      if (status) {
        query.status = status;
      }

      const notifications = await Notification.find(query)
        .sort({ created_at: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      const total = await Notification.countDocuments(query);

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
      const count = await Notification.countDocuments({ userId, status: 'unread' });
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

      const notification = await Notification.findOne({ _id: id, userId });
      if (!notification) {
        return res.status(404).json({ message: '通知不存在' });
      }

      notification.status = 'read';
      notification.read_at = new Date();
      await notification.save();

      res.json({ success: true, notification });
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

      await Notification.updateMany(
        { userId, status: 'unread' },
        { $set: { status: 'read', read_at: new Date() } }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];
