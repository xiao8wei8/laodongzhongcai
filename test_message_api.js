const axios = require('axios');

// 测试消息API
async function testMessageAPI() {
  try {
    // 1. 登录调教员123
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      username: '调教员123',
      password: '123456',
      role: 'mediator'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到token:', token);
    console.log('用户信息:', loginResponse.data.userInfo);
    
    // 2. 获取消息列表
    const messagesResponse = await axios.get('http://localhost:5002/api/message', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取消息列表成功:', messagesResponse.data);
    
    // 3. 获取未读消息数量
    const unreadCountResponse = await axios.get('http://localhost:5002/api/message/unread-count', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('获取未读消息数量成功:', unreadCountResponse.data);
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误响应:', error.response.data);
    }
  }
}

testMessageAPI();