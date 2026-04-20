import mongoose from 'mongoose';
import axios from 'axios';
import User from './src/models/User';
import VisitorRecord from './src/models/VisitorRecord';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 1. 创建测试数据
    console.log('=== 创建测试数据 ===');
    
    // 创建测试调解员
    const username = 'test-mediator-' + new Date().getTime();
    const mediator = await User.create({
      username: username,
      password: '123456',
      name: '测试调解员',
      phone: '13900139000',
      role: 'mediator',
      email: username + '@example.com'
    });
    console.log('创建测试调解员:', mediator.name);
    
    // 创建测试到访登记记录
    const registerNumber = 'JD' + new Date().getTime();
    const visitorRecord = await VisitorRecord.create({
      registerNumber: registerNumber,
      visitorName: '测试访客',
      phone: '13800138000',
      visitType: 'visit',
      disputeType: '工资纠纷',
      reason: '测试纠纷',
      mediatorId: null
    });
    console.log('创建测试到访登记记录:', visitorRecord.registerNumber);
    
    // 2. 测试分配调解员
    console.log('\n=== 测试分配调解员 ===');
    
    const assignResponse = await axios.put(
      'http://localhost:5002/api/case/' + visitorRecord._id + '/mediator',
      { mediatorId: mediator._id },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('分配调解员响应:', assignResponse.data);
    
    // 3. 测试获取案件详情
    console.log('\n=== 测试获取案件详情 ===');
    
    const detailResponse = await axios.get(
      'http://localhost:5002/api/case/' + visitorRecord._id
    );
    
    const caseData = (detailResponse.data as any).case;
    console.log('案件详情响应:', caseData);
    console.log('调解员信息:', caseData.mediatorId);
    
    // 4. 验证结果
    console.log('\n=== 验证结果 ===');
    if (caseData.mediatorId.name === mediator.name) {
      console.log('✅ 测试通过：调解员信息正确更新');
    } else {
      console.log('❌ 测试失败：调解员信息未更新');
      console.log('期望:', mediator.name);
      console.log('实际:', caseData.mediatorId.name);
    }
    
    // 5. 清理测试数据
    console.log('\n=== 清理测试数据 ===');
    await User.findByIdAndDelete(mediator._id);
    await VisitorRecord.findByIdAndDelete(visitorRecord._id);
    console.log('测试数据清理完成');
    
  } catch (error: any) {
    console.error('测试错误:', error.message);
  } finally {
    // 关闭数据库连接
    mongoose.connection.close();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});