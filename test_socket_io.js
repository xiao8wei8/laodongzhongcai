const io = require('socket.io-client');

// 测试Socket.IO连接
function testSocketIO() {
  // 连接到Socket.IO服务器
  const socket = io('http://localhost:5002', {
    transports: ['websocket']
  });

  // 连接成功
  socket.on('connect', () => {
    console.log('Socket.IO连接成功');
    
    // 加入用户房间
    const userId = '69a9a6d917bcb1d9978a5222'; // 调教员123的ID
    socket.emit('joinUserRoom', userId);
    console.log(`加入用户房间 ${userId}`);
  });

  // 监听新消息
  socket.on('newMessage', (message) => {
    console.log('收到新消息:', message);
  });

  // 监听弹窗通知
  socket.on('popupNotification', (notification) => {
    console.log('收到弹窗通知:', notification);
  });

  // 连接错误
  socket.on('connect_error', (error) => {
    console.error('Socket.IO连接错误:', error);
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket.IO连接断开');
  });

  // 5秒后断开连接
  setTimeout(() => {
    socket.disconnect();
  }, 5000);
}

testSocketIO();