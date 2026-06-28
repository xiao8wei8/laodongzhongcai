import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Switch, Button, message, Tabs, Typography, Alert, Row, Col, Statistic, Space, Avatar, Divider, Tag } from 'antd';
import { SaveOutlined, SettingOutlined, SafetyCertificateOutlined, BellOutlined, ApiOutlined, TeamOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

const { Option } = Select;
const { TabPane } = Tabs;

interface SystemSettings {
  basic: {
    systemName: string;
    systemIcon: string;
    contactPhone: string;
    address: string;
    homeBannerEnabled: boolean;
    homeBannerTitle: string;
    homeBannerSubtitle: string;
    homeBannerImage: string;
    homeBannerLink: string;
    homeBannerButtonText: string;
    homeBannerBgStart: string;
    homeBannerBgEnd: string;
  };
  security: {
    passwordPolicy: string;
    loginAttempts: number;
    sessionTimeout: number;
  };
  apiKeys: {
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

interface ReminderSetting {
  reminderTime: string;
  notificationChannels: {
    system: boolean;
  };
  workdayOnly: boolean;
  caseReminderDays: number;
}

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [reminderForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [mediators, setMediators] = useState<any[]>([]);
  const [onDutyMediator, setOnDutyMediator] = useState<any>(null);
  const [mediatorLoading, setMediatorLoading] = useState(false);

  // 初始设置值
  const initialSettings: SystemSettings = {
    basic: {
      systemName: '劳动仲裁调解系统',
      systemIcon: 'BankOutlined',
      contactPhone: '400-123-4567',
      address: '北京市朝阳区建国路88号',
      homeBannerEnabled: true,
      homeBannerTitle: '劳动仲裁调解系统',
      homeBannerSubtitle: '便捷·高效·专业',
      homeBannerImage: '',
      homeBannerLink: '',
      homeBannerButtonText: '',
      homeBannerBgStart: '#1890ff',
      homeBannerBgEnd: '#096dd9'
    },
    security: {
      passwordPolicy: 'medium',
      loginAttempts: 5,
      sessionTimeout: 24
    },
    apiKeys: {
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

  const initialReminderSettings: ReminderSetting = {
    reminderTime: '30min',
    notificationChannels: {
      system: true
    },
    workdayOnly: true,
    caseReminderDays: 15
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

  const loadReminderSettings = async () => {
    setReminderLoading(true);
    try {
      const response = await api.get('/user/reminder/setting');
      const nextValues: ReminderSetting = {
        reminderTime: response.data?.setting?.reminderTime || '30min',
        notificationChannels: {
          system: true
        },
        workdayOnly: response.data?.setting?.workdayOnly ?? true,
        caseReminderDays: Number(response.data?.setting?.caseReminderDays || 15)
      };
      reminderForm.setFieldsValue(nextValues);
    } catch (error) {
      message.error('加载系统提醒设置失败');
      reminderForm.setFieldsValue(initialReminderSettings);
    } finally {
      setReminderLoading(false);
    }
  };

  const saveReminderSettings = async (values: ReminderSetting) => {
    setReminderLoading(true);
    try {
      await api.put('/user/reminder/setting', {
        ...values,
        notificationChannels: {
          system: true
        }
      });
      message.success('系统提醒设置已保存');
    } catch (error) {
      message.error('保存系统提醒设置失败');
    } finally {
      setReminderLoading(false);
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
    loadReminderSettings();
    fetchMediators();
    fetchOnDutyMediator();
  }, []);

  const settingStats = [
    { title: '系统基础配置', value: 1, suffix: '组', color: '#1677ff' },
    { title: '安全与提醒', value: 2, suffix: '类', color: '#722ed1' },
    { title: '值班配置', value: onDutyMediator ? 1 : 0, suffix: '项', color: '#13a8a8' },
    { title: '平台密钥', value: 2, suffix: '组', color: '#fa8c16' }
  ];

  return (
    <div style={{ padding: 4 }}>
      <Card
        bordered={false}
        style={{
          marginBottom: 20,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
          color: '#fff',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={10}>
              <Space size={12} align="start">
                <Avatar size={46} icon={<SettingOutlined />} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>系统配置中心</div>
                  <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
                    统一维护平台基础信息、安全策略、系统提醒、值班安排和平台密钥。建议先确认范围，再进入对应标签页修改。
                  </div>
                </div>
              </Space>
              <Space wrap>
                <Tag color="blue-inverse" style={{ borderRadius: 999 }}>配置修改即时生效</Tag>
                <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>高风险项建议先在测试环境验证</Tag>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={8}>
            <Row gutter={[12, 12]}>
              {settingStats.map((item) => (
                <Col span={12} key={item.title}>
                  <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                    <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>{item.title}</span>} value={item.value} suffix={item.suffix} valueStyle={{ color: '#fff' }} />
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </Card>

      <Card
        bordered={false}
        style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
        bodyStyle={{ padding: 22 }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 18, borderRadius: 12 }}
          message="配置建议"
          description="基础信息和展示文案优先由超级管理员统一维护；安全、提醒和值班相关配置建议在业务低峰期调整；平台密钥修改后请重新验证依赖服务。"
        />

        <Tabs
          defaultActiveKey="basic"
          tabBarGutter={24}
          items={[
            {
              key: 'basic',
              label: (
                <Space size={8}>
                  <SettingOutlined />
                  <span>基本设置</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#fafcff', borderRadius: 16 }}>
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>平台基础信息</Title>
                      <Text type="secondary">决定系统名称、系统图标、联系信息以及首页 Banner 的呈现方式。</Text>
                    </div>
                    <Form form={form} layout="vertical" onFinish={saveSettings}>
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={['basic', 'systemName']}
                            label="系统名称"
                            rules={[{ required: true, message: '请输入系统名称' }]}
                          >
                            <Input placeholder="请输入系统名称" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
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
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={['basic', 'contactPhone']}
                            label="联系电话"
                            rules={[{ required: true, message: '请输入联系电话' }]}
                          >
                            <Input placeholder="请输入联系电话" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={['basic', 'address']}
                            label="办公地址"
                            rules={[{ required: true, message: '请输入办公地址' }]}
                          >
                            <Input placeholder="请输入办公地址" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider orientation="left" plain>首页 Banner</Divider>

                      <Form.Item
                        name={['basic', 'homeBannerEnabled']}
                        label="首页广告位"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="启用" unCheckedChildren="关闭" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name={['basic', 'homeBannerTitle']} label="广告标题">
                            <Input placeholder="请输入首页广告标题" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name={['basic', 'homeBannerSubtitle']} label="广告副标题">
                            <Input placeholder="请输入首页广告副标题" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        name={['basic', 'homeBannerImage']}
                        label="广告图片地址"
                        extra="可填写完整图片 URL；为空时显示纯色渐变广告位。"
                      >
                        <Input placeholder="请输入广告图片 URL" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={['basic', 'homeBannerLink']}
                            label="广告跳转路径"
                            extra="支持小程序页面路径，如 /pages/messages/messages"
                          >
                            <Input placeholder="请输入广告点击后的跳转路径" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name={['basic', 'homeBannerButtonText']} label="按钮文案">
                            <Input placeholder="例如：立即查看" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name={['basic', 'homeBannerBgStart']} label="渐变起始色">
                            <Input placeholder="例如：#1890ff" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name={['basic', 'homeBannerBgEnd']} label="渐变结束色">
                            <Input placeholder="例如：#096dd9" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ borderRadius: 10 }}>
                        保存基本设置
                      </Button>
                    </Form>
                  </Space>
                </Card>
              )
            },
            {
              key: 'security',
              label: (
                <Space size={8}>
                  <SafetyCertificateOutlined />
                  <span>安全设置</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#fafcff', borderRadius: 16 }}>
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>账号与会话安全</Title>
                      <Text type="secondary">配置密码复杂度、登录尝试次数和会话超时时间，优先控制系统入口风险。</Text>
                    </div>
                    <Form form={form} layout="vertical" onFinish={saveSettings}>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
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
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={['security', 'loginAttempts']}
                            label="登录尝试次数"
                            rules={[{ required: true, message: '请输入登录尝试次数' }]}
                          >
                            <Input type="number" placeholder="请输入登录尝试次数" min={1} max={10} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={['security', 'sessionTimeout']}
                            label="会话超时时间（小时）"
                            rules={[{ required: true, message: '请输入会话超时时间' }]}
                          >
                            <Input type="number" placeholder="请输入会话超时时间" min={1} max={72} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ borderRadius: 10 }}>
                        保存安全设置
                      </Button>
                    </Form>
                  </Space>
                </Card>
              )
            },
            {
              key: 'reminder',
              label: (
                <Space size={8}>
                  <BellOutlined />
                  <span>系统提醒</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#fafcff', borderRadius: 16 }}>
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>站内提醒策略</Title>
                      <Text type="secondary">当前仅保留站内提醒。短信、邮件相关能力和配置入口已从系统中移除。</Text>
                    </div>
                    <Alert
                      type="info"
                      showIcon
                      style={{ borderRadius: 12 }}
                      message="提醒设置已收归系统侧"
                      description="建议统一使用站内提醒，通过提醒时间、工作日限制和案件提醒期限控制干扰频率。"
                    />
                    <Form form={reminderForm} layout="vertical" onFinish={saveReminderSettings} initialValues={initialReminderSettings}>
                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name="reminderTime"
                            label="提醒时间"
                            rules={[{ required: true, message: '请选择提醒时间' }]}
                          >
                            <Select placeholder="请选择提醒时间">
                              <Option value="15min">提前15分钟</Option>
                              <Option value="30min">提前30分钟</Option>
                              <Option value="1h">提前1小时</Option>
                              <Option value="2h">提前2小时</Option>
                              <Option value="1d">提前1天</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={['notificationChannels', 'system']}
                            label="站内提醒"
                            valuePropName="checked"
                          >
                            <Switch checkedChildren="开启" unCheckedChildren="关闭" disabled />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name="workdayOnly"
                            label="仅工作日提醒"
                            valuePropName="checked"
                          >
                            <Switch checkedChildren="是" unCheckedChildren="否" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item
                        name="caseReminderDays"
                        label="案件提醒期限（天）"
                        rules={[{ required: true, message: '请选择案件提醒期限' }]}
                      >
                        <Select style={{ width: '100%', maxWidth: 280 }} placeholder="请选择案件提醒期限">
                          <Option value={7}>7天</Option>
                          <Option value={10}>10天</Option>
                          <Option value={15}>15天</Option>
                          <Option value={20}>20天</Option>
                          <Option value={30}>30天</Option>
                        </Select>
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={reminderLoading} size="large" style={{ borderRadius: 10 }}>
                        保存系统提醒
                      </Button>
                    </Form>
                  </Space>
                </Card>
              )
            },
            {
              key: 'duty',
              label: (
                <Space size={8}>
                  <TeamOutlined />
                  <span>值班管理</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#fafcff', borderRadius: 16 }}>
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>值班调解员配置</Title>
                      <Text type="secondary">设置当前值班调解员，确保案件申请和咨询流转能自动匹配到正确的受理人。</Text>
                    </div>
                    <Alert
                      type={onDutyMediator ? 'success' : 'warning'}
                      showIcon
                      style={{ borderRadius: 12 }}
                      message={onDutyMediator ? `当前值班调解员：${onDutyMediator.name}` : '当前无值班调解员'}
                      description={onDutyMediator ? `${onDutyMediator.phone || '未留联系电话'}` : '建议尽快设置，避免新案件和咨询无法自动分流。'}
                    />
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
                      <Button type="primary" htmlType="submit" loading={mediatorLoading} size="large" style={{ borderRadius: 10 }}>
                        设置值班调解员
                      </Button>
                    </Form>
                  </Space>
                </Card>
              )
            },
            {
              key: 'apiKeys',
              label: (
                <Space size={8}>
                  <ApiOutlined />
                  <span>平台密钥</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#fafcff', borderRadius: 16 }}>
                  <Space direction="vertical" size={18} style={{ width: '100%' }}>
                    <div>
                      <Title level={4} style={{ margin: 0 }}>第三方平台密钥</Title>
                      <Text type="secondary">用于统一维护腾讯云与阿里云相关服务的访问凭证，建议修改后立即做连通性验证。</Text>
                    </div>
                    <Form form={form} layout="vertical" onFinish={saveSettings}>
                      <Divider orientation="left" plain>腾讯云</Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name={['apiKeys', 'tencent', 'secretId']} label="Secret ID">
                            <Input placeholder="请输入腾讯云 Secret ID" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name={['apiKeys', 'tencent', 'secretKey']} label="Secret Key">
                            <Input.Password placeholder="请输入腾讯云 Secret Key" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Divider orientation="left" plain>阿里云</Divider>
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name={['apiKeys', 'aliyun', 'accessKeyId']} label="Access Key ID">
                            <Input placeholder="请输入阿里云 Access Key ID" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name={['apiKeys', 'aliyun', 'accessKeySecret']} label="Access Key Secret">
                            <Input.Password placeholder="请输入阿里云 Access Key Secret" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} size="large" style={{ borderRadius: 10 }}>
                        保存平台密钥
                      </Button>
                    </Form>
                  </Space>
                </Card>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default SystemSettings;
