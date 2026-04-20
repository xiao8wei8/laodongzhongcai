const axios = require('axios');

// 测试弹窗提醒
async function testPopupMessage() {
  try {
    // 1. 登录调教员123
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      username: '调教员123',
      password: '123456',
      role: 'mediator'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到token');
    
    // 2. 创建弹窗类型的消息
    const createMessageResponse = await axios.post('http://localhost:5002/api/message', {
      content: '测试弹窗消息，这是一条弹窗提醒',
      type: 'popup',
      recipientId: loginResponse.data.userInfo.id
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('弹窗消息创建成功:', createMessageResponse.data);
    
    // 3. 获取消息列表
    const messagesResponse = await axios.get('http://localhost:5002/api/message', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取消息列表成功:', messagesResponse.data);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
  }
}

testPopupMessage();