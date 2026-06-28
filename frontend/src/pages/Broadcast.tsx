import { useState, useEffect, useMemo } from 'react';
import { Card, Form, Input, Select, Button, message, List, Badge, Tabs, Upload, Modal, Typography, Row, Col, Space, Avatar, Statistic, Tag, Empty, Alert } from 'antd';
import { SaveOutlined, BellOutlined, CheckCircleOutlined, FileOutlined, NotificationOutlined, AuditOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { ExportButton, PageHero, PageSectionCard, PageShell } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn } from '../utils/excel';

const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    return import.meta.env.PROD ? '/laodongzhongcai/api' : 'http://localhost:5003/api';
  }
  return baseUrl;
};

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Broadcast {
  id?: string;
  _id: string;
  title: string;
  content: string;
  type: string;
  urgency: string;
  status: string;
  creatorId: {
    name: string;
  };
  approverId?: {
    name: string;
  };
  createdAt: string;
  approvalTime?: string;
  rejectionReason?: string;
  attachments?: string[];
  readBy?: Array<{
    userId: string;
    readAt: string;
  }>;
}

const Broadcast: React.FC = () => {
  const [activeKey, setActiveKey] = useState('list');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [latestBroadcasts, setLatestBroadcasts] = useState<Broadcast[]>([]);
  const [pendingBroadcasts, setPendingBroadcasts] = useState<Broadcast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);
  const [approveForm] = Form.useForm();
  const [updateForm] = Form.useForm();
  const { userInfo, token } = useAuthStore();
  const uploadHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  const normalizeUploadFileList = (event: any) => {
    if (Array.isArray(event)) return event;
    return event?.fileList || [];
  };

  const extractAttachmentPaths = (attachments?: any[]) => (attachments || [])
    .map((file) => file?.response?.file?.path || file?.response?.file?.url || file?.url)
    .filter(Boolean);

  const toUploadFileList = (attachments?: string[]) => (attachments || []).map((attachment, index) => ({
    uid: `existing-${index}`,
    name: attachment.split('/').pop() || `附件${index + 1}`,
    status: 'done' as const,
    url: attachment,
    response: {
      file: {
        path: attachment,
        url: attachment
      }
    }
  }));

  const normalizeBroadcast = (broadcast: any): Broadcast => ({
    ...broadcast,
    _id: broadcast?._id || broadcast?.id || ''
  });

  const broadcastTypeOptions = [
    { label: '全员广播', value: 'all' },
    { label: '工作交接', value: 'handover' },
    { label: '特别通知', value: 'special' },
    { label: '日常通知', value: 'notice' },
    { label: '政策法规', value: 'policy' }
  ];

  const urgencyOptions = [
    { label: '普通', value: 'normal' },
    { label: '重要', value: 'important' },
    { label: '紧急', value: 'emergency' }
  ];

  const fetchBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast');
      setBroadcasts((response.data.broadcasts || []).map(normalizeBroadcast));
    } catch (error) {
      message.error('获取广播列表失败');
    }
  };

  const fetchLatestBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast/latest');
      setLatestBroadcasts((response.data.broadcasts || []).map(normalizeBroadcast));
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      message.error('获取最新广播失败');
    }
  };

  const fetchPendingBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast/pending/list');
      const normalized = (response.data.broadcasts || []).map(normalizeBroadcast);
      setPendingBroadcasts(normalized);
      setPendingCount(normalized.length);
    } catch (error) {
      message.error('获取待审核广播失败');
    }
  };

  useEffect(() => {
    if (activeKey === 'list') {
      fetchBroadcasts();
    } else if (activeKey === 'latest') {
      fetchLatestBroadcasts();
    } else if (activeKey === 'pending') {
      fetchPendingBroadcasts();
    } else if (activeKey === 'publish') {
      fetchBroadcasts();
      if (userInfo?.role === 'superadmin') fetchPendingBroadcasts();
    }
  }, [activeKey, userInfo?.role]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      values.attachments = extractAttachmentPaths(values.attachments);
      await api.post('/broadcast', values);
      message.success('广播已提交，等待审核');
      form.resetFields();
      fetchBroadcasts();
      if (userInfo?.role === 'superadmin') fetchPendingBroadcasts();
    } catch (error) {
      message.error('广播发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!currentBroadcast) return;

    setLoading(true);
    try {
      const values = await approveForm.validateFields();
      await api.put(`/broadcast/${currentBroadcast._id}/approve`, values);
      message.success(values.action === 'approve' ? '广播已批准' : '广播已驳回');
      setApproveModalVisible(false);
      fetchPendingBroadcasts();
      fetchBroadcasts();
    } catch (error) {
      message.error('审核操作失败');
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = (broadcast: Broadcast) => {
    setCurrentBroadcast(normalizeBroadcast(broadcast));
    approveForm.resetFields();
    setApproveModalVisible(true);
  };

  const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      all: '全员广播',
      handover: '工作交接',
      special: '特别通知',
      notice: '日常通知',
      policy: '政策法规'
    };
    return typeMap[type] || type;
  };

  const getUrgencyInfo = (urgency: string) => {
    const urgencyMap: Record<string, { text: string; color: string }> = {
      normal: { text: '普通', color: 'blue' },
      important: { text: '重要', color: 'orange' },
      emergency: { text: '紧急', color: 'red' }
    };
    return urgencyMap[urgency] || { text: urgency, color: 'blue' };
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: '待审核', color: 'default' },
      approved: { text: '已通过', color: 'success' },
      rejected: { text: '已驳回', color: 'error' }
    };
    return statusMap[status] || { text: status, color: 'default' };
  };

  const isRead = (broadcast: Broadcast) => {
    if (!userInfo?.id || !broadcast.readBy) return false;
    return broadcast.readBy.some(item => item.userId === userInfo.id);
  };

  const markAsRead = async (broadcastId: string) => {
    try {
      await api.get(`/broadcast/${broadcastId}`);
      message.success('已标记为已读');
      fetchLatestBroadcasts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleUpdate = async () => {
    if (!currentBroadcast) return;

    setLoading(true);
    try {
      const values = await updateForm.validateFields();
      values.attachments = extractAttachmentPaths(values.attachments);
      await api.put(`/broadcast/${currentBroadcast._id}`, values);
      message.success('广播已修改并重新提交审核');
      setUpdateModalVisible(false);
      fetchBroadcasts();
    } catch (error) {
      message.error('修改广播失败');
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (broadcast: Broadcast) => {
    setCurrentBroadcast(normalizeBroadcast(broadcast));
    updateForm.setFieldsValue({
      title: broadcast.title,
      type: broadcast.type,
      urgency: broadcast.urgency,
      content: broadcast.content,
      attachments: toUploadFileList(broadcast.attachments)
    });
    setUpdateModalVisible(true);
  };

  const stats = useMemo(() => ({
    total: broadcasts.length,
    unread: unreadCount,
    pending: broadcasts.filter((item) => item.status === 'pending').length,
    rejected: broadcasts.filter((item) => item.status === 'rejected').length
  }), [broadcasts, unreadCount]);

  const broadcastExportColumns: ExcelColumn<Broadcast>[] = [
    { header: '标题', key: 'title' },
    { header: '类型', key: 'type', formatter: (row) => getTypeText(row.type) },
    { header: '紧急程度', key: 'urgency', formatter: (row) => getUrgencyInfo(row.urgency).text },
    { header: '状态', key: 'status', formatter: (row) => getStatusInfo(row.status).text },
    { header: '发布人', key: 'creatorId', formatter: (row) => row.creatorId?.name || '' },
    { header: '审核人', key: 'approverId', formatter: (row) => row.approverId?.name || '' },
    { header: '正文', key: 'content' },
    { header: '驳回原因', key: 'rejectionReason', formatter: (row) => row.rejectionReason || '' },
    { header: '创建时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];

  const handleExport = (type: 'list' | 'latest' | 'pending') => {
    const rows = type === 'list' ? broadcasts : type === 'latest' ? latestBroadcasts : pendingBroadcasts;
    if (rows.length === 0) {
      message.warning('当前没有可导出的广播数据');
      return;
    }
    const filePrefix = type === 'list' ? '广播列表' : type === 'latest' ? '最新广播' : '待审核广播';
    exportExcel(buildExportFileName(filePrefix), broadcastExportColumns, rows);
    message.success(`已导出 ${rows.length} 条广播记录`);
  };

  const renderAttachmentLine = (attachments?: string[]) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        附件：
        {attachments.map((attachment, index) => (
          <Space key={index} size={8} style={{ marginRight: 12, marginBottom: 6, display: 'inline-flex' }}>
            <a
              href={attachment}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#1677ff' }}
            >
              <FileOutlined /> {attachment.split('/').pop()}
            </a>
            <a
              href={attachment}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#8c8c8c' }}
              title="预览附件"
            >
              <EyeOutlined />
            </a>
            <a
              href={attachment}
              download
              style={{ color: '#8c8c8c' }}
              title="下载附件"
            >
              <DownloadOutlined />
            </a>
          </Space>
        ))}
      </div>
    );
  };

  return (
    <PageShell>
      <PageHero
        tone="violet"
        icon={<NotificationOutlined />}
        title="站内广播中心"
        description="统一管理通知发布、阅读跟踪和审核流转。发布、查看、待审核三类任务建议分开处理，避免信息混杂。"
        tags={
          <>
            <Tag color="purple-inverse" style={{ borderRadius: 999 }}>发布与审核分离</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>最新广播优先阅读</Tag>
          </>
        }
        metrics={
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>广播总量</span>} value={stats.total} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" bordered={false} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.08)' }}>
                <Statistic title={<span style={{ color: 'rgba(255,255,255,0.72)' }}>未读</span>} value={stats.unread} valueStyle={{ color: '#fff' }} />
              </Card>
            </Col>
          </Row>
        }
      />

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        style={{ marginBottom: 24 }}
        items={[
          ...((['mediator', 'tenant_admin', 'superadmin'].includes(userInfo?.role || '')) ? [{
            key: 'publish',
            label: '发布广播',
            children: (
              <PageSectionCard>
                <Row gutter={[20, 20]}>
                  <Col xs={24} xl={9}>
                    <Space direction="vertical" size={18} style={{ width: '100%' }}>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>新建广播</Title>
                        <Text type="secondary">建议先确定广播对象和紧急程度，再撰写正文和补充附件。</Text>
                      </div>
                      <Alert
                        type="info"
                        showIcon
                        message="发布建议"
                        description="全员广播会下发给所有用户；其他类型更适合内部管理场景。街道管理员仅能管理本街道广播。"
                      />
                      <Row gutter={[12, 12]}>
                        <Col span={12}>
                          <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#faf5ff' }}>
                            <Statistic title="待审核" value={stats.pending} prefix={<AuditOutlined />} />
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card size="small" bordered={false} style={{ borderRadius: 14, background: '#fff7e6' }}>
                            <Statistic title="被驳回" value={stats.rejected} prefix={<BellOutlined />} />
                          </Card>
                        </Col>
                      </Row>
                    </Space>
                  </Col>
                  <Col xs={24} xl={15}>
                    <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ urgency: 'normal', type: 'notice' }}>
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
                            <Input placeholder="请输入广播标题" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择广播类型' }]}>
                            <Select placeholder="请选择广播类型" options={broadcastTypeOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item name="urgency" label="紧急程度" rules={[{ required: true, message: '请选择紧急程度' }]}>
                            <Select placeholder="请选择紧急程度" options={urgencyOptions} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入广播内容' }]}>
                        <TextArea rows={8} placeholder="请输入广播正文，建议写明背景、执行要求和时间节点。" />
                      </Form.Item>
                      <Form.Item
                        name="attachments"
                        label="附件"
                        valuePropName="fileList"
                        getValueFromEvent={normalizeUploadFileList}
                      >
                        <Upload
                          action={`${getApiBaseUrl()}/evidence`}
                          multiple
                          maxCount={5}
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          data={{ caseId: 'broadcast' }}
                          headers={uploadHeaders}
                        >
                          <Button icon={<FileOutlined />}>上传附件</Button>
                        </Upload>
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} size="large" style={{ borderRadius: 10 }}>
                        提交广播
                      </Button>
                    </Form>
                  </Col>
                </Row>
              </PageSectionCard>
            )
          }] : []),
          {
            key: 'list',
            label: '广播列表',
            children: (
              <PageSectionCard>
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>历史广播</Title>
                    <Text type="secondary">查看已提交广播的状态、附件和审核反馈，被驳回的内容可直接修改后重新提交。</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ExportButton onClick={() => handleExport('list')} />
                  </div>
                  <List
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无广播记录" /> }}
                    dataSource={broadcasts}
                    renderItem={(item) => {
                      const urgencyInfo = getUrgencyInfo(item.urgency);
                      const statusInfo = getStatusInfo(item.status);
                      return (
                        <List.Item style={{ padding: 0, border: 'none', marginBottom: 12 }}>
                          <Card bordered={false} style={{ width: '100%', borderRadius: 16, background: '#fafcff', border: '1px solid #edf2f7' }} bodyStyle={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
                                <Space wrap size={8}>
                                  <Tag color="blue">{getTypeText(item.type)}</Tag>
                                  <Tag color={urgencyInfo.color}>{urgencyInfo.text}</Tag>
                                  <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
                                </Space>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                              </Text>
                            </div>
                            <div style={{ color: '#4b5563', lineHeight: 1.8, marginBottom: 12 }}>{item.content}</div>
                            {renderAttachmentLine(item.attachments)}
                            {item.approverId && (
                              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                                审核人：{item.approverId?.name || '未知'} · {item.approvalTime ? new Date(item.approvalTime).toLocaleString() : ''}
                              </div>
                            )}
                            {item.status === 'rejected' && item.rejectionReason && (
                              <Alert type="error" showIcon style={{ borderRadius: 12, marginTop: 10 }} message="驳回原因" description={item.rejectionReason} />
                            )}
                            {item.status === 'rejected' && item.creatorId?.name === userInfo?.name && (
                              <Button type="primary" onClick={() => openUpdateModal(item)} style={{ marginTop: 12 }}>
                                修改并重新提交
                              </Button>
                            )}
                          </Card>
                        </List.Item>
                      );
                    }}
                  />
                </Space>
              </PageSectionCard>
            )
          },
          {
            key: 'latest',
            label: <span>最新广播 {unreadCount > 0 && <Badge count={unreadCount} />}</span>,
            children: (
              <PageSectionCard>
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>最新广播</Title>
                    <Text type="secondary">这里聚焦最新下发的广播，优先处理未读和紧急内容。</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ExportButton onClick={() => handleExport('latest')} />
                  </div>
                  <List
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无最新广播" /> }}
                    dataSource={latestBroadcasts}
                    renderItem={(item) => {
                      const urgencyInfo = getUrgencyInfo(item.urgency);
                      const read = isRead(item);
                      return (
                        <List.Item style={{ padding: 0, border: 'none', marginBottom: 12 }}>
                          <Card bordered={false} style={{ width: '100%', borderRadius: 16, background: read ? '#fafcff' : '#f5f3ff', border: '1px solid #edf2f7' }} bodyStyle={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                              <div>
                                <div style={{ fontWeight: read ? 600 : 700, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
                                <Space wrap size={8}>
                                  <Tag color={urgencyInfo.color}>{urgencyInfo.text}</Tag>
                                  {!read && <Tag color="magenta">未读</Tag>}
                                </Space>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {new Date(item.createdAt).toLocaleString()}
                              </Text>
                            </div>
                            <div style={{ color: '#4b5563', lineHeight: 1.8, marginBottom: 12 }}>{item.content}</div>
                            {renderAttachmentLine(item.attachments)}
                            {!read && (
                              <Button type="primary" onClick={() => markAsRead(item._id)} style={{ marginTop: 12 }}>
                                标记为已读
                              </Button>
                            )}
                          </Card>
                        </List.Item>
                      );
                    }}
                  />
                </Space>
              </PageSectionCard>
            )
          },
          ...((userInfo?.role === 'superadmin') ? [{
            key: 'pending',
            label: <span>待审核 {pendingCount > 0 && <Badge count={pendingCount} />}</span>,
            children: (
              <PageSectionCard>
                <Space direction="vertical" size={18} style={{ width: '100%' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>待审核广播</Title>
                    <Text type="secondary">集中处理待审核广播，优先确认对象范围、内容合规性和紧急程度。</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ExportButton onClick={() => handleExport('pending')} />
                  </div>
                  <List
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待审核广播" /> }}
                    dataSource={pendingBroadcasts}
                    renderItem={(item) => {
                      const urgencyInfo = getUrgencyInfo(item.urgency);
                      return (
                        <List.Item style={{ padding: 0, border: 'none', marginBottom: 12 }}>
                          <Card bordered={false} style={{ width: '100%', borderRadius: 16, background: '#fffbeb', border: '1px solid #fde68a' }} bodyStyle={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{item.title}</div>
                                <Space wrap size={8}>
                                  <Tag color="blue">{getTypeText(item.type)}</Tag>
                                  <Tag color={urgencyInfo.color}>{urgencyInfo.text}</Tag>
                                  <Tag>待审核</Tag>
                                </Space>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                              </Text>
                            </div>
                            <div style={{ color: '#4b5563', lineHeight: 1.8, marginBottom: 12 }}>{item.content}</div>
                            {renderAttachmentLine(item.attachments)}
                            <Button type="primary" onClick={() => openApproveModal(item)} style={{ marginTop: 12 }}>
                              审核处理
                            </Button>
                          </Card>
                        </List.Item>
                      );
                    }}
                  />
                </Space>
              </PageSectionCard>
            )
          }] : [])
        ]}
      />

      <Modal
        title="审核广播"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        onOk={handleApprove}
        okButtonProps={{ loading }}
      >
        {currentBroadcast && (
          <div>
            <h3>{currentBroadcast.title}</h3>
            <p style={{ marginBottom: 16 }}>{currentBroadcast.content}</p>
            <Form form={approveForm} layout="vertical">
              <Form.Item name="action" label="审核操作" rules={[{ required: true, message: '请选择审核操作' }]}>
                <Select placeholder="请选择审核操作">
                  <Option value="approve">通过</Option>
                  <Option value="reject">驳回</Option>
                </Select>
              </Form.Item>
              <Form.Item name="content" label="修改内容（可选）">
                <TextArea rows={4} placeholder="可修改广播内容" />
              </Form.Item>
              <Form.Item
                name="reason"
                label="驳回原因"
                dependencies={['action']}
                rules={[
                  ({ getFieldValue }) => {
                    if (getFieldValue('action') === 'reject' && !getFieldValue('reason')) {
                      return { required: true, message: '请填写驳回原因' };
                    }
                    return {};
                  }
                ]}
              >
                <TextArea rows={4} placeholder="请填写驳回原因" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="修改广播"
        open={updateModalVisible}
        onCancel={() => setUpdateModalVisible(false)}
        onOk={handleUpdate}
        okButtonProps={{ loading }}
        width={600}
      >
        {currentBroadcast && (
          <div>
            <Form form={updateForm} layout="vertical">
              <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
                <Input placeholder="请输入广播标题" />
              </Form.Item>
              <Form.Item
                name="type"
                label="类型"
                extra="全员广播会下发给所有用户，其他类型仅后台内部人员可见；街道管理员仅能管理本街道广播。"
                rules={[{ required: true, message: '请选择广播类型' }]}
              >
                <Select placeholder="请选择广播类型">
                  {broadcastTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="urgency" label="紧急程度" rules={[{ required: true, message: '请选择紧急程度' }]}>
                <Select placeholder="请选择紧急程度">
                  {urgencyOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入广播内容' }]}>
                <TextArea rows={6} placeholder="请输入广播内容" />
              </Form.Item>
              <Form.Item
                name="attachments"
                label="附件"
                valuePropName="fileList"
                getValueFromEvent={normalizeUploadFileList}
              >
                <Upload
                  action={`${getApiBaseUrl()}/evidence`}
                  multiple
                  maxCount={5}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  data={{ caseId: 'broadcast' }}
                  headers={uploadHeaders}
                >
                  <Button icon={<FileOutlined />}>上传附件</Button>
                </Upload>
              </Form.Item>
              {currentBroadcast.rejectionReason && (
                <Alert type="error" showIcon style={{ borderRadius: 12 }} message="驳回原因" description={currentBroadcast.rejectionReason} />
              )}
            </Form>
          </div>
        )}
      </Modal>
    </PageShell>
  );
};

export default Broadcast;
