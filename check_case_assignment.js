const mongoose = require('mongoose');

// 定义模型
const CaseSchema = new mongoose.Schema({
  caseNumber: String,
  mediatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: String,
  createdAt: Date
});

const UserSchema = new mongoose.Schema({
  username: String,
  name: String,
  role: String
});

const Case = mongoose.model('Case', CaseSchema);
const User = mongoose.model('User', UserSchema);

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong')
  .then(async () => {
    console.log('MongoDB连接成功');
    
    // 查找调教员123用户
    const mediator = await User.findOne({ username: '调教员123' });
    if (mediator) {
      console.log('调教员123信息:', {
        id: mediator._id.toString(),
        name: mediator.name,
        role: mediator.role
      });
      
      // 查找JD20260226001案件
      const caseObj = await Case.findOne({ caseNumber: 'JD20260226001' }).populate('mediatorId');
      if (caseObj) {
        console.log('JD20260226001案件信息:', {
          caseNumber: caseObj.caseNumber,
          status: caseObj.status,
          mediator: caseObj.mediatorId ? {
            id: caseObj.mediatorId._id.toString(),
            name: caseObj.mediatorId.name,
            username: caseObj.mediatorId.username
          } : '未分配',
          createdAt: caseObj.createdAt
        });
        
        // 检查是否分配给调教员123
        if (caseObj.mediatorId && caseObj.mediatorId._id.toString() === mediator._id.toString()) {
          console.log('✅ 案件正确分配给调教员123');
        } else {
          console.log('❌ 案件未分配给调教员123');
        }
      } else {
        console.log('❌ 未找到JD20260226001案件');
      }
    } else {
      console.log('❌ 调教员123用户不存在');
    }
    
    mongoose.disconnect();
  })
  .catch((error) => {
    console.error('MongoDB连接失败:', error);
    mongoose.disconnect();
  });