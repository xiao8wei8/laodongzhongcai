import express from 'express';
import User from '../models/User';
import ReminderSetting from '../models/ReminderSetting';
import { auth } from '../middleware/auth';

// 获取用户列表
export const getUsers = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { role, page = 1, limit = 10 } = req.query;

      const query: any = {};
      if (role) {
        query.role = role;
      }

      const users = await User.find(query)
        .select('-password')
        .sort({ created_at: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      const total = await User.countDocuments(query);

      res.json({
        users,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取用户详情
export const getUserDetail = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id).select('-password');

      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      res.json({ user });
    } catch (error) {
      console.error('获取用户详情失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 更新用户信息
export const updateUser = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const { name, phone, email, address, role } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      // 更新用户信息
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (email) user.email = email;
      if (address) user.address = address;
      if (role && req.user?.role === 'admin') user.role = role;

      await user.save();

      res.json({ success: true, user: await User.findById(id).select('-password') });
    } catch (error) {
      console.error('更新用户信息失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 删除用户
export const deleteUser = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;

      // 不允许删除自己
      if (id === req.user?.id) {
        return res.status(400).json({ message: '不能删除自己的账号' });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      await user.deleteOne();

      res.json({ success: true });
    } catch (error) {
      console.error('删除用户失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 创建用户（管理员）
export const createUser = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { username, password, name, phone, email, address, role } = req.body;

      // 检查用户名是否已存在
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' });
      }

      // 创建新用户
      const user = new User({
        username,
        password_hash: password, // 密码会在模型中自动加密
        name,
        phone,
        email,
        address,
        role
      });

      await user.save();

      res.status(201).json({ success: true, user: await User.findById(user.id).select('-password') });
    } catch (error) {
      console.error('创建用户失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 设置值班调解员
export const setOnDutyMediator = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { mediatorId } = req.body;

      // 验证调用者是否为管理员
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: '权限不足，仅管理员可设置值班调解员' });
      }

      // 验证调解员是否存在且角色为调解员
      const mediator = await User.findById(mediatorId);
      if (!mediator || mediator.role !== 'mediator') {
        return res.status(400).json({ message: '调解员不存在' });
      }

      // 将所有调解员的 isOnDuty 字段设置为 false
      await User.updateMany({ role: 'mediator' }, { isOnDuty: false });

      // 将指定调解员设置为值班状态
      mediator.isOnDuty = true;
      mediator.lastOnDutyDate = new Date();
      await mediator.save();

      res.json({ success: true, message: `已设置 ${mediator.name} 为当日值班调解员` });
    } catch (error) {
      console.error('设置值班调解员失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取当日值班调解员
export const getOnDutyMediator = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const mediator = await User.findOne({ role: 'mediator', isOnDuty: true }).select('-password');
      
      if (!mediator) {
        return res.status(404).json({ message: '当前无值班调解员' });
      }
      
      res.json({ mediator });
    } catch (error) {
      console.error('获取值班调解员失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 获取用户提醒设置
export const getReminderSetting = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      
      let setting = await ReminderSetting.findOne({ userId });
      
      // 如果用户没有设置，创建默认设置
      if (!setting) {
        setting = new ReminderSetting({
          userId,
          reminderTime: '30min',
          notificationChannels: {
            system: true,
            email: true,
            sms: false
          },
          workdayOnly: true,
          caseReminderDays: 15
        });
        await setting.save();
      }
      
      res.json({ setting });
    } catch (error) {
      console.error('获取提醒设置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 更新用户提醒设置
export const updateReminderSetting = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user?.id;
      const { reminderTime, notificationChannels, workdayOnly, caseReminderDays } = req.body;
      
      let setting = await ReminderSetting.findOne({ userId });
      
      // 如果用户没有设置，创建新设置
      if (!setting) {
        setting = new ReminderSetting({
          userId,
          reminderTime: reminderTime || '30min',
          notificationChannels: notificationChannels || {
            system: true,
            email: true,
            sms: false
          },
          workdayOnly: workdayOnly !== undefined ? workdayOnly : true,
          caseReminderDays: caseReminderDays || 15
        });
      } else {
        // 更新设置
        if (reminderTime) setting.reminderTime = reminderTime;
        if (notificationChannels) setting.notificationChannels = notificationChannels;
        if (workdayOnly !== undefined) setting.workdayOnly = workdayOnly;
        if (caseReminderDays !== undefined) setting.caseReminderDays = caseReminderDays;
        setting.updatedAt = new Date();
      }
      
      await setting.save();
      
      res.json({ success: true, setting });
    } catch (error) {
      console.error('更新提醒设置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];
