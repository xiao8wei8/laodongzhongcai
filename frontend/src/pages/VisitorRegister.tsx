import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, Table, message, Tabs, Popconfirm, Radio, Typography } from 'antd';
import { SaveOutlined, MessageOutlined, UserAddOutlined } from '@ant-design/icons';

const { Title } = Typography;
import api from '../services/api';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface VisitorRecord {
  _id: string;
  registerNumber: string;
  visitorName: string;
  phone: string;
  visitType: string;
  disputeType: string;
  reason: string;
  mediatorId: {
    name: string;
  };
  sendSmsVerification: boolean;
  sendEmailVerification: boolean;
  email?: string;
  createdAt: string;
}

const VisitorRegister: React.FC = () => {
  const [form] = Form.useForm();
  const [records, setRecords] = useState<VisitorRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<VisitorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabActiveKey, setTabActiveKey] = useState('register');

  // 提交到访登记
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 转换验证方式字段
      const { verificationType, ...restValues } = values;
      const submitData = {
        ...restValues,
        sendSmsVerification: verificationType === 'sms',
        sendEmailVerification: verificationType === 'email'
      };
      
      const response = await api.post('/visitor', submitData);
      message.success('登记成功，编号：' + response.data.registerNumber);
      form.resetFields();
      fetchTodayRecords();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '登记失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 获取今日到访记录
  const fetchTodayRecords = async () => {
    try {
      const response = await api.get('/visitor/today');
      setTodayRecords(response.data.records);
    } catch (error) {
      message.error('获取今日记录失败');
    }
  };

  // 获取所有到访记录
  const fetchAllRecords = async () => {
    try {
      const response = await api.get('/visitor');
      setRecords(response.data.records);
    } catch (error) {
      message.error('获取记录失败');
    }
  };

  // 切换标签时获取数据
  useEffect(() => {
    if (tabActiveKey === 'today') {
      fetchTodayRecords();
    } else if (tabActiveKey === 'all') {
      fetchAllRecords();
    }
  }, [tabActiveKey]);

  // 到访类型选项
  const visitTypeOptions = [
    { label: '现场到访', value: 'visit' },
    { label: '电话咨询', value: 'phone' }
  ];

  // 争议类型选项
  const disputeTypeOptions = [
    { label: '工资纠纷', value: '工资纠纷' },
    { label: '加班纠纷', value: '加班纠纷' },
    { label: '社保纠纷', value: '社保纠纷' },
    { label: '工伤纠纷', value: '工伤纠纷' },
    { label: '解除劳动合同', value: '解除劳动合同' },
    { label: '其他纠纷', value: '其他纠纷' }
  ];

  // 发送短信链接
  const handleSendSmsLink = async (recordId: string) => {
    try {
      await api.post('/visitor/sms-link', { recordId });
      message.success('短信链接发送成功');
    } catch (error) {
      message.error('短信链接发送失败');
    }
  };

  // 记录列表列
  const columns = [
    {
      title: '登记编号',
      dataIndex: 'registerNumber',
      key: 'registerNumber'
    },
    {
      title: '来访者姓名',
      dataIndex: 'visitorName',
      key: 'visitorName'
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '到访类型',
      dataIndex: 'visitType',
      key: 'visitType',
      render: (value: string) => {
        return value === 'visit' ? '现场到访' : '电话咨询';
      }
    },
    {
      title: '争议类型',
      dataIndex: 'disputeType',
      key: 'disputeType'
    },
    {
      title: '事由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '接待调解员',
      dataIndex: ['mediatorId', 'name'],
      key: 'mediator'
    },
    {
      title: '登记时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: VisitorRecord) => (
        <Popconfirm
          title="确定发送短信链接吗？"
          onConfirm={() => handleSendSmsLink(record._id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="primary" icon={<MessageOutlined />} size="small">
            发送短信链接
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <UserAddOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={2} style={{ margin: 0, fontSize: '18px' }}>到访登记</Title>
      </div>
      <Tabs activeKey={tabActiveKey} onChange={setTabActiveKey} style={{ marginBottom: 24 }}>
        <TabPane tab="到访登记" key="register">
          <Card>
            <Form
              form={form}
              name="visitorRegister"
              onFinish={onFinish}
              layout="vertical"
            >
              <Form.Item
                name="visitorName"
                label="来访者姓名"
                rules={[{ required: true, message: '请输入姓名' }]}
              >
                <Input placeholder="请输入姓名" />
              </Form.Item>

              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>

              <Form.Item
                name="visitType"
                label="到访类型"
                rules={[{ required: true, message: '请选择到访类型' }]}
              >
                <Select placeholder="请选择到访类型">
                  {visitTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="disputeType"
                label="争议类型"
                rules={[{ required: true, message: '请选择争议类型' }]}
              >
                <Select placeholder="请选择争议类型">
                  {disputeTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="reason"
                label="事由描述"
                rules={[{ required: true, message: '请描述事由' }]}
              >
                <TextArea rows={4} placeholder="请详细描述事由" />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱"
              >
                <Input placeholder="请输入邮箱（选填）" />
              </Form.Item>

              <Form.Item
                name="verificationType"
                label="验证方式"
                rules={[{ required: true, message: '请选择验证方式' }]}
              >
                <Radio.Group>
                  <Radio value="sms">短信验证</Radio>
                  <Radio value="email">邮箱验证</Radio>
                  <Radio value="none">无需验证</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                  提交登记
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="今日到访" key="today">
          <Card>
            <Table
              columns={columns}
              dataSource={todayRecords}
              rowKey="_id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="所有记录" key="all">
          <Card>
            <Table
              columns={columns}
              dataSource={records}
              rowKey="_id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default VisitorRegister;
