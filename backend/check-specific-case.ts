import mongoose from 'mongoose';
import Case from './src/models/Case';
import User from './src/models/User';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodongzhongcai').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 检查特定案件编号
    const targetCaseNumber = 'JD20260226001';
    const caseData = await Case.findOne({ caseNumber: targetCaseNumber }).populate('mediatorId');
    if (caseData) {
      console.log(`找到案件 ${targetCaseNumber}:`, caseData);
      console.log('调解员信息:', caseData.mediatorId);
    } else {
      console.log(`未找到案件 ${targetCaseNumber}`);
    }
    
    // 检查调教员123
    const mediator = await User.findOne({ username: '调教员123' });
    if (mediator) {
      console.log('调教员123信息:', mediator);
    } else {
      console.log('未找到调教员123');
    }
    
    // 检查所有案件
    const allCases = await Case.find({});
    console.log('所有案件:', allCases);
  } catch (error) {
    console.error('查询案件错误:', error);
  } finally {
    // 关闭数据库连接
    mongoose.connection.close();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});