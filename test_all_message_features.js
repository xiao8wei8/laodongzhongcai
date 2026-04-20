const axios = require('axios');
const io = require('socket.io-client');

// 综合测试所有消息功能
async function testAllMessageFeatures() {
  try {
    console.log('开始测试消息系统所有功能...');
    
    // 1. 登录调教员123
    console.log('1. 登录调教员123');
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      username: '调教员123',
      password: '123456',
      role: 'mediator'
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.userInfo.id;
    console.log('登录成功，用户ID:', userId);
    
    // 2. 连接Socket.IO
    console.log('2. 连接Socket.IO');
    const socket = io('http://localhost:5002', {
      transports: ['websocket']
    });

    // 连接成功
    socket.on('connect', () => {
      console.log('Socket.IO连接成功');
      
      // 加入用户房间
      socket.emit('joinUserRoom', userId);
      console.log(`加入用户房间 ${userId}`);
    });

    // 监听新消息
    socket.on('newMessage', (message) => {
      console.log('收到实时新消息:', message);
    });

    // 监听弹窗通知
    socket.on('popupNotification', (notification) => {
      console.log('收到实时弹窗通知:', notification);
    });

    // 3. 测试消息创建
    console.log('3. 测试消息创建');
    const createMessageResponse = await axios.post('http://localhost:5002/api/message', {
      content: '综合测试消息，这是一条系统消息',
      type: 'system',
      recipientId: userId
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('系统消息创建成功:', createMessageResponse.data.message._id);
    
    // 4. 测试弹窗消息
    console.log('4. 测试弹窗消息');
    const createPopupResponse = await axios.post('http://localhost:5002/api/message', {
      content: '综合测试消息，这是一条弹窗提醒',
      type: 'popup',
      recipientId: userId
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('弹窗消息创建成功:', createPopupResponse.data.message._id);
    
    // 5. 测试获取消息列表
    console.log('5. 测试获取消息列表');
    const messagesResponse = await axios.get('http://localhost:5002/api/message', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取消息列表成功，消息数量:', messagesResponse.data.messages.length);
    console.log('消息列表:', messagesResponse.data.messages);
    
    // 6. 测试获取未读消息数量
    console.log('6. 测试获取未读消息数量');
    const unreadCountResponse = await axios.get('http://localhost:5002/api/message/unread-count', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取未读消息数量成功:', unreadCountResponse.data.count);
    
    // 7. 测试标记消息为已读
    if (messagesResponse.data.messages.length > 0) {
      console.log('7. 测试标记消息为已读');
      const messageId = messagesResponse.data.messages[0]._id;
      const markReadResponse = await axios.put(`http://localhost:5002/api/message/${messageId}/read`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('标记消息为已读成功:', markReadResponse.data.success);
    }
    
    // 8. 测试标记所有消息为已读
    console.log('8. 测试标记所有消息为已读');
    const markAllReadResponse = await axios.put('http://localhost:5002/api/message/read-all', {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('标记所有消息为已读成功:', markAllReadResponse.data.success);
    
    // 9. 再次获取未读消息数量
    console.log('9. 再次获取未读消息数量');
    const finalUnreadCountResponse = await axios.get('http://localhost:5002/api/message/unread-count', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('最终未读消息数量:', finalUnreadCountResponse.data.count);
    
    // 10. 断开Socket.IO连接
    setTimeout(() => {
      socket.disconnect();
      console.log('Socket.IO连接断开');
      console.log('所有测试完成！');
    }, 2000);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
  }
}

testAllMessageFeatures();