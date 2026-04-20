import React, { useState, useEffect } from 'react';
import { Button, Card, message, Typography } from 'antd';
import { WifiOutlined } from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const { Title } = Typography;

const SocketTest: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  useEffect(() => {
    if (userInfo) {
      const newSocket = io('http://localhost:5002', {
        transports: ['websocket']
      });

      newSocket.on('connect', () => {
        console.log('Socket.IO连接成功');
        setConnected(true);
        newSocket.emit('joinUserRoom', userInfo.id);
        console.log(`加入用户房间 ${userInfo.id}`);
      });

      newSocket.on('popupNotification', (data) => {
        console.log('收到弹窗通知:', data);
        message.success(`收到弹窗通知: ${data.content}`);
      });

      newSocket.on('newMessage', (data) => {
        console.log('收到新消息:', data);
        message.info('收到新消息');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket.IO连接错误:', error);
        setConnected(false);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [userInfo]);

  const sendTestMessage = async () => {
    if (!userInfo) {
      message.error('请先登录');
      return;
    }

    try {
      const response = await api.post('/message', {
        content: '测试前端Socket.IO连接',
        type: 'popup',
        recipientId: userInfo.id
      });

      console.log('消息发送成功:', response.data);
      setMessageSent(true);
      message.success('消息发送成功');
    } catch (error) {
      console.error('消息发送失败:', error);
      message.error('消息发送失败');
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8, margin: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <WifiOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>Socket.IO测试</Title>
        </div>
      </div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <p>用户信息: {userInfo?.name} ({userInfo?.role})</p>
          <p>Socket.IO连接状态: {connected ? '已连接' : '未连接'}</p>
          <p>消息发送状态: {messageSent ? '已发送' : '未发送'}</p>
        </div>
        <Button type="primary" onClick={sendTestMessage} disabled={!connected}>
          发送测试消息
        </Button>
      </Card>
    </div>
  );
};

export default SocketTest;