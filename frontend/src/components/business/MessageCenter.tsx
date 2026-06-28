import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Button, Avatar, Modal, Empty, message, Spin } from 'antd';
import { BellOutlined, MessageOutlined, CheckCircleOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { ExportButton } from '../common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn } from '../../utils/excel';

interface Message {
  id?: string;
  _id?: string;
  content: string;
  type: 'system' | 'popup' | 'case_message' | string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  receiverName?: string;
  caseId?: string;
  caseNumber?: string;
  isRead: boolean;
  createdAt: string;
}

const MessageCenter: React.FC = () => {
  const { userInfo } = useAuthStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const getMessageId = (msg: Message) => msg._id || msg.id || '';
  const getSenderDisplayName = (msg: Message) => msg.senderName || '系统';
  const getCaseDisplay = (msg: Message) => msg.caseNumber || msg.caseId || '';

  const exportColumns: ExcelColumn<Message>[] = [
    { header: '发送方', key: 'senderName', formatter: (row) => getSenderDisplayName(row) },
    { header: '消息类型', key: 'type' },
    { header: '内容', key: 'content' },
    { header: '案件编号', key: 'caseNumber', formatter: (row) => getCaseDisplay(row) },
    { header: '是否已读', key: 'isRead', formatter: (row) => row.isRead ? '已读' : '未读' },
    { header: '接收时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];

  // 获取消息列表
  const fetchMessages = async () => {
    if (!userInfo) return;
    
    setLoading(true);
    try {
      const response = await api.get('/message');
      setMessages(response.data.messages || []);
    } catch (error) {
      message.error('获取消息列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取未读消息数量
  const fetchUnreadCount = async () => {
    if (!userInfo) return;
    
    try {
      const response = await api.get('/message/unread-count');
      setUnreadCount(response.data.count || 0);
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
    }
  };

  // 标记消息为已读
  const markAsRead = async (messageId: string) => {
    try {
      await api.put(`/message/${messageId}/read`);
      setMessages(prev => prev.map(msg => 
        getMessageId(msg) === messageId ? { ...msg, isRead: true } : msg
      ));
      fetchUnreadCount();
    } catch (error) {
      message.error('标记消息为已读失败');
    }
  };

  // 标记所有消息为已读
  const markAllAsRead = async () => {
    try {
      await api.put('/message/read-all');
      setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      message.error('标记所有消息为已读失败');
    }
  };

  // 删除消息
  const deleteMessage = async (messageId: string) => {
    try {
      await api.delete(`/message/${messageId}`);
      setMessages(prev => prev.filter(msg => getMessageId(msg) !== messageId));
      fetchUnreadCount();
    } catch (error) {
      message.error('删除消息失败');
    }
  };

  // 查看消息详情
  const viewMessage = (message: Message) => {
    setSelectedMessage(message);
    setModalVisible(true);
    if (!message.isRead) {
      markAsRead(getMessageId(message));
    }
  };

  const goToCaseDetail = (msg: Message) => {
    if (!msg.caseId) return;
    setModalVisible(false);
    navigate(`/case/${msg.caseId}`);
  };

  const handleExport = () => {
    if (messages.length === 0) {
      message.warning('当前没有可导出的消息');
      return;
    }
    exportExcel(buildExportFileName('消息中心'), exportColumns, messages);
    message.success(`已导出 ${messages.length} 条消息`);
  };

  // 组件挂载时获取消息
  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
  }, [userInfo]);

  // 获取消息类型图标
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'system':
        return <MessageOutlined style={{ color: '#1890ff' }} />;
      case 'popup':
        return <BellOutlined style={{ color: '#faad14' }} />;
      case 'case_message':
        return <MessageOutlined style={{ color: '#722ed1' }} />;
      default:
        return <MessageOutlined />;
    }
  };

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>消息中心</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <ExportButton onClick={handleExport} />
              {unreadCount > 0 && (
                <Button type="link" onClick={markAllAsRead}>
                  标记全部已读
                </Button>
              )}
            </div>
          </div>
        }
        extra={
          <Badge count={unreadCount} showZero>
            <BellOutlined style={{ fontSize: 20 }} />
          </Badge>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin indicator={<LoadingOutlined spin />} />
          </div>
        ) : messages.length > 0 ? (
          <List
            dataSource={messages}
            key="_id"
            renderItem={(message) => (
              <List.Item
                key={getMessageId(message)}
                className={!message.isRead ? 'unread-message' : ''}
                style={{
                  backgroundColor: !message.isRead ? '#f0f7ff' : 'transparent',
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: '12px 16px'
                }}
                onClick={() => viewMessage(message)}
              >
                <List.Item.Meta
                  avatar={
                    <Badge dot={!message.isRead}>
                      <Avatar icon={getMessageIcon(message.type)} />
                    </Badge>
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{getSenderDisplayName(message)}</span>
                      <span style={{ fontSize: 12, color: '#999' }}>
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                  }
                  description={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ maxWidth: '80%' }}>{message.content}</span>
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(getMessageId(message));
                        }}
                      />
                    </div>
                  }
                />
                {message.caseId && (
                  <div style={{ fontSize: 12, color: '#1890ff', marginTop: 4 }}>
                    案件编号：{getCaseDisplay(message)}
                  </div>
                )}
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无消息" />
        )}
      </Card>

      {/* 消息详情模态框 */}
      <Modal
        title="消息详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedMessage && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <Avatar icon={getMessageIcon(selectedMessage.type)} style={{ marginRight: 8 }} />
                <div>
                  <div style={{ fontWeight: 'bold' }}>
                    {getSenderDisplayName(selectedMessage)}
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 16, lineHeight: 1.5 }}>
                {selectedMessage.content}
              </div>
              {selectedMessage.caseId && (
                <div style={{ padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>案件信息</div>
                  <div>案件编号：{getCaseDisplay(selectedMessage)}</div>
                </div>
              )}
            </div>
            {!selectedMessage.isRead && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => markAsRead(getMessageId(selectedMessage))}
                style={{ marginRight: 8 }}
              >
                标记为已读
              </Button>
            )}
            {selectedMessage.caseId && (
              <Button
                style={{ marginRight: 8 }}
                onClick={() => goToCaseDetail(selectedMessage)}
              >
                查看案件
              </Button>
            )}
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                deleteMessage(getMessageId(selectedMessage));
                setModalVisible(false);
              }}
            >
              删除消息
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MessageCenter;
