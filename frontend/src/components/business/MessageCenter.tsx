import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Button, Avatar, Modal, Empty, message, Spin } from 'antd';
import { BellOutlined, MessageOutlined, CheckCircleOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

interface Message {
  _id: string;
  content: string;
  type: 'system' | 'popup' | 'sms';
  recipientId: string;
  senderId?: {
    name: string;
  };
  caseId?: {
    caseNumber: string;
  };
  isRead: boolean;
  createdAt: string;
}

const MessageCenter: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
        msg._id === messageId ? { ...msg, isRead: true } : msg
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
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
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
      markAsRead(message._id);
    }
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
      case 'sms':
        return <MessageOutlined style={{ color: '#52c41a' }} />;
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
            {unreadCount > 0 && (
              <Button type="link" onClick={markAllAsRead}>
                标记全部已读
              </Button>
            )}
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
                key={message._id}
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
                      <span>{message.senderId?.name || '系统'}</span>
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
                          deleteMessage(message._id);
                        }}
                      />
                    </div>
                  }
                />
                {message.caseId && (
                  <div style={{ fontSize: 12, color: '#1890ff', marginTop: 4 }}>
                    案件编号：{message.caseId.caseNumber}
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
                    {selectedMessage.senderId?.name || '系统'}
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
                  <div>案件编号：{selectedMessage.caseId.caseNumber}</div>
                </div>
              )}
            </div>
            {!selectedMessage.isRead && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => markAsRead(selectedMessage._id)}
                style={{ marginRight: 8 }}
              >
                标记为已读
              </Button>
            )}
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                deleteMessage(selectedMessage._id);
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