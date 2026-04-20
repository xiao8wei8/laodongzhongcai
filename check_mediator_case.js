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
      
      // 查找分配给该调解员的案件
      const cases = await Case.find({ mediatorId: mediator._id });
      console.log('分配给调教员123的案件数量:', cases.length);
      cases.forEach((caseObj, index) => {
        console.log(`案件${index + 1}:`, {
          caseNumber: caseObj.caseNumber,
          status: caseObj.status,
          createdAt: caseObj.createdAt
        });
      });
    } else {
      console.log('调教员123用户不存在');
    }
    
    mongoose.disconnect();
  })
  .catch((error) => {
    console.error('MongoDB连接失败:', error);
    mongoose.disconnect();
  });