import mongoose from 'mongoose';
import User from './src/models/User';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 连接数据库
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/laodong');
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
};

// 重新创建测试账号
const recreateTestAccounts = async () => {
  try {
    // 先删除现有的测试账号
    const testUsernames = ['mediator', 'admin', 'personal', 'company'];
    
    for (const username of testUsernames) {
      const result = await User.deleteMany({ username });
      console.log(`删除账号 ${username}: ${result.deletedCount} 个文档`);
    }
    
    // 重新创建测试账号
    const testAccounts = [
      { username: 'mediator', password: '123456', name: '调解员', phone: '13800138001', role: 'mediator' as const },
      { username: 'admin', password: '123456', name: '管理员', phone: '13800138002', role: 'admin' as const },
      { username: 'personal', password: '123456', name: '个人用户', phone: '13800138003', role: 'personal' as const },
      { username: 'company', password: '123456', name: '企业用户', phone: '13800138004', role: 'company' as const }
    ];
    
    for (const account of testAccounts) {
      // 创建新用户
      const user = new User(account);
      await user.save();
      console.log(`创建账号 ${account.username} (${account.role}) 成功`);
      
      // 验证密码
      const isMatch = await user.matchPassword(account.password);
      console.log(`  密码验证: ${isMatch ? '✅ 成功' : '❌ 失败'}`);
    }
    
    console.log('测试账号重新创建完成');
  } catch (error) {
    console.error('重新创建测试账号错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await recreateTestAccounts();
};

run();