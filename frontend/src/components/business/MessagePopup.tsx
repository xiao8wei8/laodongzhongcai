import React, { useState, useEffect } from 'react';
import { Popover, Button, Avatar, Badge, message } from 'antd';
import { BellOutlined, MessageOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

interface PopupNotification {
  content: string;
  messageId: string;
}

const MessagePopup: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<PopupNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 初始化Socket连接
  useEffect(() => {
    if (userInfo) {
      const newSocket = io('http://localhost:5002', {
        transports: ['websocket']
      });

      // 连接成功后加入用户房间
      newSocket.on('connect', () => {
        newSocket.emit('joinUserRoom', userInfo.id);
      });

      // 监听弹窗通知
      newSocket.on('popupNotification', (data: PopupNotification) => {
        setNotification(data);
        setVisible(true);
        fetchUnreadCount();
      });

      // 监听新消息
      newSocket.on('newMessage', () => {
        fetchUnreadCount();
      });

      setSocket(newSocket);

      // 组件卸载时断开连接
      return () => {
        newSocket.disconnect();
      };
    }
  }, [userInfo]);

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
      setVisible(false);
      fetchUnreadCount();
      message.success('消息已标记为已读');
    } catch (error) {
      message.error('标记消息为已读失败');
    }
  };

  // 关闭弹窗
  const handleClose = () => {
    setVisible(false);
  };

  return (
    <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
      {notification && visible && (
        <Popover
          content={
            <div style={{ width: 300, padding: 16 }}>
              <div style={{ marginBottom: 16, lineHeight: 1.5 }}>
                {notification.content}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button size="small" onClick={handleClose}>
                  关闭
                </Button>
                <Button 
                  size="small" 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  onClick={() => markAsRead(notification.messageId)}
                >
                  标记已读
                </Button>
              </div>
            </div>
          }
          title="新消息"
          open={visible}
          onOpenChange={setVisible}
          trigger="click"
          placement="bottomRight"
        >
          <Badge count={unreadCount} showZero>
            <Avatar icon={<BellOutlined />} style={{ backgroundColor: '#1890ff' }} />
          </Badge>
        </Popover>
      )}
      {(!notification || !visible) && (
        <Badge count={unreadCount} showZero>
          <Avatar icon={<BellOutlined />} style={{ backgroundColor: '#1890ff' }} />
        </Badge>
      )}
    </div>
  );
};

export default MessagePopup;