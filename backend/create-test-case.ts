import mongoose from 'mongoose';
import Case from './src/models/Case';
import User from './src/models/User';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 查找调教员123
    const mediator = await User.findOne({ username: '调教员123' });
    if (!mediator) {
      console.error('未找到调教员123');
      mongoose.disconnect();
      return;
    }
    
    console.log('调教员123信息:', mediator);
    
    // 创建测试案件
    const testCase = new Case({
      caseNumber: 'JD20260226001',
      applicantId: mediator._id, // 用调教员作为申请人（测试用）
      respondentId: mediator._id, // 用调教员作为被申请人（测试用）
      disputeType: '工资纠纷',
      caseAmount: 10000,
      requestItems: '支付拖欠工资',
      factsReasons: '公司拖欠工资三个月',
      status: 'processing',
      mediatorId: mediator._id
    });
    
    await testCase.save();
    console.log('测试案件创建成功:', testCase);
    
  } catch (error) {
    console.error('测试案件创建失败:', error);
  } finally {
    // 关闭数据库连接
    mongoose.disconnect();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});
