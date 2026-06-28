import { useState } from 'react';
import { Button, Card, Form, Input, Select, message, Row, Col, Space, Typography, Alert, Tag } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined, ApartmentOutlined } from '@ant-design/icons';
import useAuthStore from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { getDefaultRouteByRole } from '../utils/roleNavigation';
import { AUTH_REDIRECT_KEY } from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

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
      const nextState = useAuthStore.getState();
      const redirectPath = window.sessionStorage.getItem(AUTH_REDIRECT_KEY);
      if (redirectPath && redirectPath !== '/login' && redirectPath !== '/register') {
        window.sessionStorage.removeItem(AUTH_REDIRECT_KEY);
        navigate(redirectPath, { replace: true });
      } else {
        navigate(getDefaultRouteByRole(nextState.userInfo?.role || values.role), { replace: true });
      }
    } catch (err: any) {
      console.error('登录失败:', err.message);
      message.error(error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-auth-shell">
      <Card
        bordered={false}
        className="page-auth-card"
      >
        <Row gutter={0}>
          <Col xs={24} lg={11}>
            <div className="page-auth-panel--aside">
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Tag color="blue" style={{ borderRadius: 999, marginBottom: 12 }}>后台管理入口</Tag>
                  <Title level={2} style={{ margin: 0 }}>劳动仲裁调解系统</Title>
                  <Text type="secondary">当前后台登录页仅面向超级管理员、街道管理员和调解员开放，个人/企业用户请从用户端入口进入。</Text>
                </div>
                <Alert
                  type="info"
                  showIcon
                  message="登录提示"
                  description="登录时请确保“角色”与账号类型匹配。街道管理员账号已按街道规则生成，默认规则为 `admin + 街道简称`，例如静安区天目西路街道对应 `admin天目西路`。"
                  style={{ borderRadius: 14 }}
                />
                <div className="page-auth-note-grid">
                  {[
                    { title: '超级管理员', user: 'admin', color: '#722ed1' },
                    { title: '街道管理员', user: 'admin天目西路', color: '#13a8a8' },
                    { title: '调解员', user: 'mediator1', color: '#1677ff' }
                  ].map((item) => (
                    <div key={item.user} className="page-auth-note-card">
                      <div style={{ fontWeight: 700, color: item.color, marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: '#4b5563' }}>用户名：{item.user}</div>
                      <div style={{ fontSize: 13, color: '#4b5563' }}>密码：123456</div>
                    </div>
                  ))}
                </div>
              </Space>
            </div>
          </Col>
          <Col xs={24} lg={13}>
            <div className="page-auth-panel--main">
              <Card bordered={false} style={{ width: '100%', maxWidth: 460 }}>
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div>
                    <Title level={3} style={{ marginBottom: 6 }}>账号登录</Title>
                    <Text type="secondary">选择角色后输入账号信息，系统会自动进入对应的后台工作台。</Text>
                  </div>
                  <Space wrap>
                    <Tag icon={<SafetyCertificateOutlined />} color="blue">角色校验</Tag>
                    <Tag icon={<ApartmentOutlined />} color="cyan">街道管理员按规则分配账号</Tag>
                  </Space>
                  <Form form={form} name="login" onFinish={onFinish} layout="vertical" size="large">
                    <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                      <Select placeholder="请选择登录角色">
                        <Option value="superadmin">超级管理员</Option>
                        <Option value="tenant_admin">街道管理员</Option>
                        <Option value="mediator">调解员</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                      <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="请输入用户名" />
                    </Form.Item>

                    <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                      <Input.Password prefix={<LockOutlined className="site-form-item-icon" />} placeholder="请输入密码" />
                    </Form.Item>

                    <Form.Item>
                      <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%', height: 48, borderRadius: 12 }}>
                        登录
                      </Button>
                    </Form.Item>
                  </Form>
                </Space>
              </Card>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Login;
