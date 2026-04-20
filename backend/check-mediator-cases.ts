import mongoose from 'mongoose';
import User from './src/models/User';
import Case from './src/models/Case';
import VisitorRecord from './src/models/VisitorRecord';
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

// 检查调解员的案件
const checkMediatorCases = async () => {
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
    
    // 检查分配给该调解员的案件
    const cases = await Case.find({ mediatorId: mediator._id });
    console.log(`\n分配给该调解员的案件数量: ${cases.length}`);
    
    if (cases.length > 0) {
      cases.forEach((caseItem, index) => {
        console.log(`案件 ${index + 1}:`, {
          caseNumber: caseItem.caseNumber,
          status: caseItem.status,
          createdAt: caseItem.createdAt,
          mediatorId: caseItem.mediatorId
        });
      });
    }
    
    // 检查该调解员的到访登记
    const visitors = await VisitorRecord.find({ mediatorId: mediator._id });
    console.log(`\n该调解员的到访登记数量: ${visitors.length}`);
    
    if (visitors.length > 0) {
      visitors.forEach((visitor, index) => {
        console.log(`到访登记 ${index + 1}:`, {
          registerNumber: visitor.registerNumber,
          status: visitor.status,
          createdAt: visitor.createdAt,
          mediatorId: visitor.mediatorId
        });
      });
    }
    
    // 检查所有案件
    const allCases = await Case.find({});
    console.log(`\n所有案件数量: ${allCases.length}`);
    allCases.forEach((caseItem, index) => {
      console.log(`案件 ${index + 1}:`, {
        caseNumber: caseItem.caseNumber,
        status: caseItem.status,
        mediatorId: caseItem.mediatorId
      });
    });
    
  } catch (error) {
    console.error('检查调解员案件错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
  }
};

// 执行
const run = async () => {
  await connectDB();
  await checkMediatorCases();
};

run();