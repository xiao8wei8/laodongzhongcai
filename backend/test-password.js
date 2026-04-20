const bcrypt = require('bcryptjs');

// 测试密码验证
async function testPassword() {
  // 从数据库中获取的密码哈希
  const hashedPassword = '$2a$10$3z2owCqctQCQ6NiNQQGTKeIeJOI2L8WpxQbaPpxmGzbmLTGfS5B16'; // admin的密码哈希
  const plainPassword = '123456'; // 测试密码

  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('密码验证结果:', isMatch);
    if (isMatch) {
      console.log('密码验证成功!');
    } else {
      console.log('密码验证失败!');
    }
  } catch (error) {
    console.error('密码验证错误:', error);
  }
}

testPassword();