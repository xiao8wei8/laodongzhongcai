const io = require('socket.io-client');
const axios = require('axios');

// 测试实时通知
async function testRealtimeNotification() {
  // 1. 登录调教员123
  const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
    username: '调教员123',
    password: '123456',
    role: 'mediator'
  });
  
  const token = loginResponse.data.token;
  const userId = loginResponse.data.userInfo.id;
  console.log('登录成功，获取到token');
  
  // 2. 连接Socket.IO
  const socket = io('http://localhost:5002', {
    transports: ['websocket']
  });

  // 连接成功
  socket.on('connect', () => {
    console.log('Socket.IO连接成功');
    
    // 加入用户房间
    socket.emit('joinUserRoom', userId);
    console.log(`加入用户房间 ${userId}`);
    
    // 3. 创建消息
    setTimeout(async () => {
      try {
        const createMessageResponse = await axios.post('http://localhost:5002/api/message', {
          content: '测试实时通知消息',
          type: 'popup',
          recipientId: userId
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('消息创建成功:', createMessageResponse.data);
      } catch (error) {
        console.error('创建消息失败:', error.message);
      }
    }, 1000);
  });

  // 监听新消息
  socket.on('newMessage', (message) => {
    console.log('收到实时新消息:', message);
  });

  // 监听弹窗通知
  socket.on('popupNotification', (notification) => {
    console.log('收到实时弹窗通知:', notification);
  });

  // 连接错误
  socket.on('connect_error', (error) => {
    console.error('Socket.IO连接错误:', error);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket.IO连接断开');
  });

  // 10秒后断开连接
  setTimeout(() => {
    socket.disconnect();
  }, 10000);
}

testRealtimeNotification();