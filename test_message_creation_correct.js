const axios = require('axios');

// 测试创建消息
async function testCreateMessage() {
  try {
    // 1. 登录调教员123
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      username: '调教员123',
      password: '123456',
      role: 'mediator'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到token');
    
    // 2. 直接使用消息API创建消息
    const createMessageResponse = await axios.post('http://localhost:5002/api/message', {
      content: '测试消息，这是一条直接创建的消息',
      type: 'system',
      recipientId: loginResponse.data.userInfo.id
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('消息创建成功:', createMessageResponse.data);
    
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

testCreateMessage();