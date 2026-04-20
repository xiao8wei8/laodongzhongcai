import mongoose from 'mongoose';
import Case from './src/models/Case';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodongzhongcai').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 查询所有案件
    const cases = await Case.find({});
    console.log('案件总数:', cases.length);
    console.log('所有案件编号:');
    cases.forEach((caseData, index) => {
      console.log(`${index + 1}. ${caseData.caseNumber}`);
    });
    
    // 检查特定案件编号
    const targetCaseNumber = 'JD20260210008';
    const caseData = await Case.findOne({ caseNumber: targetCaseNumber });
    if (caseData) {
      console.log(`\n找到案件 ${targetCaseNumber}:`, caseData);
    } else {
      console.log(`\n未找到案件 ${targetCaseNumber}`);
    }
  } catch (error) {
    console.error('查询案件错误:', error);
  } finally {
    // 关闭数据库连接
    mongoose.connection.close();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});