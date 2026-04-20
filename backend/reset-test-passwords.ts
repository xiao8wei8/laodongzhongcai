import mongoose from 'mongoose';
import User from './src/models/User';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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

// 重置测试账号密码
const resetTestPasswords = async () => {
  try {
    const testAccounts = [
      { username: 'mediator', role: 'mediator' },
      { username: 'admin', role: 'admin' },
      { username: 'personal', role: 'personal' },
      { username: 'company', role: 'company' }
    ];
    
    const password = '123456';
    
    for (const account of testAccounts) {
      const user = await User.findOne({ username: account.username, role: account.role });
      
      if (user) {
        // 手动加密密码并更新
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        user.password = hashedPassword;
        await user.save();
        
        console.log(`重置账号 ${account.username} (${account.role}) 的密码成功`);
      } else {
        console.log(`账号 ${account.username} (${account.role}) 不存在`);
      }
    }
    
    console.log('密码重置完成');
  } catch (error) {
    console.error('重置密码错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await resetTestPasswords();
};

run();