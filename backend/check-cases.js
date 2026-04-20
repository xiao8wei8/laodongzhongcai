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
    .populate(['applicantId', 'respondentId', 'mediatorId'])
    .exec((err, cases) => {
      if (err) {
        console.error('查询案件错误:', err);
      } else {
        console.log('案件总数:', cases.length);
        console.log('案件详情:');
        cases.forEach((caseData, index) => {
          console.log(`\n案件 ${index + 1}:`);
          console.log('编号:', caseData.caseNumber);
          console.log('申请人:', caseData.applicantId?.name);
          console.log('被申请人:', caseData.respondentId?.name);
          console.log('状态:', caseData.status);
          console.log('调解员:', caseData.mediatorId?.name);
          console.log('创建时间:', caseData.createdAt);
        });
      }
      
      // 关闭数据库连接
      mongoose.connection.close();
    });
}).catch(err => {
  console.error('数据库连接失败:', err);
});