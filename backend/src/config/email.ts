// 腾讯云邮件服务配置
const emailConfig = {
  // 腾讯云账号密钥
  secretId: process.env.TENCENT_CLOUD_SECRET_ID || '',
  secretKey: process.env.TENCENT_CLOUD_SECRET_KEY || '',
  
  // 邮件发送配置
  sender: {
    // 发件人地址
    email: process.env.EMAIL_SENDER || 'noreply@your-domain.com',
    // 发件人名称
    name: process.env.EMAIL_SENDER_NAME || '劳动仲裁调解系统',
  },
  
  // 邮件模板
  templates: {
    // 注册成功模板
    registerSuccess: process.env.EMAIL_TEMPLATE_REGISTER_SUCCESS || '',
    // 密码重置模板
    passwordReset: process.env.EMAIL_TEMPLATE_PASSWORD_RESET || '',
    // 案件通知模板
    caseNotification: process.env.EMAIL_TEMPLATE_CASE_NOTIFICATION || '',
  },
  
  // 邮件服务区域
  region: process.env.EMAIL_REGION || 'ap-guangzhou',
  
  // 重试配置
  retry: {
    maxAttempts: 3,
    delay: 1000,
  },
};

export default emailConfig;
