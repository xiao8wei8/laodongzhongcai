import { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Button, message, List, Badge, Tabs, Upload, Modal, Typography } from 'antd';
import { SaveOutlined, BellOutlined, CheckCircleOutlined, FileOutlined } from '@ant-design/icons';

const { Title } = Typography;
import api from '../services/api';
import useAuthStore from '../store/authStore';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

interface Broadcast {
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
  const { userInfo } = useAuthStore();

  // 广播类型选项
  const broadcastTypeOptions = [
    { label: '工作交接', value: 'handover' },
    { label: '特别通知', value: 'special' },
    { label: '日常通知', value: 'notice' },
    { label: '政策法规', value: 'policy' }
  ];

  // 紧急程度选项
  const urgencyOptions = [
    { label: '普通', value: 'normal' },
    { label: '重要', value: 'important' },
    { label: '紧急', value: 'emergency' }
  ];



  // 获取广播列表
  const fetchBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast');
      setBroadcasts(response.data.broadcasts);
    } catch (error) {
      message.error('获取广播列表失败');
    }
  };

  // 获取最新广播
  const fetchLatestBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast/latest');
      setLatestBroadcasts(response.data.broadcasts);
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      message.error('获取最新广播失败');
    }
  };

  // 获取待审核广播
  const fetchPendingBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast/pending/list');
      setPendingBroadcasts(response.data.broadcasts);
      setPendingCount(response.data.broadcasts.length);
    } catch (error) {
      message.error('获取待审核广播失败');
    }
  };

  // 切换标签时获取数据
  useEffect(() => {
    if (activeKey === 'list') {
      fetchBroadcasts();
    } else if (activeKey === 'latest') {
      fetchLatestBroadcasts();
    } else if (activeKey === 'pending') {
      fetchPendingBroadcasts();
    }
  }, [activeKey]);

  // 提交广播
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = await form.validateFields();
      await api.post('/broadcast', values);
      message.success('广播已提交，等待审核');
      form.resetFields();
      fetchBroadcasts();
    } catch (error) {
      message.error('广播发布失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核广播
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

  // 打开审核模态框
  const openApproveModal = (broadcast: Broadcast) => {
    setCurrentBroadcast(broadcast);
    approveForm.resetFields();
    setApproveModalVisible(true);
  };

  // 获取广播类型文本
  const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      handover: '工作交接',
      special: '特别通知',
      notice: '日常通知',
      policy: '政策法规'
    };
    return typeMap[type] || type;
  };

  // 获取紧急程度文本和样式
  const getUrgencyInfo = (urgency: string) => {
    const urgencyMap: Record<string, { text: string; color: string }> = {
      normal: { text: '普通', color: 'blue' },
      important: { text: '重要', color: 'orange' },
      emergency: { text: '紧急', color: 'red' }
    };
    return urgencyMap[urgency] || { text: urgency, color: 'blue' };
  };

  // 获取状态文本和样式
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      pending: { text: '待审核', color: 'default' },
      approved: { text: '已通过', color: 'success' },
      rejected: { text: '已驳回', color: 'error' }
    };
    return statusMap[status] || { text: status, color: 'default' };
  };

  // 检查是否已读
  const isRead = (broadcast: Broadcast) => {
    if (!userInfo?.id || !broadcast.readBy) return false;
    return broadcast.readBy.some(item => item.userId === userInfo.id);
  };

  // 标记为已读
  const markAsRead = async (broadcastId: string) => {
    try {
      await api.get(`/broadcast/${broadcastId}`);
      message.success('已标记为已读');
      fetchLatestBroadcasts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 修改被驳回的广播
  const handleUpdate = async () => {
    if (!currentBroadcast) return;
    
    setLoading(true);
    try {
      const values = await updateForm.validateFields();
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

  // 打开修改模态框
  const openUpdateModal = (broadcast: Broadcast) => {
    setCurrentBroadcast(broadcast);
    updateForm.setFieldsValue({
      title: broadcast.title,
      type: broadcast.type,
      urgency: broadcast.urgency,
      content: broadcast.content,
      attachments: broadcast.attachments
    });
    setUpdateModalVisible(true);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BellOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={2} style={{ margin: 0, fontSize: '18px' }}>站内广播</Title>
      </div>
      <Tabs activeKey={activeKey} onChange={setActiveKey} style={{ marginBottom: 24 }}>
        {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
          <TabPane tab="发布广播" key="publish">
            <Card>
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                  name="title"
                  label="标题"
                  rules={[{ required: true, message: '请输入标题' }]}
                >
                  <Input placeholder="请输入广播标题" />
                </Form.Item>
                <Form.Item
                  name="type"
                  label="类型"
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
                <Form.Item
                  name="urgency"
                  label="紧急程度"
                  rules={[{ required: true, message: '请选择紧急程度' }]}
                >
                  <Select placeholder="请选择紧急程度">
                    {urgencyOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item
                  name="content"
                  label="内容"
                  rules={[{ required: true, message: '请输入广播内容' }]}
                >
                  <TextArea rows={6} placeholder="请输入广播内容" />
                </Form.Item>
                <Form.Item
                  name="attachments"
                  label="附件"
                >
                  <Upload
                    action="/api/evidence"
                    multiple
                    maxCount={5}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    data={{ caseId: 'broadcast' }}
                  >
                    <Button icon={<FileOutlined />}>上传附件</Button>
                  </Upload>
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                    发布广播
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </TabPane>
        )}
        <TabPane tab="广播列表" key="list">
          <Card>
            <List
              dataSource={broadcasts}
              renderItem={(item) => {
                const urgencyInfo = getUrgencyInfo(item.urgency);
                const statusInfo = getStatusInfo(item.status);
                return (
                  <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold' }}>{item.title}</span>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            类型：{getTypeText(item.type)}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            紧急程度：{urgencyInfo.text}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            状态：{statusInfo.text}
                          </span>
                        </div>
                        <p style={{ margin: 0, lineHeight: '1.5', fontSize: 13 }}>{item.content}</p>
                      </div>
                      {item.attachments && item.attachments.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                          附件：
                          {item.attachments.map((attachment, index) => (
                            <span key={index} style={{ marginRight: 12, display: 'inline-block' }}>
                              <FileOutlined /> {attachment.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.approverId && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                          审核人：{item.approverId?.name || '未知'} · {item.approvalTime ? new Date(item.approvalTime).toLocaleString() : ''}
                        </div>
                      )}
                      {item.status === 'rejected' && item.rejectionReason && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#ff4d4f', padding: 8, backgroundColor: '#fff1f0', borderRadius: 4 }}>
                          驳回原因：{item.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 20 }}>
                      <Badge color={urgencyInfo.color} text={urgencyInfo.text} />
                      <Badge status={statusInfo.color as any} text={statusInfo.text} />
                      {item.status === 'rejected' && item.creatorId?.name === userInfo?.name && (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => openUpdateModal(item)}
                        >
                          修改
                        </Button>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </TabPane>
        <TabPane 
          tab={
            <span>
              最新广播 {unreadCount > 0 && <Badge count={unreadCount} />}
            </span>
          } 
          key="latest"
        >
          <Card>
            <List
              dataSource={latestBroadcasts}
              renderItem={(item) => {
                const urgencyInfo = getUrgencyInfo(item.urgency);
                const read = isRead(item);
                return (
                  <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ marginRight: 12, color: urgencyInfo.color, display: 'flex', alignItems: 'flex-start', marginTop: 2 }}>
                      <BellOutlined />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: read ? 'normal' : 'bold' }}>{item.title}</span>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            发布人：{item.creatorId?.name || '未知'}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            类型：{getTypeText(item.type)}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            紧急程度：{urgencyInfo.text}
                          </span>
                        </div>
                        <p style={{ margin: 0, lineHeight: '1.5', fontSize: 13 }}>{item.content}</p>
                      </div>
                      {item.attachments && item.attachments.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                          附件：
                          {item.attachments.map((attachment, index) => (
                            <span key={index} style={{ marginRight: 12, display: 'inline-block' }}>
                              <FileOutlined /> {attachment.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 20 }}>
                      {!read && (
                        <Button
                          type="link"
                          icon={<CheckCircleOutlined />}
                          onClick={() => markAsRead(item._id)}
                          size="small"
                        >
                          标记已读
                        </Button>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </TabPane>
        {userInfo?.role === 'admin' && (
          <TabPane 
            tab={
              <span>
                待审核 {pendingCount > 0 && <Badge count={pendingCount} />}
              </span>
            } 
            key="pending"
          >
            <Card>
              <List
              dataSource={pendingBroadcasts}
              renderItem={(item) => {
                const urgencyInfo = getUrgencyInfo(item.urgency);
                return (
                  <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 'bold' }}>{item.title}</span>
                        <span style={{ fontSize: 12, color: '#999' }}>
                          {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            类型：{getTypeText(item.type)}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            紧急程度：{urgencyInfo.text}
                          </span>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            状态：待审核
                          </span>
                        </div>
                        <p style={{ margin: 0, lineHeight: '1.5', fontSize: 13 }}>{item.content}</p>
                      </div>
                      {item.attachments && item.attachments.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                          附件：
                          {item.attachments.map((attachment, index) => (
                            <span key={index} style={{ marginRight: 12, display: 'inline-block' }}>
                              <FileOutlined /> {attachment.split('/').pop()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginLeft: 20 }}>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => openApproveModal(item)}
                        size="small"
                      >
                        审核
                      </Button>
                    </div>
                  </List.Item>
                );
              }}
            />
            </Card>
          </TabPane>
        )}
      </Tabs>

      {/* 审核模态框 */}
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
              <Form.Item
                name="action"
                label="审核操作"
                rules={[{ required: true, message: '请选择审核操作' }]}
              >
                <Select placeholder="请选择审核操作">
                  <Option value="approve">通过</Option>
                  <Option value="reject">驳回</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="content"
                label="修改内容（可选）"
              >
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

      {/* 修改广播模态框 */}
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
              <Form.Item
                name="title"
                label="标题"
                rules={[{ required: true, message: '请输入标题' }]}
              >
                <Input placeholder="请输入广播标题" />
              </Form.Item>
              <Form.Item
                name="type"
                label="类型"
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
              <Form.Item
                name="urgency"
                label="紧急程度"
                rules={[{ required: true, message: '请选择紧急程度' }]}
              >
                <Select placeholder="请选择紧急程度">
                  {urgencyOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="content"
                label="内容"
                rules={[{ required: true, message: '请输入广播内容' }]}
              >
                <TextArea rows={6} placeholder="请输入广播内容" />
              </Form.Item>
              <Form.Item
                name="attachments"
                label="附件"
              >
                <Upload
                  action="/api/evidence"
                  multiple
                  maxCount={5}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  data={{ caseId: 'broadcast' }}
                >
                  <Button icon={<FileOutlined />}>上传附件</Button>
                </Upload>
              </Form.Item>
              {currentBroadcast.rejectionReason && (
                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fff1f0', borderRadius: 4 }}>
                  <p style={{ margin: 0, color: '#ff4d4f', fontSize: 14 }}>
                    <strong>驳回原因：</strong>{currentBroadcast.rejectionReason}
                  </p>
                </div>
              )}
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Broadcast;
