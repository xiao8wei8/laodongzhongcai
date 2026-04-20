import mongoose from 'mongoose';
import Message from './src/models/Message';
import User from './src/models/User';

// 连接数据库
mongoose.connect('mongodb://localhost:27017/laodong').then(async () => {
  console.log('数据库连接成功');
  
  try {
    // 查找调教员123
    const mediator = await User.findOne({ username: '调教员123' });
    if (!mediator) {
      console.error('未找到调教员123');
      mongoose.disconnect();
      return;
    }
    
    console.log('调教员123信息:', mediator);
    
    // 创建测试消息
    const testMessage = new Message({
      content: '测试消息，这是一条来自管理员的留言',
      type: 'system',
      recipientId: mediator._id,
      senderId: mediator._id, // 模拟管理员发送
      caseId: 'test-case-id'
    });
    
    await testMessage.save();
    console.log('测试消息创建成功:', testMessage);
    
    // 查找所有消息
    const messages = await Message.find({ recipientId: mediator._id });
    console.log('调教员123的所有消息:', messages);
    
  } catch (error) {
    console.error('测试消息创建失败:', error);
  } finally {
    // 关闭数据库连接
    mongoose.disconnect();
  }
}).catch(err => {
  console.error('数据库连接失败:', err);
});
