const mongoose = require('mongoose');
const User = require('./src/models/User').default;

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong')
  .then(async () => {
    console.log('MongoDB连接成功');
    
    // 查询用户
    const user = await User.findOne({ username: '调教员123' });
    if (user) {
      console.log('用户存在:', user);
      console.log('用户角色:', user.role);
    } else {
      console.log('用户不存在');
    }
    
    mongoose.disconnect();
  })
  .catch((error) => {
    console.error('MongoDB连接失败:', error);
    mongoose.disconnect();
  });