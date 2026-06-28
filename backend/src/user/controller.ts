import express from 'express';
import { userRepository, reminderSettingRepository } from '../repositories';
import { auth } from '../middleware/auth';

// 获取用户列表
export const getUsers = [
  auth,
  async (req: express.Request, res: express.Response) => {
    try {
      const { role, page = 1, limit = 10 } = req.query;

      const result = await userRepository.paginateUsers(
        Number(page),
        Number(limit),
        role as string
      );

      const usersWithoutPassword = result.users.map(({ password, ...user }) => user);

      res.json({
        users: usersWithoutPassword,
        pagination: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(result.total / Number(limit))
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
      const user = await userRepository.findById(id);

      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
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
      const { name, phone, address, role } = req.body;

      const user = await userRepository.findById(id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      // 构建更新数据
      const updateData: any = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (address) updateData.address = address;
      if (role && req.user?.role === 'admin') updateData.role = role;

      const updatedUser = await userRepository.update(id, updateData);

      const { password, ...userWithoutPassword } = updatedUser!;
      res.json({ success: true, user: userWithoutPassword });
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

      const user = await userRepository.findById(id);
      if (!user) {
        return res.status(404).json({ message: '用户不存在' });
      }

      await userRepository.delete(id);

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
      const { username, password, name, phone, address, role } = req.body;

      // 检查用户名是否已存在
      const existingUser = await userRepository.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: '用户名已存在' });
      }

      // 创建新用户
      const user = await userRepository.create({
        username,
        password, // 密码会在模型中自动加密
        name,
        phone,
        email: `${username}_${Date.now()}@example.com`,
        address,
        role
      } as any);

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ success: true, user: userWithoutPassword });
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
      const mediator = await userRepository.findById(mediatorId);
      if (!mediator || mediator.role !== 'mediator') {
        return res.status(400).json({ message: '调解员不存在' });
      }

      // 使用 userRepository 的 updateDutyStatus 方法
      const updatedMediator = await userRepository.updateDutyStatus(
        mediatorId,
        true,
        new Date()
      );

      res.json({ 
        success: true, 
        message: `已设置 ${updatedMediator?.name} 为当日值班调解员` 
      });
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
      const mediators = await userRepository.findOnDutyMediators();
      const mediator = mediators[0];
      
      if (!mediator) {
        return res.status(404).json({ message: '当前无值班调解员' });
      }
      
      const { password, ...mediatorWithoutPassword } = mediator;
      res.json({ mediator: mediatorWithoutPassword });
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
      
      let settings = await reminderSettingRepository.findByUser(userId!);
      
      // 如果用户没有设置，创建默认设置
      if (settings.length === 0) {
        await reminderSettingRepository.createDefaultSettings(userId!);
        settings = await reminderSettingRepository.findByUser(userId!);
      }
      
      // 转换为原始格式的单个设置对象
      const setting: any = {
        userId,
        reminderTime: '30min',
        notificationChannels: {
          system: true
        },
        workdayOnly: true,
        caseReminderDays: 15
      };
      
      // 更新默认值与数据库中的设置
      settings.forEach(s => {
        if (s.type === 'in_app') {
          setting.notificationChannels.system = s.enabled;
        }
      });
      
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
      
      // 更新通知渠道设置
      if (notificationChannels) {
        if (notificationChannels.system !== undefined) {
          await reminderSettingRepository.upsert(userId!, 'in_app', notificationChannels.system, 15);
        }
      }
      
      const settings = await reminderSettingRepository.findByUser(userId!);
      
      // 构建响应对象
      const setting: any = {
        userId,
        reminderTime: reminderTime || '30min',
        notificationChannels: {
          system: true
        },
        workdayOnly: workdayOnly !== undefined ? workdayOnly : true,
        caseReminderDays: caseReminderDays || 15
      };
      
      // 更新响应对象与数据库中的设置
      settings.forEach(s => {
        if (s.type === 'in_app') {
          setting.notificationChannels.system = s.enabled;
        }
      });
      
      res.json({ success: true, setting });
    } catch (error) {
      console.error('更新提醒设置失败:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];
