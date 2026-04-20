import express from 'express';
import SystemSettings from '../models/SystemSettings';

// 获取系统设置
export const getSystemSettings = async (req: express.Request, res: express.Response) => {
  try {
    let settings = await SystemSettings.findOne();
    
    // 如果没有设置记录，创建默认设置
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('获取系统设置错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 更新系统设置
export const updateSystemSettings = async (req: express.Request, res: express.Response) => {
  try {
    const { basic, security, notification, apiKeys } = req.body;
    
    let settings = await SystemSettings.findOne();
    
    // 如果没有设置记录，创建新记录
    if (!settings) {
      settings = new SystemSettings();
    }
    
    // 更新设置
    if (basic) settings.basic = basic;
    if (security) settings.security = security;
    if (notification) settings.notification = notification;
    if (apiKeys) settings.apiKeys = apiKeys;
    
    await settings.save();
    
    res.json({ message: '设置保存成功', settings });
  } catch (error) {
    console.error('更新系统设置错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};