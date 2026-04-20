import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, message, Alert, Descriptions, Typography, Space, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, DatabaseOutlined, EnvironmentOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Title, Text } = Typography;

interface ServiceStatus {
  status: string;
  message: string;
  timestamp: string;
  dbEnv?: string;
  mongoUri?: string;
}

interface ServicesStatus {
  backend: ServiceStatus;
  mongodb: ServiceStatus;
  frontend: ServiceStatus;
  sms: ServiceStatus;
  email: ServiceStatus;
  socket: ServiceStatus;
  environment: ServiceStatus;
}

const ServiceManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServicesStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 获取服务状态
  const fetchServiceStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('/services/status');
      setServiceStatus(response.data.services);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取服务状态失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 服务操作（启动、停止、重启）
  const handleServiceAction = async (action: string, serviceName: string) => {
    setActionLoading(true);
    try {
      let endpoint = '';

      switch (action) {
        case 'start':
          endpoint = '/services/start';
          break;
        case 'stop':
          endpoint = '/services/stop';
          break;
        case 'restart':
          endpoint = '/services/restart';
          break;
        default:
          return;
      }

      const response = await api.post(endpoint, { serviceName });
      message.success(response.data.message);
      
      // 重新获取服务状态
      fetchServiceStatus();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '操作失败';
      message.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  // 组件挂载时获取服务状态
  useEffect(() => {
    fetchServiceStatus();
  }, []);

  // 定时获取服务状态，实现实时监控
  useEffect(() => {
    const interval = setInterval(fetchServiceStatus, 30000); // 每30秒获取一次服务状态
    return () => clearInterval(interval);
  }, []);

  // 获取服务状态图标
  const getStatusIcon = (status: string) => {
    if (status === 'running' || status === 'connected') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    } else if (status === 'disconnected' || status === 'stopped') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    } else {
      return <LoadingOutlined style={{ color: '#faad14' }} />;
    }
  };

  // 获取服务状态文本
  const getStatusText = (status: string) => {
    if (status === 'running') {
      return '运行中';
    } else if (status === 'connected') {
      return '已连接';
    } else if (status === 'disconnected') {
      return '未连接';
    } else if (status === 'stopped') {
      return '已停止';
    } else if (status === 'configured') {
      return '已配置';
    } else if (status === 'incomplete') {
      return '配置不完整';
    } else if (status === 'error') {
      return '错误';
    } else {
      return '未知';
    }
  };

  // 获取服务状态颜色
  const getStatusColor = (status: string) => {
    if (status === 'running' || status === 'connected' || status === 'configured') {
      return 'green';
    } else if (status === 'disconnected' || status === 'stopped' || status === 'error') {
      return 'red';
    } else if (status === 'incomplete') {
      return 'orange';
    } else {
      return 'orange';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="获取服务状态中..." />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ 
        marginBottom: 24, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <CheckCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>服务管理</Title>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={fetchServiceStatus}
          loading={loading}
        >
          刷新状态
        </Button>
      </div>

      {serviceStatus ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {/* 数据库环境状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>数据库环境</Text>
                <EnvironmentOutlined style={{ color: '#1890ff' }} />
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', borderLeft: '4px solid #1890ff' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.environment.status) }}>
                  {getStatusText(serviceStatus.environment.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="当前环境">
                <Tag color={serviceStatus.environment.dbEnv === 'production' ? 'red' : 'green'}>
                  {serviceStatus.environment.dbEnv === 'production' ? '生产环境' : '开发环境'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="MongoDB地址">
                <Text style={{ wordBreak: 'break-all' }}>{serviceStatus.environment.mongoUri}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.environment.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="环境说明"
                description="开发环境使用本地 MongoDB，生产环境使用远程 MongoDB 服务器"
                type="info"
                showIcon
              />
            </div>
          </Card>

          {/* 后端服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>后端服务</Text>
                {getStatusIcon(serviceStatus.backend.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.backend.status) }}>
                  {getStatusText(serviceStatus.backend.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.backend.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.backend.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleServiceAction('start', 'backend')}
                loading={actionLoading}
                disabled={serviceStatus.backend.status === 'running'}
              >
                启动
              </Button>
              <Button
                danger
                icon={<PauseCircleOutlined />}
                onClick={() => handleServiceAction('stop', 'backend')}
                loading={actionLoading}
                disabled={serviceStatus.backend.status !== 'running'}
              >
                停止
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleServiceAction('restart', 'backend')}
                loading={actionLoading}
              >
                重启
              </Button>
            </div>
          </Card>

          {/* MongoDB 状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>MongoDB</Text>
                {getStatusIcon(serviceStatus.mongodb.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.mongodb.status) }}>
                  {getStatusText(serviceStatus.mongodb.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.mongodb.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.mongodb.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="MongoDB 服务管理"
                description="MongoDB 服务需要通过系统服务管理工具或命令行进行管理"
                type="info"
                showIcon
              />
            </div>
          </Card>

          {/* 前端服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>前端服务</Text>
                {getStatusIcon(serviceStatus.frontend.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.frontend.status) }}>
                  {getStatusText(serviceStatus.frontend.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.frontend.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.frontend.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleServiceAction('start', 'frontend')}
                loading={actionLoading}
                disabled={serviceStatus.frontend.status === 'running'}
              >
                启动
              </Button>
              <Button
                danger
                icon={<PauseCircleOutlined />}
                onClick={() => handleServiceAction('stop', 'frontend')}
                loading={actionLoading}
                disabled={serviceStatus.frontend.status !== 'running'}
              >
                停止
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleServiceAction('restart', 'frontend')}
                loading={actionLoading}
              >
                重启
              </Button>
            </div>
          </Card>



          {/* 短信服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>短信服务</Text>
                {getStatusIcon(serviceStatus.sms.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.sms.status) }}>
                  {getStatusText(serviceStatus.sms.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.sms.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.sms.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="短信服务管理"
                description="短信服务状态基于配置文件检查，需要更新配置文件以修改服务状态"
                type="info"
                showIcon
              />
            </div>
          </Card>

          {/* 邮件服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>邮件服务</Text>
                {getStatusIcon(serviceStatus.email.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.email.status) }}>
                  {getStatusText(serviceStatus.email.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.email.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.email.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="邮件服务管理"
                description="邮件服务状态基于配置文件检查，需要更新配置文件以修改服务状态"
                type="info"
                showIcon
              />
            </div>
          </Card>

          {/* Socket.IO 服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>Socket.IO 服务</Text>
                {getStatusIcon(serviceStatus.socket.status)}
              </Space>
            }
            bordered={true}
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}
          >
            <Descriptions column={1}>
              <Descriptions.Item label="状态">
                <Text style={{ color: getStatusColor(serviceStatus.socket.status) }}>
                  {getStatusText(serviceStatus.socket.status)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="消息">
                <Text>{serviceStatus.socket.message}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.socket.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="Socket.IO 服务管理"
                description="Socket.IO 服务作为后端服务的一部分运行，重启后端服务即可重启 Socket.IO 服务"
                type="info"
                showIcon
              />
            </div>
          </Card>
        </div>
      ) : (
        <Alert
          message="获取服务状态失败"
          description="请检查网络连接或后端服务是否运行"
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={fetchServiceStatus}>
              重试
            </Button>
          }
          style={{ marginBottom: 24 }}
        />
      )}
    </div>
  );
};

export default ServiceManagement;