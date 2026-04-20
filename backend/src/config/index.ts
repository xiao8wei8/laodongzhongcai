import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 基础配置
const baseConfig = {
  port: process.env.PORT || 5003,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/labor-arbitration',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  ocr: {
    service: process.env.OCR_SERVICE || 'local',
    baidu: {
      apiKey: process.env.BAIDU_OCR_API_KEY || '',
      secretKey: process.env.BAIDU_OCR_SECRET_KEY || ''
    },
    aliyun: {
      accessKeyId: process.env.ALIYUN_OCR_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_OCR_ACCESS_KEY_SECRET || ''
    },
    tencent: {
      secretId: process.env.TENCENT_OCR_SECRET_ID || '',
      secretKey: process.env.TENCENT_OCR_SECRET_KEY || ''
    },
    aliqwen: {
      apiKey: process.env.ALI_AIQIANWEN_API_KEY || '',
      model: process.env.ALI_AIQIANWEN_MODEL || 'qwen-turbo'
    }
  }
};

// 导入服务配置
import smsConfig from './sms';
import emailConfig from './email';

// 导出完整配置
const config = {
  ...baseConfig,
  sms: smsConfig,
  email: emailConfig,
};

export default config;
