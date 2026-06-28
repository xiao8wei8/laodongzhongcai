import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import {
  FileTextOutlined,
  MessageOutlined,
  PhoneOutlined,
  SearchOutlined,
  SolutionOutlined
} from '@ant-design/icons';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { ExportButton } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { TextArea } = Input;
const { Title, Text } = Typography;

const feedbackTypeOptions = [
  { label: 'Bug 问题', value: 'bug' },
  { label: '功能建议', value: 'suggestion' },
  { label: '投诉建议', value: 'complaint' },
  { label: '其他', value: 'other' }
];

const feedbackStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  closed: { text: '已关闭', color: 'default' }
};

const sourceMap: Record<string, string> = {
  miniapp: '小程序',
  admin_web: '后台'
};

const roleMap: Record<string, string> = {
  superadmin: '超级管理员',
  tenant_admin: '街道管理员',
  mediator: '调解员',
  personal: '个人用户',
  company: '企业用户'
};

const managementExportColumns: ExcelColumn<any>[] = [
  { header: '反馈标题', key: 'title' },
  { header: '反馈内容', key: 'content' },
  { header: '提交人', key: 'userName' },
  { header: '用户角色', key: 'userRole', formatter: (row) => roleMap[row.userRole] || row.userRole || '' },
  { header: '来源', key: 'source', formatter: (row) => sourceMap[row.source] || row.source || '' },
  { header: '类型', key: 'type', formatter: (row) => feedbackTypeOptions.find(opt => opt.value === row.type)?.label || row.type || '' },
  { header: '状态', key: 'status', formatter: (row) => feedbackStatusMap[row.status]?.text || row.status || '' },
  { header: '联系人', key: 'contactName', formatter: (row) => row.contactName || '' },
  { header: '联系电话', key: 'contactPhone', formatter: (row) => row.contactPhone || '' },
  { header: '提交时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() },
  { header: '处理回复', key: 'replyContent', formatter: (row) => row.replyContent || '' }
];

const mineExportColumns: ExcelColumn<any>[] = [
  { header: '反馈标题', key: 'title' },
  { header: '反馈内容', key: 'content' },
  { header: '类型', key: 'type', formatter: (row) => feedbackTypeOptions.find(opt => opt.value === row.type)?.label || row.type || '' },
  { header: '来源', key: 'source', formatter: (row) => sourceMap[row.source] || row.source || '' },
  { header: '状态', key: 'status', formatter: (row) => feedbackStatusMap[row.status]?.text || row.status || '' },
  { header: '联系人', key: 'contactName', formatter: (row) => row.contactName || '' },
  { header: '联系电话', key: 'contactPhone', formatter: (row) => row.contactPhone || '' },
  { header: '提交时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() },
  { header: '处理回复', key: 'replyContent', formatter: (row) => row.replyContent || '' }
];

const FeedbackCenter: React.FC = () => {
  const { userInfo } = useAuthStore();
  const isSuperAdmin = userInfo?.role === 'superadmin' || !!userInfo?.isSuperAdmin;
  const isTenantAdmin = userInfo?.role === 'tenant_admin';
  const canManageScopedFeedback = isSuperAdmin || isTenantAdmin;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState<any[]>([]);
  const [allFeedbacks, setAllFeedbacks] = useState<any[]>([]);
  const [handleVisible, setHandleVisible] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<any>(null);
  const [handleStatus, setHandleStatus] = useState('processing');
  const [replyContent, setReplyContent] = useState('');
  const [managementFilters, setManagementFilters] = useState({
    keyword: '',
    status: '',
    type: '',
    source: ''
  });

  const fetchMyFeedbacks = async () => {
    try {
      const response = await api.get('/feedback/mine');
      setMyFeedbacks(response.data.feedbacks || []);
    } catch (error) {
      message.error('获取我的反馈失败');
    }
  };

  const fetchAllFeedbacks = async () => {
    if (!canManageScopedFeedback) return;
    try {
      const response = await api.get('/feedback', {
        params: {
          keyword: managementFilters.keyword || undefined,
          status: managementFilters.status || undefined,
          type: managementFilters.type || undefined,
          source: managementFilters.source || undefined
        }
      });
      setAllFeedbacks(response.data.feedbacks || []);
    } catch (error) {
      message.error('获取全部反馈失败');
    }
  };

  useEffect(() => {
    fetchMyFeedbacks();
    fetchAllFeedbacks();
  }, [canManageScopedFeedback, managementFilters.keyword, managementFilters.status, managementFilters.type, managementFilters.source]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await api.post('/feedback', {
        ...values,
        source: 'admin_web'
      });
      message.success('反馈已提交');
      form.resetFields();
      fetchMyFeedbacks();
      fetchAllFeedbacks();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '反馈提交失败');
    } finally {
      setLoading(false);
    }
  };

  const openHandleModal = (record: any) => {
    setCurrentFeedback(record);
    setHandleStatus(record.status || 'processing');
    setReplyContent(record.replyContent || '');
    setHandleVisible(true);
  };

  const handleUpdateStatus = async () => {
    if (!currentFeedback) return;
    setLoading(true);
    try {
      await api.put(`/feedback/${currentFeedback.id}/status`, {
        status: handleStatus,
        replyContent
      });
      message.success('反馈处理结果已保存');
      setHandleVisible(false);
      fetchAllFeedbacks();
      fetchMyFeedbacks();
    } catch (error: any) {
      message.error(error?.response?.data?.message || '反馈处理失败');
    } finally {
      setLoading(false);
    }
  };

  const myFeedbackList = useMemo(
    () => (
      <List
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有反馈记录，左侧填写后会在这里持续跟踪处理进度"
            />
          )
        }}
        dataSource={myFeedbacks}
        renderItem={(item) => (
          <List.Item style={{ padding: 0, border: 'none', marginBottom: 12 }}>
            <Card
              size="small"
              style={{
                width: '100%',
                borderRadius: 14,
                border: '1px solid #edf2f7',
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)'
              }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, gap: 16, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>{item.title}</div>
                  <Space size={8} wrap>
                    <Tag color="blue">{feedbackTypeOptions.find(opt => opt.value === item.type)?.label || item.type}</Tag>
                    <Tag>{sourceMap[item.source] || item.source}</Tag>
                  </Space>
                </div>
                <Tag color={feedbackStatusMap[item.status]?.color || 'default'} style={{ borderRadius: 999 }}>
                  {feedbackStatusMap[item.status]?.text || item.status}
                </Tag>
              </div>
              <div style={{ color: '#4b5563', marginBottom: 10, lineHeight: 1.8 }}>{item.content}</div>
              <Space size={12} wrap style={{ fontSize: 12, color: '#8c8c8c' }}>
                <span>提交时间：{new Date(item.createdAt).toLocaleString()}</span>
                {item.contactName ? <span>联系人：{item.contactName}</span> : null}
                {item.contactPhone ? <span>联系电话：{item.contactPhone}</span> : null}
              </Space>
              {item.replyContent && (
                <div
                  style={{
                    marginTop: 14,
                    background: 'linear-gradient(135deg, #f8fbff 0%, #f6faff 100%)',
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid #dbeafe'
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6, color: '#1d4ed8' }}>处理回复</div>
                  <div style={{ color: '#334155', lineHeight: 1.7 }}>{item.replyContent}</div>
                </div>
              )}
            </Card>
          </List.Item>
        )}
      />
    ),
    [myFeedbacks]
  );

  const myFeedbackStats = useMemo(() => ({
    total: myFeedbacks.length,
    pending: myFeedbacks.filter((item) => item.status === 'pending').length,
    processing: myFeedbacks.filter((item) => item.status === 'processing').length,
    resolved: myFeedbacks.filter((item) => item.status === 'resolved').length
  }), [myFeedbacks]);

  const managementStats = useMemo(() => ({
    total: allFeedbacks.length,
    pending: allFeedbacks.filter((item) => item.status === 'pending').length,
    processing: allFeedbacks.filter((item) => item.status === 'processing').length,
    resolved: allFeedbacks.filter((item) => item.status === 'resolved').length
  }), [allFeedbacks]);

  const pageTitle = canManageScopedFeedback ? '反馈中心与处理台' : '意见反馈';
  const pageDesc = canManageScopedFeedback
    ? '前台负责收集，后台负责分流、跟进和闭环回复。当前页同时承担提交与处理两类任务。'
    : '欢迎提交问题、建议或投诉，我们会根据内容尽快跟进并在处理后回复你。';
  const managementTitle = isSuperAdmin ? '全部反馈处理台' : '街道反馈处理台';

  const handleExportMine = () => {
    if (myFeedbacks.length === 0) {
      warnNoExportData('当前没有可导出的反馈记录');
      return;
    }
    exportExcel(buildExportFileName('我的反馈'), mineExportColumns, myFeedbacks);
    message.success(`已导出 ${myFeedbacks.length} 条反馈记录`);
  };

  const handleExportManagement = () => {
    if (allFeedbacks.length === 0) {
      warnNoExportData('当前没有可导出的反馈处理数据');
      return;
    }
    exportExcel(buildExportFileName(canManageScopedFeedback && isSuperAdmin ? '全部反馈处理台' : '街道反馈处理台'), managementExportColumns, allFeedbacks);
    message.success(`已导出 ${allFeedbacks.length} 条反馈记录`);
  };

  return (
    <div style={{ padding: 4, display: 'grid', gap: 20 }}>
      <Card
        bordered={false}
        style={{
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
              <Space size={10}>
                <Avatar
                  size={44}
                  icon={<MessageOutlined />}
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
                />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{pageTitle}</div>
                  <div style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>{pageDesc}</div>
                </div>
              </Space>
              <Space wrap>
                <Tag color="blue-inverse" style={{ borderRadius: 999 }}>当前身份：{roleMap[userInfo?.role || 'personal']}</Tag>
                <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>
                  {canManageScopedFeedback ? (isSuperAdmin ? '全局处理视角' : '街道处理视角') : '个人跟踪视角'}
                </Tag>
              </Space>
            </Space>
          </Col>
          <Col xs={24} lg={8}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>{canManageScopedFeedback ? '处理台总量' : '我的反馈'}</span>}
                    value={canManageScopedFeedback ? managementStats.total : myFeedbackStats.total}
                    valueStyle={{ color: '#fff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>待处理</span>}
                    value={canManageScopedFeedback ? managementStats.pending : myFeedbackStats.pending}
                    valueStyle={{ color: '#fff' }}
                  />
                </Card>
              </Col>
              {canManageScopedFeedback && (
                <>
                  <Col span={12}>
                    <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                      <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>处理中</span>} value={managementStats.processing} valueStyle={{ color: '#fff' }} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                      <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>已解决</span>} value={managementStats.resolved} valueStyle={{ color: '#fff' }} />
                    </Card>
                  </Col>
                </>
              )}
            </Row>
          </Col>
        </Row>
      </Card>

      {canManageScopedFeedback && (
        <Card
          bordered={false}
          style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
          bodyStyle={{ padding: 22 }}
        >
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>{managementTitle}</Title>
                <Text type="secondary">先在这里筛选、查看和处理反馈，再回到下方查看我的提交记录或新增反馈。</Text>
              </div>
              <Space wrap>
                <Tag color="default">总量 {managementStats.total}</Tag>
                <Tag color="orange">待处理 {managementStats.pending}</Tag>
                <Tag color="blue">处理中 {managementStats.processing}</Tag>
                <Tag color="green">已解决 {managementStats.resolved}</Tag>
                <ExportButton onClick={handleExportManagement} />
              </Space>
            </div>

            <Alert
              type="info"
              showIcon
              message="处理建议"
              description="先按标题、提交人或内容快速定位，再结合状态、类型和来源筛选，最后进入“查看并处理”完成回复闭环。"
            />

            <Row gutter={[12, 12]}>
              <Col xs={24} md={10} lg={8}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="按标题、内容、提交人搜索"
                  value={managementFilters.keyword}
                  onChange={(e) => setManagementFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                />
              </Col>
              <Col xs={24} sm={8} md={5} lg={4}>
                <Select
                  allowClear
                  placeholder="全部状态"
                  style={{ width: '100%' }}
                  value={managementFilters.status || undefined}
                  onChange={(value) => setManagementFilters((prev) => ({ ...prev, status: value || '' }))}
                  options={[
                    { label: '待处理', value: 'pending' },
                    { label: '处理中', value: 'processing' },
                    { label: '已解决', value: 'resolved' },
                    { label: '已关闭', value: 'closed' }
                  ]}
                />
              </Col>
              <Col xs={24} sm={8} md={5} lg={4}>
                <Select
                  allowClear
                  placeholder="全部类型"
                  style={{ width: '100%' }}
                  value={managementFilters.type || undefined}
                  onChange={(value) => setManagementFilters((prev) => ({ ...prev, type: value || '' }))}
                  options={feedbackTypeOptions}
                />
              </Col>
              <Col xs={24} sm={8} md={4} lg={4}>
                <Select
                  allowClear
                  placeholder="全部来源"
                  style={{ width: '100%' }}
                  value={managementFilters.source || undefined}
                  onChange={(value) => setManagementFilters((prev) => ({ ...prev, source: value || '' }))}
                  options={[
                    { label: '后台', value: 'admin_web' },
                    { label: '小程序', value: 'miniapp' }
                  ]}
                />
              </Col>
              <Col xs={24} md={24} lg={4}>
                <Button
                  style={{ width: '100%' }}
                  onClick={() => setManagementFilters({ keyword: '', status: '', type: '', source: '' })}
                >
                  重置筛选
                </Button>
              </Col>
            </Row>

            <Table
              rowKey="id"
              dataSource={allFeedbacks}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 1100 }}
              columns={[
                {
                  title: '反馈主题',
                  dataIndex: 'title',
                  width: 320,
                  render: (_value, record) => (
                    <div>
                      <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>{record.title}</div>
                      <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.7 }}>
                        {String(record.content || '').length > 80 ? `${String(record.content).slice(0, 80)}...` : record.content}
                      </div>
                    </div>
                  )
                },
                {
                  title: '提交人',
                  dataIndex: 'userName',
                  width: 150,
                  render: (_value, record) => (
                    <Space direction="vertical" size={2}>
                      <Text>{record.userName || '-'}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>{roleMap[record.userRole] || record.userRole || '-'}</Text>
                    </Space>
                  )
                },
                {
                  title: '来源 / 类型',
                  key: 'meta',
                  width: 170,
                  render: (_value, record) => (
                    <Space direction="vertical" size={4}>
                      <Tag>{sourceMap[record.source] || record.source}</Tag>
                      <Tag color="blue">{feedbackTypeOptions.find(opt => opt.value === record.type)?.label || record.type}</Tag>
                    </Space>
                  )
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 110,
                  render: (value) => (
                    <Tag color={feedbackStatusMap[value]?.color || 'default'} style={{ borderRadius: 999 }}>
                      {feedbackStatusMap[value]?.text || value}
                    </Tag>
                  )
                },
                {
                  title: '联系方式',
                  key: 'contact',
                  width: 180,
                  render: (_value, record) => (
                    <Space direction="vertical" size={2}>
                      <Text>{record.contactName || '未留联系人'}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        <PhoneOutlined style={{ marginRight: 6 }} />
                        {record.contactPhone || '无联系电话'}
                      </Text>
                    </Space>
                  )
                },
                {
                  title: '提交时间',
                  dataIndex: 'createdAt',
                  width: 180,
                  render: (value) => new Date(value).toLocaleString()
                },
                {
                  title: '处理',
                  width: 110,
                  fixed: 'right',
                  render: (_value, record) => (
                    <Button type="link" onClick={() => openHandleModal(record)}>
                      查看并处理
                    </Button>
                  )
                }
              ]}
            />
          </Space>
        </Card>
      )}

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={canManageScopedFeedback ? 10 : 9}>
          <Card
            bordered={false}
            style={{ borderRadius: 18, height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
            bodyStyle={{ padding: 22 }}
          >
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>提交新的反馈</Title>
                <Text type="secondary">标题要短，内容要具体，优先说明现象、影响和期望结果。</Text>
              </div>
              <Alert
                type="info"
                showIcon
                message="填写建议"
                description="问题类反馈建议写清复现步骤；建议类反馈建议补充你希望改成什么样。联系人和电话选填，仅用于回访。"
              />
              <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: 'suggestion' }}>
                <Form.Item
                  name="title"
                  label="反馈标题"
                  rules={[{ required: true, message: '请输入反馈标题' }]}
                >
                  <Input placeholder="例如：案件详情页状态文案不一致" />
                </Form.Item>
                <Form.Item
                  name="type"
                  label="反馈类型"
                  rules={[{ required: true, message: '请选择反馈类型' }]}
                >
                  <Select options={feedbackTypeOptions} placeholder="请选择反馈类型" />
                </Form.Item>
                <Form.Item
                  name="content"
                  label="反馈内容"
                  rules={[{ required: true, message: '请输入反馈内容' }]}
                >
                  <TextArea rows={7} placeholder="请尽量写清楚问题背景、复现步骤、影响范围，或你希望改成什么样。" />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="contactName" label="联系人">
                      <Input placeholder="选填，便于回访" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="contactPhone" label="联系电话">
                      <Input placeholder="选填" />
                    </Form.Item>
                  </Col>
                </Row>
                <Button type="primary" htmlType="submit" loading={loading} size="large" style={{ minWidth: 136, borderRadius: 10 }}>
                  提交反馈
                </Button>
              </Form>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={canManageScopedFeedback ? 14 : 15}>
          <Card
            bordered={false}
            style={{ borderRadius: 18, height: '100%', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
            bodyStyle={{ padding: 22 }}
          >
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>我的反馈进度</Title>
                  <Text type="secondary">所有提交记录与处理回复都会沉淀在这里，便于持续跟踪；管理端处理完成后也会同步更新。</Text>
                </div>
                <Space wrap>
                  <Tag color="orange">待处理 {myFeedbackStats.pending}</Tag>
                  <Tag color="blue">处理中 {myFeedbackStats.processing}</Tag>
                  <Tag color="green">已解决 {myFeedbackStats.resolved}</Tag>
                  <ExportButton onClick={handleExportMine} />
                </Space>
              </div>
              {myFeedbackList}
            </Space>
          </Card>
        </Col>
      </Row>

      <Modal
        title="处理反馈"
        open={handleVisible}
        onCancel={() => setHandleVisible(false)}
        onOk={handleUpdateStatus}
        okText="保存"
        okButtonProps={{ loading }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>{currentFeedback?.title}</div>
          <Space wrap style={{ marginBottom: 10 }}>
            {currentFeedback?.type ? (
              <Tag color="blue">{feedbackTypeOptions.find(opt => opt.value === currentFeedback.type)?.label || currentFeedback.type}</Tag>
            ) : null}
            {currentFeedback?.source ? <Tag>{sourceMap[currentFeedback.source] || currentFeedback.source}</Tag> : null}
            {currentFeedback?.userName ? <Tag color="purple">{currentFeedback.userName}</Tag> : null}
          </Space>
          <div style={{ color: '#595959', lineHeight: 1.8 }}>{currentFeedback?.content}</div>
        </div>
        <Form layout="vertical">
          <Form.Item label="处理状态">
            <Select
              value={handleStatus}
              onChange={setHandleStatus}
              options={[
                { label: '待处理', value: 'pending' },
                { label: '处理中', value: 'processing' },
                { label: '已解决', value: 'resolved' },
                { label: '已关闭', value: 'closed' }
              ]}
            />
          </Form.Item>
          <Form.Item label="处理回复">
            <TextArea
              rows={4}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="请输入给提交人的回复"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FeedbackCenter;
