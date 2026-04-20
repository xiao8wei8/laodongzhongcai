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

// 检查用户
const checkUsers = async () => {
  try {
    const users = await User.find({}, { username: 1, name: 1, phone: 1, role: 1, _id: 1 });
    console.log('所有用户:');
    console.log(users);
    
    // 查找personal用户
    const personalUser = await User.findOne({ username: 'personal' });
    if (personalUser) {
      console.log('\nPersonal用户:');
      console.log('ID:', personalUser._id);
      console.log('用户名:', personalUser.username);
      console.log('姓名:', personalUser.name);
      console.log('电话:', personalUser.phone);
      console.log('角色:', personalUser.role);
    } else {
      console.log('\n未找到personal用户');
    }
  } catch (error) {
    console.error('查询用户错误:', error);
  } finally {
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await checkUsers();
};

run();
