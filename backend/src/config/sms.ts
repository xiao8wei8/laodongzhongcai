// 腾讯云短信服务配置
const smsConfig = {
  // 腾讯云账号密钥
  secretId: process.env.TENCENT_CLOUD_SECRET_ID || '',
  secretKey: process.env.TENCENT_CLOUD_SECRET_KEY || '',
  
  // 短信应用ID
  sdkAppId: process.env.SMS_SDK_APP_ID || '',
  
  // 签名
  signName: process.env.SMS_SIGN_NAME || '劳动仲裁调解系统',
  
  // 模板ID
  templateIds: {
    // 验证码模板
    verification: process.env.SMS_TEMPLATE_VERIFICATION || '',
    // 通知模板
    notification: process.env.SMS_TEMPLATE_NOTIFICATION || '',
    // 注册成功模板
    registerSuccess: process.env.SMS_TEMPLATE_REGISTER_SUCCESS || '',
  },
  
  // 短信服务区域
  region: process.env.SMS_REGION || 'ap-guangzhou',
  
  // 重试配置
  retry: {
    maxAttempts: 3,
    delay: 1000,
  },
};

export default smsConfig;
