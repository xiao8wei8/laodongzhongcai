import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Switch, Button, message, Tabs, Typography } from 'antd';
import { SaveOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title } = Typography;

const { Option } = Select;
const { TabPane } = Tabs;

interface SystemSettings {
  basic: {
    systemName: string;
    systemIcon: string;
    contactPhone: string;
    contactEmail: string;
    address: string;
  };
  security: {
    passwordPolicy: string;
    loginAttempts: number;
    sessionTimeout: number;
  };
  notification: {
    enableEmail: boolean;
    enableSms: boolean;
    emailTemplate: string;
  };
  apiKeys: {
    sms: {
      secretId: string;
      secretKey: string;
      sdkAppId: string;
      signName: string;
      templateIds: {
        verification: string;
        notification: string;
        registerSuccess: string;
      };
    };
    email: {
      secretId: string;
      secretKey: string;
      sender: {
        email: string;
        name: string;
      };
      templates: {
        registerSuccess: string;
        passwordReset: string;
        caseNotification: string;
      };
    };
    tencent: {
      secretId: string;
      secretKey: string;
    };
    aliyun: {
      accessKeyId: string;
      accessKeySecret: string;
    };
  };
}

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [mediators, setMediators] = useState<any[]>([]);
  const [onDutyMediator, setOnDutyMediator] = useState<any>(null);
  const [mediatorLoading, setMediatorLoading] = useState(false);

  // 初始设置值
  const initialSettings: SystemSettings = {
    basic: {
      systemName: '劳动仲裁调解系统',
      systemIcon: 'BankOutlined',
      contactPhone: '400-123-4567',
      contactEmail: 'support@example.com',
      address: '北京市朝阳区建国路88号'
    },
    security: {
      passwordPolicy: 'medium',
      loginAttempts: 5,
      sessionTimeout: 24
    },
    notification: {
      enableEmail: true,
      enableSms: false,
      emailTemplate: '尊敬的用户，您有一条新消息：{message}'
    },
    apiKeys: {
      sms: {
        secretId: '',
        secretKey: '',
        sdkAppId: '',
        signName: '',
        templateIds: {
          verification: '',
          notification: '',
          registerSuccess: ''
        }
      },
      email: {
        secretId: '',
        secretKey: '',
        sender: {
          email: '',
          name: ''
        },
        templates: {
          registerSuccess: '',
          passwordReset: '',
          caseNotification: ''
        }
      },
      tencent: {
        secretId: '',
        secretKey: ''
      },
      aliyun: {
        accessKeyId: '',
        accessKeySecret: ''
      }
    }
  };

  // 加载设置
  const loadSettings = async () => {
    try {
      const response = await api.get('/system/settings');
      form.setFieldsValue(response.data);
    } catch (error) {
      console.error('加载设置失败:', error);
      message.error('加载设置失败');
      // 如果API调用失败，使用初始值
      form.setFieldsValue(initialSettings);
    }
  };

  // 保存设置
  const saveSettings = async (values: any) => {
    setLoading(true);
    try {
      await api.put('/system/settings', values);
      message.success('设置保存成功');
    } catch (error) {
      console.error('保存设置失败:', error);
      message.error('设置保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取调解员列表
  const fetchMediators = async () => {
    setMediatorLoading(true);
    try {
      const response = await api.get('/auth/users', { params: { role: 'mediator' } });
      setMediators(response.data.users || []);
    } catch (error) {
      message.error('获取调解员列表失败');
    } finally {
      setMediatorLoading(false);
    }
  };

  // 获取当前值班调解员
  const fetchOnDutyMediator = async () => {
    try {
      const response = await api.get('/user/on-duty');
      setOnDutyMediator(response.data.mediator);
      form.setFieldsValue({ onDutyMediator: response.data.mediator._id });
    } catch (error) {
      // 无值班调解员时不显示错误
      setOnDutyMediator(null);
      form.setFieldsValue({ onDutyMediator: undefined });
    }
  };

  // 设置值班调解员
  const handleSetOnDutyMediator = async (values: any) => {
    setMediatorLoading(true);
    try {
      await api.post('/user/on-duty', { mediatorId: values.onDutyMediator });
      message.success('值班调解员设置成功');
      fetchOnDutyMediator();
    } catch (error) {
      message.error('设置值班调解员失败');
    } finally {
      setMediatorLoading(false);
    }
  };

  // 组件挂载时加载设置
  React.useEffect(() => {
    loadSettings();
    fetchMediators();
    fetchOnDutyMediator();
  }, []);

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <SettingOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>系统设置</Title>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
          保存设置
        </Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <Tabs 
          defaultActiveKey="basic"
          style={{ 
            minWidth: 300,
            width: '100%'
          }}
        >
        <TabPane tab="基本设置" key="basic">
          <Card>
            <Form form={form} layout="vertical" onFinish={saveSettings}>
              <Form.Item
                name={['basic', 'systemName']}
                label="系统名称"
                rules={[{ required: true, message: '请输入系统名称' }]}
              >
                <Input placeholder="请输入系统名称" />
              </Form.Item>

              <Form.Item
                name={['basic', 'systemIcon']}
                label="系统图标"
                rules={[{ required: true, message: '请选择系统图标' }]}
              >
                <Select placeholder="请选择系统图标">
                  <Option value="BankOutlined">银行图标</Option>
                  <Option value="BuildingOutlined">建筑图标</Option>
                  <Option value="TeamOutlined">团队图标</Option>
                  <Option value="UserOutlined">用户图标</Option>
                  <Option value="FileTextOutlined">文件图标</Option>
                  <Option value="SettingOutlined">设置图标</Option>
                  <Option value="BellOutlined">铃铛图标</Option>
                  <Option value="DashboardOutlined">仪表盘图标</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name={['basic', 'contactPhone']}
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>

              <Form.Item
                name={['basic', 'contactEmail']}
                label="联系邮箱"
                rules={[{ required: true, message: '请输入联系邮箱' }]}
              >
                <Input placeholder="请输入联系邮箱" />
              </Form.Item>

              <Form.Item
                name={['basic', 'address']}
                label="办公地址"
                rules={[{ required: true, message: '请输入办公地址' }]}
              >
                <Input placeholder="请输入办公地址" />
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="安全设置" key="security">
          <Card>
            <Form form={form} layout="vertical" onFinish={saveSettings}>
              <Form.Item
                name={['security', 'passwordPolicy']}
                label="密码策略"
                rules={[{ required: true, message: '请选择密码策略' }]}
              >
                <Select placeholder="请选择密码策略">
                  <Option value="low">低（6位以上）</Option>
                  <Option value="medium">中（8位以上，包含字母和数字）</Option>
                  <Option value="high">高（10位以上，包含字母、数字和特殊字符）</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name={['security', 'loginAttempts']}
                label="登录尝试次数"
                rules={[{ required: true, message: '请输入登录尝试次数' }]}
              >
                <Input type="number" placeholder="请输入登录尝试次数" min={1} max={10} />
              </Form.Item>

              <Form.Item
                name={['security', 'sessionTimeout']}
                label="会话超时时间（小时）"
                rules={[{ required: true, message: '请输入会话超时时间' }]}
              >
                <Input type="number" placeholder="请输入会话超时时间" min={1} max={72} />
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="通知设置" key="notification">
          <Card>
            <Form form={form} layout="vertical" onFinish={saveSettings}>
              <Form.Item
                name={['notification', 'enableEmail']}
                label="启用邮件通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name={['notification', 'enableSms']}
                label="启用短信通知"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name={['notification', 'emailTemplate']}
                label="邮件模板"
                rules={[{ required: true, message: '请输入邮件模板' }]}
              >
                <Input.TextArea rows={3} placeholder="请输入邮件模板，{message} 会被替换为实际消息内容" />
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="值班管理" key="duty">
          <Card>
            <Form form={form} layout="vertical" onFinish={handleSetOnDutyMediator}>
              <Form.Item
                name="onDutyMediator"
                label="当日值班调解员"
                rules={[{ required: true, message: '请选择值班调解员' }]}
              >
                <Select placeholder="请选择值班调解员" loading={mediatorLoading}>
                  {mediators.map((mediator) => (
                    <Option key={mediator._id} value={mediator._id}>
                      {mediator.name} ({mediator.phone})
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <div style={{ marginBottom: 16 }}>
                {onDutyMediator ? (
                  <p style={{ color: '#1890ff' }}>
                    当前值班调解员：{onDutyMediator.name} ({onDutyMediator.phone})
                  </p>
                ) : (
                  <p style={{ color: '#faad14' }}>
                    当前无值班调解员，请设置
                  </p>
                )}
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={mediatorLoading}>
                  设置值班调解员
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="API Key管理" key="apiKeys">
          <Card>
            <Form form={form} layout="vertical" onFinish={saveSettings}>
              <Title level={3}>短信服务API Key</Title>
              <Form.Item
                name={['apiKeys', 'sms', 'secretId']}
                label="Secret ID"
              >
                <Input placeholder="请输入短信服务Secret ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'sms', 'secretKey']}
                label="Secret Key"
              >
                <Input.Password placeholder="请输入短信服务Secret Key" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'sms', 'sdkAppId']}
                label="SDK App ID"
              >
                <Input placeholder="请输入短信服务SDK App ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'sms', 'signName']}
                label="签名名称"
              >
                <Input placeholder="请输入短信服务签名名称" />
              </Form.Item>
              <Title level={4}>短信模板ID</Title>
              <Form.Item
                name={['apiKeys', 'sms', 'templateIds', 'verification']}
                label="验证码模板ID"
              >
                <Input placeholder="请输入验证码短信模板ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'sms', 'templateIds', 'notification']}
                label="通知模板ID"
              >
                <Input placeholder="请输入通知短信模板ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'sms', 'templateIds', 'registerSuccess']}
                label="注册成功模板ID"
              >
                <Input placeholder="请输入注册成功短信模板ID" />
              </Form.Item>

              <Title level={3} style={{ marginTop: 24 }}>邮件服务API Key</Title>
              <Form.Item
                name={['apiKeys', 'email', 'secretId']}
                label="Secret ID"
              >
                <Input placeholder="请输入邮件服务Secret ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'email', 'secretKey']}
                label="Secret Key"
              >
                <Input.Password placeholder="请输入邮件服务Secret Key" />
              </Form.Item>
              <Title level={4}>发件人信息</Title>
              <Form.Item
                name={['apiKeys', 'email', 'sender', 'email']}
                label="发件人邮箱"
              >
                <Input placeholder="请输入发件人邮箱" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'email', 'sender', 'name']}
                label="发件人名称"
              >
                <Input placeholder="请输入发件人名称" />
              </Form.Item>
              <Title level={4}>邮件模板</Title>
              <Form.Item
                name={['apiKeys', 'email', 'templates', 'registerSuccess']}
                label="注册成功模板"
              >
                <Input.TextArea rows={3} placeholder="请输入注册成功邮件模板" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'email', 'templates', 'passwordReset']}
                label="密码重置模板"
              >
                <Input.TextArea rows={3} placeholder="请输入密码重置邮件模板" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'email', 'templates', 'caseNotification']}
                label="案件通知模板"
              >
                <Input.TextArea rows={3} placeholder="请输入案件通知邮件模板" />
              </Form.Item>

              <Title level={3} style={{ marginTop: 24 }}>腾讯云服务API Key</Title>
              <Form.Item
                name={['apiKeys', 'tencent', 'secretId']}
                label="Secret ID"
              >
                <Input placeholder="请输入腾讯云Secret ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'tencent', 'secretKey']}
                label="Secret Key"
              >
                <Input.Password placeholder="请输入腾讯云Secret Key" />
              </Form.Item>

              <Title level={3} style={{ marginTop: 24 }}>阿里云服务API Key</Title>
              <Form.Item
                name={['apiKeys', 'aliyun', 'accessKeyId']}
                label="Access Key ID"
              >
                <Input placeholder="请输入阿里云Access Key ID" />
              </Form.Item>
              <Form.Item
                name={['apiKeys', 'aliyun', 'accessKeySecret']}
                label="Access Key Secret"
              >
                <Input.Password placeholder="请输入阿里云Access Key Secret" />
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemSettings;