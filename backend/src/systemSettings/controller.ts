import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import systemSettingsRepository from '../repositories/systemSettingsRepository';

// 获取系统设置
export const getSystemSettings = async (req: express.Request, res: express.Response) => {
  try {
    // 获取所有设置，然后组装成原始格式
    const settings = await systemSettingsRepository.getAllSettings();
    
    const systemIcon = settings['basic.systemIcon'] || 'BankOutlined';
    const isAdmin = req.user?.role === 'superadmin';

    // 构建默认设置对象
    const defaultSettings: any = {
      basic: {
        // 兼容字段：Layout / SystemSettings 页面使用 systemName/systemIcon
        systemName: settings['basic.siteName'] || '劳动争议调解平台',
        systemIcon,
        homeBannerEnabled: settings['basic.homeBannerEnabled'] !== 'false',
        homeBannerTitle: settings['basic.homeBannerTitle'] || '劳动仲裁调解系统',
        homeBannerSubtitle: settings['basic.homeBannerSubtitle'] || '便捷·高效·专业',
        homeBannerImage: settings['basic.homeBannerImage'] || '',
        homeBannerLink: settings['basic.homeBannerLink'] || '',
        homeBannerButtonText: settings['basic.homeBannerButtonText'] || '',
        homeBannerBgStart: settings['basic.homeBannerBgStart'] || '#1890ff',
        homeBannerBgEnd: settings['basic.homeBannerBgEnd'] || '#096dd9',

        // 旧字段（保留兼容）
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
        enablePush: settings['notification.enablePush'] === 'true'
      },
      apiKeys: {
        // API密钥在生产环境中应该从环境变量读取，而不是数据库
        ocr: settings['apiKeys.ocr'] || ''
      }
    };
    
    // 非管理员只返回“公开设置”，避免把敏感 apiKeys 泄露给普通用户
    if (!isAdmin) {
      return res.json({
        basic: {
          systemName: defaultSettings.basic.systemName,
          systemIcon: defaultSettings.basic.systemIcon,
          homeBannerEnabled: defaultSettings.basic.homeBannerEnabled,
          homeBannerTitle: defaultSettings.basic.homeBannerTitle,
          homeBannerSubtitle: defaultSettings.basic.homeBannerSubtitle,
          homeBannerImage: defaultSettings.basic.homeBannerImage,
          homeBannerLink: defaultSettings.basic.homeBannerLink,
          homeBannerButtonText: defaultSettings.basic.homeBannerButtonText,
          homeBannerBgStart: defaultSettings.basic.homeBannerBgStart,
          homeBannerBgEnd: defaultSettings.basic.homeBannerBgEnd
        }
      });
    }

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
      // 兼容前端字段：systemName/systemIcon
      if (basic.systemName !== undefined) await systemSettingsRepository.setValue('basic.siteName', basic.systemName);
      if (basic.systemIcon !== undefined) await systemSettingsRepository.setValue('basic.systemIcon', basic.systemIcon);
      if (basic.homeBannerEnabled !== undefined) await systemSettingsRepository.setValue('basic.homeBannerEnabled', String(basic.homeBannerEnabled));
      if (basic.homeBannerTitle !== undefined) await systemSettingsRepository.setValue('basic.homeBannerTitle', basic.homeBannerTitle);
      if (basic.homeBannerSubtitle !== undefined) await systemSettingsRepository.setValue('basic.homeBannerSubtitle', basic.homeBannerSubtitle);
      if (basic.homeBannerImage !== undefined) await systemSettingsRepository.setValue('basic.homeBannerImage', basic.homeBannerImage);
      if (basic.homeBannerLink !== undefined) await systemSettingsRepository.setValue('basic.homeBannerLink', basic.homeBannerLink);
      if (basic.homeBannerButtonText !== undefined) await systemSettingsRepository.setValue('basic.homeBannerButtonText', basic.homeBannerButtonText);
      if (basic.homeBannerBgStart !== undefined) await systemSettingsRepository.setValue('basic.homeBannerBgStart', basic.homeBannerBgStart);
      if (basic.homeBannerBgEnd !== undefined) await systemSettingsRepository.setValue('basic.homeBannerBgEnd', basic.homeBannerBgEnd);

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
      if (notification.enablePush !== undefined) await systemSettingsRepository.setValue('notification.enablePush', String(notification.enablePush));
    }
    
    // 更新API密钥设置
    if (apiKeys) {
      if (apiKeys.ocr !== undefined) await systemSettingsRepository.setValue('apiKeys.ocr', apiKeys.ocr);
    }
    
    // 获取更新后的设置
    const updatedSettings = await systemSettingsRepository.getAllSettings();
    const resultSettings: any = {
      basic: {
        systemName: updatedSettings['basic.siteName'] || '劳动争议调解平台',
        systemIcon: updatedSettings['basic.systemIcon'] || 'BankOutlined',
        homeBannerEnabled: updatedSettings['basic.homeBannerEnabled'] !== 'false',
        homeBannerTitle: updatedSettings['basic.homeBannerTitle'] || '劳动仲裁调解系统',
        homeBannerSubtitle: updatedSettings['basic.homeBannerSubtitle'] || '便捷·高效·专业',
        homeBannerImage: updatedSettings['basic.homeBannerImage'] || '',
        homeBannerLink: updatedSettings['basic.homeBannerLink'] || '',
        homeBannerButtonText: updatedSettings['basic.homeBannerButtonText'] || '',
        homeBannerBgStart: updatedSettings['basic.homeBannerBgStart'] || '#1890ff',
        homeBannerBgEnd: updatedSettings['basic.homeBannerBgEnd'] || '#096dd9',
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
        enablePush: updatedSettings['notification.enablePush'] === 'true'
      },
      apiKeys: {
        ocr: updatedSettings['apiKeys.ocr'] || ''
      }
    };
    
    res.json({ message: '设置保存成功', settings: resultSettings });
  } catch (error) {
    console.error('更新系统设置错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};
