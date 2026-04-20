const mongoose = require('mongoose');

// 定义用户模式
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true
  },
  address: {
    type: String
  },
  role: {
    type: String,
    required: true,
    enum: ['mediator', 'admin', 'personal', 'company']
  },
  isOnDuty: {
    type: Boolean,
    default: false
  },
  lastOnDutyDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const User = mongoose.model('User', UserSchema);

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong')
  .then(async () => {
    console.log('MongoDB连接成功');
    
    // 检查用户是否存在
    const existingUser = await User.findOne({ username: '调教员123' });
    if (existingUser) {
      console.log('用户已存在:', existingUser);
    } else {
      // 创建新用户
      const newUser = new User({
        username: '调教员123',
        password: '123456', // 密码会在保存时加密
        name: '调教员123',
        phone: '13800138000',
        email: 'tutor123@example.com',
        role: 'mediator'
      });
      
      await newUser.save();
      console.log('用户创建成功:', newUser);
    }
    
    mongoose.disconnect();
  })
  .catch((error) => {
    console.error('MongoDB连接失败:', error);
    mongoose.disconnect();
  });