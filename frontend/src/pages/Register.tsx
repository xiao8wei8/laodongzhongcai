import { useState, useEffect } from 'react';
import { Button, Card, Form, Input, Select, message, Alert, Spin } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, MailOutlined, IdcardOutlined } from '@ant-design/icons';
import api from '../services/api';
import { useNavigate, Link, useLocation } from 'react-router-dom';

const { Option } = Select;

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
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f0f2f5'
    }}>
      <Card 
        title="用户注册" 
        style={{ 
          width: '90%', 
          maxWidth: 500, 
          borderRadius: 8, 
          padding: '24px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
      >
        {tokenLoading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" tip="验证链接中..." />
          </div>
        ) : tokenError ? (
          <Alert 
            message="链接错误" 
            description={tokenError} 
            type="error" 
            showIcon 
            style={{ marginBottom: '20px' }}
          />
        ) : (
          <Form
            form={form}
            name="register"
            onFinish={onFinish}
            layout="vertical"
            size="middle"
            initialValues={{
              role: 'personal', // 默认选择个人用户
              identity: 'applicant' // 默认选择申请人
            }}
            onValuesChange={(changedValues, allValues) => {
              // 只在角色字段真正变化时更新状态
              if ('role' in changedValues) {
                setCurrentRole(allValues.role);
                // 当角色切换到个人用户或企业用户时，设置默认身份为申请人
                if (allValues.role === 'personal' || allValues.role === 'company') {
                  form.setFieldsValue({ identity: 'applicant' });
                } 
                // 当角色切换到其他角色时，清理不必要的字段值
                else {
                  form.setFieldsValue({ identity: undefined, caseAmount: undefined });
                }
              }
            }}
          >
            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
            >
              <Select placeholder="请选择注册角色">
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
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码长度至少6位' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="site-form-item-icon" />}
                placeholder="请输入密码"
              />
            </Form.Item>

            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input
                placeholder="请输入姓名"
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="电话"
              rules={[{ required: true, message: '请输入电话' }]}
            >
              <Input
                prefix={<PhoneOutlined className="site-form-item-icon" />}
                placeholder="请输入电话"
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="邮箱"
            >
              <Input
                prefix={<MailOutlined className="site-form-item-icon" />}
                placeholder="请输入邮箱"
              />
            </Form.Item>

            <Form.Item
              name="idCard"
              label="身份证号"
            >
              <Input
                prefix={<IdcardOutlined className="site-form-item-icon" />}
                placeholder="请输入身份证号"
              />
            </Form.Item>

            {/* 根据角色类型显示不同字段 */}
            {currentRole === 'personal' || currentRole === 'company' ? (
              <>
                <Form.Item
                  name="identity"
                  label="选择身份"
                  rules={[{ required: true, message: '请选择身份' }]}
                >
                  <Select placeholder="请选择身份">
                    <Option value="applicant">申请人</Option>
                    <Option value="respondent">被申请人</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="caseAmount"
                  label="涉案金额"
                  rules={[
                    { required: true, message: '请输入涉案金额' },
                    {
                      validator: (_, value) => {
                        // 确保值是数字且大于等于0
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
                  <Input
                    type="number"
                    placeholder="请输入涉案金额"
                    addonAfter="元"
                    step="1"
                    min="0"
                  />
                </Form.Item>
              </>
            ) : null}

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: '100%' }}
              >
                注册
              </Button>
            </Form.Item>

            <Form.Item style={{ textAlign: 'center' }}>
              <Link to="/login">已有账号？去登录</Link>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default Register;