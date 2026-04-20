import mongoose from 'mongoose';
import Broadcast from './src/models/Broadcast';
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

// 检查广播数据
const checkBroadcasts = async () => {
  try {
    // 查找用户名为mediator的调解员
    const mediator = await User.findOne({ username: 'mediator', role: 'mediator' });
    
    if (!mediator) {
      console.log('未找到用户名为mediator的调解员');
      return;
    }
    
    console.log('找到调解员:', {
      id: mediator._id,
      username: mediator.username,
      name: mediator.name,
      role: mediator.role
    });
    
    // 检查该调解员创建的所有广播
    const mediatorBroadcasts = await Broadcast.find({ creatorId: mediator._id });
    
    console.log(`\n该调解员创建的广播数量: ${mediatorBroadcasts.length}`);
    
    if (mediatorBroadcasts.length > 0) {
      mediatorBroadcasts.forEach((broadcast, index) => {
        console.log(`广播 ${index + 1}:`, {
          title: broadcast.title,
          status: broadcast.status,
          type: broadcast.type,
          urgency: broadcast.urgency,
          creatorId: broadcast.creatorId,
          approverId: broadcast.approverId,
          rejectionReason: broadcast.rejectionReason,
          createdAt: broadcast.createdAt
        });
      });
    }
    
    // 检查所有广播
    const allBroadcasts = await Broadcast.find({});
    
    console.log(`\n所有广播数量: ${allBroadcasts.length}`);
    allBroadcasts.forEach((broadcast, index) => {
      console.log(`广播 ${index + 1}:`, {
        title: broadcast.title,
        status: broadcast.status,
        creatorId: broadcast.creatorId,
        approverId: broadcast.approverId
      });
    });
    
  } catch (error) {
    console.error('检查广播错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await checkBroadcasts();
};

run();