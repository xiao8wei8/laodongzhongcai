import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message
} from 'antd';
import { ClockCircleOutlined, PhoneOutlined, SaveOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
import api from '../services/api';
import { ExportButton } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { Option } = Select;
const { TextArea } = Input;

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
      const response = await api.post('/visitor', values);
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
    }
  ];

  const todayStats = useMemo(() => {
    const visitCount = todayRecords.filter((item) => item.visitType === 'visit').length;
    const phoneCount = todayRecords.filter((item) => item.visitType === 'phone').length;
    return {
      total: todayRecords.length,
      visitCount,
      phoneCount,
      recentType: todayRecords[0]?.disputeType || '暂无记录'
    };
  }, [todayRecords]);

  const exportColumns: ExcelColumn<VisitorRecord>[] = [
    { header: '登记编号', key: 'registerNumber' },
    { header: '来访者姓名', key: 'visitorName' },
    { header: '联系电话', key: 'phone' },
    { header: '到访类型', key: 'visitType', formatter: (row) => row.visitType === 'visit' ? '现场到访' : '电话咨询' },
    { header: '争议类型', key: 'disputeType' },
    { header: '事由', key: 'reason' },
    { header: '接待调解员', key: 'mediatorId', formatter: (row) => row.mediatorId?.name || '' },
    { header: '登记时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];

  const handleExport = () => {
    const rows = tabActiveKey === 'today' ? todayRecords : records;
    if (rows.length === 0) {
      warnNoExportData('当前没有可导出的到访记录');
      return;
    }
    exportExcel(buildExportFileName(tabActiveKey === 'today' ? '今日到访记录' : '全部到访记录'), exportColumns, rows);
    message.success(`已导出 ${rows.length} 条到访记录`);
  };

  useEffect(() => {
    fetchTodayRecords();
  }, []);

  return (
    <div style={{ padding: 4 }}>
      <Card
        bordered={false}
        style={{
          marginBottom: 20,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #0f172a 0%, #0f766e 100%)',
          color: '#fff',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 24 }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={16}>
            <Space direction="vertical" size={10}>
              <Space size={12} align="start">
                <Avatar size={46} icon={<UserAddOutlined />} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>到访登记台</div>
                  <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
                    用于接待现场来访和电话咨询。先完成基础登记，再在下方持续查看今日接待和全部记录。
                  </div>
                </div>
              </Space>
              <Space wrap>
                <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>现场与电话统一登记</Tag>
                <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>今日登记后立即进入记录区</Tag>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={8}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                  <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>今日接待</span>} value={todayStats.total} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                  <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>电话咨询</span>} value={todayStats.phoneCount} valueStyle={{ color: '#fff' }} />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={10}>
          <Card bordered={false} style={{ borderRadius: 18, height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }} bodyStyle={{ padding: 22 }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>登记新的来访记录</Title>
                <Text type="secondary">先录入来访人和争议信息，后续追踪通过下方记录区完成。</Text>
              </div>
              <Alert
                type="info"
                showIcon
                message="录入建议"
                description="电话咨询请选择“电话咨询”，事由描述建议先写核心诉求和涉及的争议类型，便于后续查询与归档。"
              />
              <Form
                form={form}
                name="visitorRegister"
                onFinish={onFinish}
                layout="vertical"
                initialValues={{ visitType: 'visit' }}
              >
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      name="visitorName"
                      label="来访者姓名"
                      rules={[{ required: true, message: '请输入姓名' }]}
                    >
                      <Input placeholder="请输入姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="phone"
                      label="联系电话"
                      rules={[{ required: true, message: '请输入联系电话' }]}
                    >
                      <Input placeholder="请输入联系电话" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col span={12}>
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
                  </Col>
                  <Col span={12}>
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
                  </Col>
                </Row>

                <Form.Item
                  name="reason"
                  label="事由描述"
                  rules={[{ required: true, message: '请描述事由' }]}
                >
                  <TextArea rows={6} placeholder="请概括来访诉求、争议背景、当前阶段，以及是否需要后续联系。" />
                </Form.Item>

                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} size="large" style={{ borderRadius: 10 }}>
                  提交登记
                </Button>
              </Form>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card bordered={false} style={{ borderRadius: 18, height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }} bodyStyle={{ padding: 22 }}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>接待概况</Title>
                  <Text type="secondary">把“今天发生了什么”和“历史一共登记了什么”拆开看，接待信息更清晰。</Text>
                </div>
                <Space wrap>
                  <Tag color="blue">现场到访 {todayStats.visitCount}</Tag>
                  <Tag color="purple">电话咨询 {todayStats.phoneCount}</Tag>
                  <Tag>{todayStats.recentType}</Tag>
                  <ExportButton onClick={handleExport} />
                </Space>
              </div>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f8fbff' }}>
                    <Statistic title="今日总量" value={todayStats.total} prefix={<ClockCircleOutlined />} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fdf4ff' }}>
                    <Statistic title="电话咨询" value={todayStats.phoneCount} prefix={<PhoneOutlined />} />
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#f3faf7' }}>
                    <Statistic title="现场到访" value={todayStats.visitCount} prefix={<TeamOutlined />} />
                  </Card>
                </Col>
              </Row>

              <Tabs
                activeKey={tabActiveKey}
                onChange={setTabActiveKey}
                items={[
                  {
                    key: 'today',
                    label: '今日到访',
                    children: (
                      <Table
                        columns={columns}
                        dataSource={todayRecords}
                        rowKey="_id"
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ x: 980 }}
                      />
                    )
                  },
                  {
                    key: 'all',
                    label: '全部记录',
                    children: (
                      <Table
                        columns={columns}
                        dataSource={records}
                        rowKey="_id"
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                        scroll={{ x: 980 }}
                      />
                    )
                  }
                ]}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VisitorRegister;
