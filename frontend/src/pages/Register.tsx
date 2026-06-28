import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, message, Alert, Spin, Row, Col, Typography, Space, Tag } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, IdcardOutlined, SolutionOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useNavigate, Link, useLocation } from 'react-router-dom';

const { Option } = Select;
const { Title, Text } = Typography;

const Register: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('personal'); // 跟踪当前角色
  const navigate = useNavigate();
  const location = useLocation();

  // 解析URL参数
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    if (token) {
      verifyToken(token);
    }
  }, [location.search]);

  // 初始化角色状态
  useEffect(() => {
    // 同步表单初始值到currentRole状态
    const initialRole = form.getFieldValue('role');
    if (initialRole) {
      setCurrentRole(initialRole);
    }
  }, []);

  // 验证token并填充访客信息
  const verifyToken = async (token: string) => {
    setTokenLoading(true);
    setTokenError(null);
    
    try {
      const response = await api.post('/auth/verify-token', { token });
      const visitorInfo = response.data.visitor;
      
      // 自动填充表单
      form.setFieldsValue({
        role: 'personal',
        identity: 'applicant', // 默认选中申请人
        name: visitorInfo.visitorName,
        phone: visitorInfo.phone
      });
      
      message.success('链接验证成功，已自动填充信息');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '链接验证失败';
      setTokenError(errorMessage);
      message.error(errorMessage);
    } finally {
      setTokenLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 转换 caseAmount 为数字类型
      const processedValues = {
        ...values,
        caseAmount: values.caseAmount ? Number(values.caseAmount) : undefined
      };
      await api.post('/auth/register', processedValues);
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || '注册失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-auth-shell">
      <Card 
        bordered={false}
        className="page-auth-card"
        style={{ maxWidth: 1060 }}
      >
        <Row gutter={0}>
          <Col xs={24} lg={10}>
            <div className="page-auth-panel--aside" style={{ minHeight: 760 }}>
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Tag color="blue" style={{ borderRadius: 999, marginBottom: 12 }}>服务入口</Tag>
                  <Title level={2} style={{ margin: 0 }}>用户注册</Title>
                  <Text type="secondary">面向个人用户和企业用户开放注册。填写完成后即可进入登录页，按角色进入对应服务首页。</Text>
                </div>
                <Alert
                  type="info"
                  showIcon
                  message="填写建议"
                  description="个人和企业用户都需要选择身份与涉案金额，便于后续案件登记和流程判断。"
                  style={{ borderRadius: 14 }}
                />
                <div className="page-auth-note-grid">
                  {[
                    { title: '个人用户', desc: '适合劳动者个人发起申请或查看案件。' },
                    { title: '企业用户', desc: '适合企业侧查看案件、配合调解流程。' },
                    { title: '申请人 / 被申请人', desc: '注册时明确身份，有助于后续案件数据归属。' }
                  ].map((item) => (
                    <div key={item.title} className="page-auth-note-card">
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                      <div style={{ fontSize: 13, color: '#4b5563' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </Space>
            </div>
          </Col>
          <Col xs={24} lg={14}>
            <div className="page-auth-panel--main" style={{ minHeight: 760 }}>
              <Card bordered={false} style={{ width: '100%', maxWidth: 520 }}>
                {tokenLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <Spin size="large" tip="验证链接中..." />
                  </div>
                ) : tokenError ? (
                  <Alert message="链接错误" description={tokenError} type="error" showIcon style={{ marginBottom: '20px', borderRadius: 12 }} />
                ) : (
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={3} style={{ marginBottom: 6 }}>创建账号</Title>
                      <Text type="secondary">请按实际身份填写资料，系统会在后续案件和反馈流程中复用这些信息。</Text>
                    </div>
                    <Space wrap>
                      <Tag icon={<SolutionOutlined />} color="blue">身份清晰</Tag>
                      <Tag color="cyan">信息可复用</Tag>
                    </Space>
                    <Form
                      form={form}
                      name="register"
                      onFinish={onFinish}
                      layout="vertical"
                      size="large"
                      initialValues={{ role: 'personal', identity: 'applicant' }}
                      onValuesChange={(changedValues, allValues) => {
                        if ('role' in changedValues) {
                          setCurrentRole(allValues.role);
                          if (allValues.role === 'personal' || allValues.role === 'company') {
                            form.setFieldsValue({ identity: 'applicant' });
                          } else {
                            form.setFieldsValue({ identity: undefined, caseAmount: undefined });
                          }
                        }
                      }}
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                            <Select placeholder="请选择注册角色">
                              <Option value="personal">个人用户</Option>
                              <Option value="company">企业用户</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                            <Input prefix={<UserOutlined className="site-form-item-icon" />} placeholder="请输入用户名" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="password"
                            label="密码"
                            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码长度至少6位' }]}
                          >
                            <Input.Password prefix={<LockOutlined className="site-form-item-icon" />} placeholder="请输入密码" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                            <Input placeholder="请输入姓名" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name="phone" label="电话" rules={[{ required: true, message: '请输入电话' }]}>
                            <Input prefix={<PhoneOutlined className="site-form-item-icon" />} placeholder="请输入电话" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="idCard" label="身份证号">
                            <Input prefix={<IdcardOutlined className="site-form-item-icon" />} placeholder="请输入身份证号" />
                          </Form.Item>
                        </Col>
                      </Row>

                      {(currentRole === 'personal' || currentRole === 'company') ? (
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item name="identity" label="选择身份" rules={[{ required: true, message: '请选择身份' }]}>
                              <Select placeholder="请选择身份">
                                <Option value="applicant">申请人</Option>
                                <Option value="respondent">被申请人</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="caseAmount"
                              label="涉案金额"
                              rules={[
                                { required: true, message: '请输入涉案金额' },
                                {
                                  validator: (_, value) => {
                                    if (value === undefined || value === null || value === '') {
                                      return Promise.reject(new Error('请输入涉案金额'));
                                    }
                                    const numValue = Number(value);
                                    if (isNaN(numValue) || numValue < 0) {
                                      return Promise.reject(new Error('涉案金额必须大于或等于0'));
                                    }
                                    return Promise.resolve();
                                  }
                                }
                              ]}
                            >
                              <Input type="number" placeholder="请输入涉案金额" addonAfter="元" step="1" min="0" />
                            </Form.Item>
                          </Col>
                        </Row>
                      ) : null}

                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%', height: 48, borderRadius: 12 }}>
                          注册
                        </Button>
                      </Form.Item>

                      <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
                        <Link to="/login">已有账号？去登录</Link>
                      </Form.Item>
                    </Form>
                  </Space>
                )}
              </Card>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Register;
