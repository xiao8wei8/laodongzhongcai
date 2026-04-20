import mongoose from 'mongoose';
import VisitorRecord from './src/models/VisitorRecord';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 查询所有到访登记记录
    const visitorRecords = await VisitorRecord.find({});
    console.log('到访登记记录总数:', visitorRecords.length);
    console.log('所有到访登记记录:');
    visitorRecords.forEach((record, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log('编号:', record.registerNumber);
      console.log('访客姓名:', record.visitorName);
      console.log('电话:', record.phone);
      console.log('争议类型:', record.disputeType);
      console.log('创建时间:', record.createdAt);
    });
  } catch (error) {
    console.error('查询到访登记记录错误:', error);
  } finally {
    // 关闭数据库连接
    mongoose.connection.close();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});