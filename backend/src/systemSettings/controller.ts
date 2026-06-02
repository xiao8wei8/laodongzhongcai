import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import systemSettingsRepository from '../repositories/systemSettingsRepository';

// 获取系统设置
export const getSystemSettings = async (req: express.Request, res: express.Response) => {
  try {
    // 获取所有设置，然后组装成原始格式
    const settings = await systemSettingsRepository.getAllSettings();
    
    // 构建默认设置对象
    const defaultSettings: any = {
      basic: {
        siteName: settings['basic.siteName'] || '劳动争议调解平台',
        siteDescription: settings['basic.siteDescription'] || '专业的劳动争议调解服务平台',
        workStartTime: settings['basic.workStartTime'] || '09:00',
        workEndTime: settings['basic.workEndTime'] || '18:00',
        workDays: settings['basic.workDays'] || '[1,2,3,4,5]'
      },
      security: {
        passwordMinLength: parseInt(settings['security.passwordMinLength'] || '8'),
        sessionTimeout: parseInt(settings['security.sessionTimeout'] || '1800'),
        maxLoginAttempts: parseInt(settings['security.maxLoginAttempts'] || '5'),
        lockoutDuration: parseInt(settings['security.lockoutDuration'] || '900')
      },
      notification: {
        enableEmail: settings['notification.enableEmail'] === 'true',
        enableSms: settings['notification.enableSms'] === 'true',
        enablePush: settings['notification.enablePush'] === 'true'
      },
      apiKeys: {
        // API密钥在生产环境中应该从环境变量读取，而不是数据库
        ocr: settings['apiKeys.ocr'] || '',
        sms: settings['apiKeys.sms'] || '',
        email: settings['apiKeys.email'] || ''
      }
    };
    
    res.json(defaultSettings);
  } catch (error) {
    console.error('获取系统设置错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 更新系统设置
export const updateSystemSettings = async (req: express.Request, res: express.Response) => {
  try {
    const { basic, security, notification, apiKeys } = req.body;
    
    // 更新基本设置
    if (basic) {
      if (basic.siteName !== undefined) await systemSettingsRepository.setValue('basic.siteName', basic.siteName);
      if (basic.siteDescription !== undefined) await systemSettingsRepository.setValue('basic.siteDescription', basic.siteDescription);
      if (basic.workStartTime !== undefined) await systemSettingsRepository.setValue('basic.workStartTime', basic.workStartTime);
      if (basic.workEndTime !== undefined) await systemSettingsRepository.setValue('basic.workEndTime', basic.workEndTime);
      if (basic.workDays !== undefined) await systemSettingsRepository.setValue('basic.workDays', JSON.stringify(basic.workDays));
    }
    
    // 更新安全设置
    if (security) {
      if (security.passwordMinLength !== undefined) await systemSettingsRepository.setValue('security.passwordMinLength', String(security.passwordMinLength));
      if (security.sessionTimeout !== undefined) await systemSettingsRepository.setValue('security.sessionTimeout', String(security.sessionTimeout));
      if (security.maxLoginAttempts !== undefined) await systemSettingsRepository.setValue('security.maxLoginAttempts', String(security.maxLoginAttempts));
      if (security.lockoutDuration !== undefined) await systemSettingsRepository.setValue('security.lockoutDuration', String(security.lockoutDuration));
    }
    
    // 更新通知设置
    if (notification) {
      if (notification.enableEmail !== undefined) await systemSettingsRepository.setValue('notification.enableEmail', String(notification.enableEmail));
      if (notification.enableSms !== undefined) await systemSettingsRepository.setValue('notification.enableSms', String(notification.enableSms));
      if (notification.enablePush !== undefined) await systemSettingsRepository.setValue('notification.enablePush', String(notification.enablePush));
    }
    
    // 更新API密钥设置
    if (apiKeys) {
      if (apiKeys.ocr !== undefined) await systemSettingsRepository.setValue('apiKeys.ocr', apiKeys.ocr);
      if (apiKeys.sms !== undefined) await systemSettingsRepository.setValue('apiKeys.sms', apiKeys.sms);
      if (apiKeys.email !== undefined) await systemSettingsRepository.setValue('apiKeys.email', apiKeys.email);
    }
    
    // 获取更新后的设置
    const updatedSettings = await systemSettingsRepository.getAllSettings();
    const resultSettings: any = {
      basic: {
        siteName: updatedSettings['basic.siteName'] || '劳动争议调解平台',
        siteDescription: updatedSettings['basic.siteDescription'] || '专业的劳动争议调解服务平台',
        workStartTime: updatedSettings['basic.workStartTime'] || '09:00',
        workEndTime: updatedSettings['basic.workEndTime'] || '18:00',
        workDays: JSON.parse(updatedSettings['basic.workDays'] || '[1,2,3,4,5]')
      },
      security: {
        passwordMinLength: parseInt(updatedSettings['security.passwordMinLength'] || '8'),
        sessionTimeout: parseInt(updatedSettings['security.sessionTimeout'] || '1800'),
        maxLoginAttempts: parseInt(updatedSettings['security.maxLoginAttempts'] || '5'),
        lockoutDuration: parseInt(updatedSettings['security.lockoutDuration'] || '900')
      },
      notification: {
        enableEmail: updatedSettings['notification.enableEmail'] === 'true',
        enableSms: updatedSettings['notification.enableSms'] === 'true',
        enablePush: updatedSettings['notification.enablePush'] === 'true'
      },
      apiKeys: {
        ocr: updatedSettings['apiKeys.ocr'] || '',
        sms: updatedSettings['apiKeys.sms'] || '',
        email: updatedSettings['apiKeys.email'] || ''
      }
    };
    
    res.json({ message: '设置保存成功', settings: resultSettings });
  } catch (error) {
    console.error('更新系统设置错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
