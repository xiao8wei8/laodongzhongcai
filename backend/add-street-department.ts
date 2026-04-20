import mongoose from 'mongoose';
import User from './src/models/User';

// 模拟街道和科室数据
const streets = [
  '朝阳区',
  '海淀区',
  '东城区',
  '西城区',
  '丰台区',
  '石景山区',
  '通州区',
  '顺义区',
  '昌平区',
  '大兴区'
];

const departments = [
  '调解科',
  '仲裁科',
  '综合科',
  '法务科',
  '行政科',
  '财务科',
  '人事科',
  '信息科',
  '信访科',
  '宣传科'
];

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong')
  .then(async () => {
    console.log('数据库连接成功');
    
    // 获取所有用户
    const users = await User.find({});
    console.log(`找到 ${users.length} 个用户`);
    
    // 为每个用户添加街道和科室信息
    for (let user of users) {
      if (!user.street || !user.department) {
        // 随机分配街道和科室
        const randomStreet = streets[Math.floor(Math.random() * streets.length)];
        const randomDepartment = departments[Math.floor(Math.random() * departments.length)];
        
        // 为用户添加职位和办公室电话
        if (!user.position) {
          user.position = '工作人员';
        }
        if (!user.officePhone) {
          user.officePhone = `010-${Math.floor(Math.random() * 90000000 + 10000000)}`;
        }
        
        user.street = randomStreet;
        user.department = randomDepartment;
        
        await user.save();
        console.log(`更新用户 ${user.username} - ${randomStreet} - ${randomDepartment}`);
      }
    }
    
    console.log('所有用户已更新');
    mongoose.disconnect();
  })
  .catch(error => {
    console.error('数据库连接失败:', error);
  });
