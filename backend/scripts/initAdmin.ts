import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/laodongzhongcai';

async function initAdminUser() {
  try {
    console.log('正在连接数据库...');
    await mongoose.connect(MONGO_URI);
    console.log('数据库连接成功');

    // 定义用户模型
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      name: { type: String, required: true },
      phone: { type: String },
      email: { type: String },
      role: { type: String, enum: ['personal', 'company', 'mediator', 'admin'], required: true },
      idCard: { type: String },
      companyName: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    // 检查是否已存在管理员
    const existingAdmin = await User.findOne({ username: 'admin', role: 'admin' });

    if (existingAdmin) {
      console.log('管理员用户已存在');
      console.log('管理员信息:', {
        username: existingAdmin.username,
        name: existingAdmin.name,
        role: existingAdmin.role,
        createdAt: existingAdmin.createdAt
      });
    } else {
      // 创建管理员用户
      const hashedPassword = await bcrypt.hash('123456', 10);

      const adminUser = new User({
        username: 'admin',
        password: hashedPassword,
        name: '系统管理员',
        phone: '13800138000',
        email: 'admin@example.com',
        role: 'admin',
        idCard: '110101197001010011',
        companyName: '劳动仲裁调解中心'
      });

      await adminUser.save();
      console.log('管理员用户创建成功！');
      console.log('登录信息:');
      console.log('  用户名: admin');
      console.log('  密码: 123456');
    }

    // 创建一些测试用户
    const testUsers = [
      {
        username: 'mediator1',
        password: await bcrypt.hash('123456', 10),
        name: '调解员张三',
        phone: '13800138001',
        email: 'mediator1@example.com',
        role: 'mediator',
        idCard: '110101197001010012',
        companyName: '劳动仲裁调解中心'
      },
      {
        username: 'user1',
        password: await bcrypt.hash('123456', 10),
        name: '李四',
        phone: '13800138002',
        email: 'user1@example.com',
        role: 'personal',
        idCard: '110101197001010013'
      }
    ];

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ username: userData.username });
      if (!existingUser) {
        await User.create(userData);
        console.log(`测试用户 ${userData.username} 创建成功`);
      }
    }

    console.log('\n初始化完成！');
    console.log('\n可用用户:');
    console.log('  管理员: admin / 123456');
    console.log('  调解员: mediator1 / 123456');
    console.log('  个人用户: user1 / 123456');

  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

initAdminUser();
