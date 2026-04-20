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

// 调试登录过程
const debugLogin = async () => {
  try {
    const testCases = [
      { username: 'mediator', password: '123456', role: 'mediator' },
      { username: 'admin', password: '123456', role: 'admin' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n测试账号: ${testCase.username} (${testCase.role})`);
      console.log(`密码: ${testCase.password}`);
      
      // 1. 查找用户
      console.log('1. 查找用户...');
      const user = await User.findOne({ username: testCase.username, role: testCase.role });
      
      if (!user) {
        console.log('❌ 用户不存在');
        continue;
      }
      
      console.log('✅ 用户存在:', {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name,
        phone: user.phone
      });
      
      // 2. 验证密码
      console.log('2. 验证密码...');
      const isMatch = await user.matchPassword(testCase.password);
      console.log(`密码验证结果: ${isMatch ? '✅ 成功' : '❌ 失败'}`);
      
      // 3. 测试不同查询条件
      console.log('3. 测试不同查询条件...');
      const userByUsername = await User.findOne({ username: testCase.username });
      console.log(`仅按用户名查询: ${userByUsername ? '找到' : '未找到'}`);
      if (userByUsername) {
        console.log(`  找到的用户角色: ${userByUsername.role}`);
      }
    }
    
  } catch (error) {
    console.error('调试错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await debugLogin();
};

run();