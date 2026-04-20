const axios = require('axios');
const io = require('socket.io-client');

// 测试当前的弹窗通知功能
async function testPopupNow() {
  try {
    console.log('开始测试当前弹窗通知功能...');
    
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

    let connected = false;
    
    // 连接成功
    socket.on('connect', () => {
      console.log('Socket.IO连接成功');
      connected = true;
      
      // 加入用户房间
      socket.emit('joinUserRoom', userId);
      console.log(`加入用户房间 ${userId}`);
      
      // 3. 创建弹窗消息
      setTimeout(async () => {
        try {
          console.log('3. 创建弹窗消息');
          const createPopupResponse = await axios.post('http://localhost:5002/api/message', {
            content: '测试当前弹窗通知功能',
            type: 'popup',
            recipientId: userId
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log('弹窗消息创建成功:', createPopupResponse.data.message._id);
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
      console.log('弹窗功能正常工作！');
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
      console.log('测试完成！');
    }, 10000);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
  }
}

testPopupNow();