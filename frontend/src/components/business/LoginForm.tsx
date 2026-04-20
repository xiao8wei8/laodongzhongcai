import React from 'react';
import { Form, Input, Select, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const { Option } = Select;

interface LoginFormProps {
  onLoginSuccess?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login, error, clearError } = useAuthStore();

  const onFinish = async (values: any) => {
    clearError();
    try {
      await login(values.username, values.password, values.role);
      message.success('登录成功');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      navigate('/dashboard');
    } catch (err) {
      message.error(error || '登录失败');
    }
  };

  return (
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
          style={{ width: '100%' }}
        >
          登录
        </Button>
      </Form.Item>

      <Form.Item style={{ textAlign: 'center' }}>
        <Link to="/register">还没有账号？去注册</Link>
      </Form.Item>
    </Form>
  );
};

export default LoginForm;
