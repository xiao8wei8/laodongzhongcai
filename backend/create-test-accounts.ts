import mongoose from 'mongoose';
import User from './src/models/User';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 连接数据库
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/laodongzhongcai');
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
};

// 测试账号配置
const testAccounts = [
  { username: 'mediator', password: '123456', name: '调解员', phone: '13800138001', role: 'mediator' as const },
  { username: 'admin', password: '123456', name: '管理员', phone: '13800138002', role: 'admin' as const },
  { username: 'personal', password: '123456', name: '个人用户', phone: '13800138003', role: 'personal' as const },
  { username: 'company', password: '123456', name: '企业用户', phone: '13800138004', role: 'company' as const }
];

// 检查并创建测试账号
const createTestAccounts = async () => {
  try {
    for (const account of testAccounts) {
      // 检查账号是否存在
      const existingUser = await User.findOne({ username: account.username, role: account.role });
      
      if (existingUser) {
        console.log(`账号 ${account.username} (${account.role}) 已存在`);
      } else {
        // 创建新账号
        const user = new User(account);
        await user.save();
        console.log(`创建账号 ${account.username} (${account.role}) 成功`);
      }
    }
    
    console.log('测试账号检查完成');
  } catch (error) {
    console.error('创建测试账号错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await createTestAccounts();
};

run();