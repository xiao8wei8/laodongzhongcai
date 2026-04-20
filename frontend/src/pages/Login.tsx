import { useState } from 'react';
import { Button, Card, Form, Input, Select, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import useAuthStore from '../store/authStore';
import { useNavigate, Link } from 'react-router-dom';

const { Option } = Select;

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { login, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    console.log('表单提交:', values);
    setLoading(true);
    clearError();
    
    try {
      await login(values.username, values.password, values.role);
      message.success('登录成功');
      console.log('登录成功，跳转到dashboard');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('登录失败:', err.message);
      message.error(error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f0f2f5'
    }}>
      <Card 
        title="劳动仲裁调解系统" 
        style={{ 
          width: '90%', 
          maxWidth: 500, 
          borderRadius: 8, 
          padding: '24px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="middle"
        >
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择登录角色">
              <Option value="mediator">调解员</Option>
              <Option value="admin">管理员</Option>
              <Option value="personal">个人用户</Option>
              <Option value="company">企业用户</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="请输入用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="请输入密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              className="login-form-button"
              loading={loading}
              style={{ width: '100%' }}
            >
              登录
            </Button>
          </Form.Item>

          <Form.Item style={{ textAlign: 'center' }}>
            <Link to="/register">还没有账号？去注册</Link>
          </Form.Item>
        </Form>
        
        {/* 测试账号信息 */}
        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 16, textAlign: 'center', fontSize: 16, color: '#666' }}>测试账号</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 4, backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>调解员</div>
              <div style={{ marginBottom: 4 }}>用户名: mediator</div>
              <div>密码: 123456</div>
            </div>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 4, backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>管理员</div>
              <div style={{ marginBottom: 4 }}>用户名: admin</div>
              <div>密码: 123456</div>
            </div>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 4, backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>个人用户</div>
              <div style={{ marginBottom: 4 }}>用户名: personal</div>
              <div>密码: 123456</div>
            </div>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 4, backgroundColor: '#fafafa' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#1890ff' }}>企业用户</div>
              <div style={{ marginBottom: 4 }}>用户名: company</div>
              <div>密码: 123456</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Login;