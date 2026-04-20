const mongoose = require('mongoose');
const Case = require('./src/models/Case');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodongzhongcai', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('数据库连接成功');
  
  // 查询所有案件
  Case.find({}) 
    .exec((err, cases) => {
      if (err) {
        console.error('查询案件错误:', err);
      } else {
        console.log('案件总数:', cases.length);
        console.log('所有案件编号:');
        cases.forEach((caseData, index) => {
          console.log(`${index + 1}. ${caseData.caseNumber}`);
        });
        
        // 检查特定案件编号
        const targetCaseNumber = 'JD20260210008';
        Case.findOne({ caseNumber: targetCaseNumber }, (err, caseData) => {
          if (err) {
            console.error('查询特定案件错误:', err);
          } else if (caseData) {
            console.log(`\n找到案件 ${targetCaseNumber}:`, caseData);
          } else {
            console.log(`\n未找到案件 ${targetCaseNumber}`);
          }
          
          // 关闭数据库连接
          mongoose.connection.close();
        });
      }
    });
}).catch(err => {
  console.error('数据库连接失败:', err);
});