const axios = require('axios');

// 测试发送留言
async function testSendMessage() {
  try {
    // 1. 登录调教员123
    const loginResponse = await axios.post('http://localhost:5002/api/auth/login', {
      username: '调教员123',
      password: '123456',
      role: 'mediator'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到token:', token);
    
    // 2. 发送留言
    const caseId = 'LA20240101001'; // 假设的案件编号
    const response = await axios.post(`http://localhost:5002/api/case/${caseId}/progress`, {
      content: '测试消息，这是一条来自调教员的留言',
      type: 'mediate',
      notificationType: ['system', 'popup']
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('留言发送成功:', response.data);
    
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

testSendMessage();