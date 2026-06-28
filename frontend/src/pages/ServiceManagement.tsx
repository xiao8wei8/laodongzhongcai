import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, message, Alert, Descriptions, Typography, Space, Tag, Row, Col, Statistic, Avatar, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, EnvironmentOutlined, ApiOutlined } from '@ant-design/icons';
import api from '../services/api';
import { PageHero, PageMetricGrid, PageMetricItem, PageShell, PageSectionCard } from '../components/common/PageKit';

const { Title, Text } = Typography;

interface ServiceStatus {
  status: string;
  message: string;
  timestamp: string;
  dbEnv?: string;
  mongoUri?: string;
  mysqlHost?: string;
  mysqlPort?: string;
  mysqlDatabase?: string;
}

interface ServicesStatus {
  backend: ServiceStatus;
  // 兼容：早期版本使用 mongodb 字段；当前后端使用 mysql 字段
  mongodb?: ServiceStatus;
  mysql?: ServiceStatus;
  frontend: ServiceStatus;
  socket: ServiceStatus;
  environment: ServiceStatus;
}

interface BackupItem {
  fileName: string;
  fileSize: string;
  createdAt: string;
  path: string;
}

const ServiceManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServicesStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backups, setBackups] = useState<BackupItem[]>([]);

  // 获取服务状态
  const fetchServiceStatus = async () => {
    setLoading(true);
    try {
      const response = await api.get('/services/status');
      if (response.data?.success === false) {
        throw new Error(response.data?.message || '获取服务状态失败');
      }
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

  const fetchBackups = async () => {
    setBackupLoading(true);
    try {
      const response = await api.get('/backup/backup-list');
      setBackups(response.data?.backups || []);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取备份列表失败');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await api.post('/backup/backup-database');
      message.success(response.data?.message || '数据库备份成功');
      await fetchBackups();
    } catch (error: any) {
      message.error(error.response?.data?.message || '数据库备份失败');
    } finally {
      setBackupLoading(false);
    }
  };

  // 组件挂载时获取服务状态
  useEffect(() => {
    fetchServiceStatus();
    fetchBackups();
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

  const serviceStates = serviceStatus ? [
    serviceStatus.backend.status,
    serviceStatus.frontend.status,
    serviceStatus.socket.status,
    (serviceStatus.mongodb || serviceStatus.mysql)?.status
  ].filter(Boolean) as string[] : [];
  const healthyCount = serviceStates.filter((status) => status === 'running' || status === 'connected').length;
  const warningCount = serviceStates.filter((status) => ['stopped', 'disconnected', 'error'].includes(status)).length;

  return (
    <PageShell>
      <PageHero
        tone="slate"
        icon={<ApiOutlined />}
        title="服务管理台"
        description="在这里统一查看前端、后端、数据库、Socket 和环境状态。建议先定位异常项，再执行启动、停止或重启操作。"
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>运行状态可视化</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>环境信息单独展示</Tag>
            <Tag color="purple-inverse" style={{ borderRadius: 999 }}>数据库每日自动备份</Tag>
          </>
        }
        actions={
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetchServiceStatus} loading={loading} size="large" style={{ borderRadius: 10 }}>
            刷新状态
          </Button>
        }
        note={
          <Alert
            message="维护提示"
            description="进行重启前，请先确认当前是否存在活跃用户或关键业务操作。"
            type="info"
            showIcon
          />
        }
      />

      <PageMetricGrid>
        <PageMetricItem><Statistic title="监控对象" value={serviceStates.length} suffix="项" /></PageMetricItem>
        <PageMetricItem><Statistic title="健康状态" value={healthyCount} suffix="项" /></PageMetricItem>
        <PageMetricItem><Statistic title="异常状态" value={warningCount} suffix="项" /></PageMetricItem>
        <PageMetricItem><Statistic title="当前环境" value={serviceStatus?.environment.dbEnv === 'production' ? '生产' : '开发'} /></PageMetricItem>
      </PageMetricGrid>

      <PageSectionCard
        title="数据库备份"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchBackups} loading={backupLoading}>刷新列表</Button>
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleManualBackup} loading={backupLoading}>立即备份</Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic title="保留策略" value="3 天" />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic title="执行频率" value="每日 02:30" />
            </Card>
          </Col>
          <Col span={8}>
            <Card bordered={false}>
              <Statistic title="当前备份数" value={backups.length} suffix="份" />
            </Card>
          </Col>
        </Row>

        {backups.length > 0 ? (
          <Card bordered={false}>
            <Descriptions column={1} title="最近备份文件">
              {backups.slice(0, 5).map((item) => (
                <Descriptions.Item key={item.path} label={item.fileName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <Text>{new Date(item.createdAt).toLocaleString()}</Text>
                    <Tag color="blue">{item.fileSize}</Tag>
                  </div>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        ) : (
          <Empty description="暂无备份文件" />
        )}
      </PageSectionCard>

      {serviceStatus ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/*
            兼容：数据库状态
            - 如果有 mongodb 字段，按 MongoDB 展示
            - 否则如果有 mysql 字段，按 MySQL 展示
          */}
          {(() => {
            const dbService = serviceStatus.mongodb || serviceStatus.mysql;
            const dbLabel = serviceStatus.mongodb ? 'MongoDB' : 'MySQL';
            if (!dbService) return null;
            return (
              <Card
                title={
                  <Space>
                    <Text strong>{dbLabel}</Text>
                    {getStatusIcon(dbService.status)}
                  </Space>
                }
                bordered={false}
                style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', borderRadius: 18 }}
              >
                <Descriptions column={1}>
                  <Descriptions.Item label="状态">
                    <Text style={{ color: getStatusColor(dbService.status) }}>
                      {getStatusText(dbService.status)}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="消息">
                    <Text>{dbService.message}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    <Text>{new Date(dbService.timestamp).toLocaleString()}</Text>
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 16 }}>
                  <Alert
                    message={`${dbLabel} 服务管理`}
                    description={`${dbLabel} 服务需要通过系统服务管理工具或命令行进行管理`}
                    type="info"
                    showIcon
                  />
                </div>
              </Card>
            );
          })()}

          {/* 数据库环境状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>数据库环境</Text>
                <EnvironmentOutlined style={{ color: '#1890ff' }} />
              </Space>
            }
            bordered={false}
            style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', borderRadius: 18, borderLeft: '4px solid #1890ff' }}
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
                <Text style={{ wordBreak: 'break-all' }}>
                  {serviceStatus.environment.mongoUri || '—'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="MySQL地址">
                <Text style={{ wordBreak: 'break-all' }}>
                  {serviceStatus.environment.mysqlHost
                    ? `${serviceStatus.environment.mysqlHost}:${serviceStatus.environment.mysqlPort || ''}`
                    : '—'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="MySQL库名">
                <Text>{serviceStatus.environment.mysqlDatabase || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                <Text>{new Date(serviceStatus.environment.timestamp).toLocaleString()}</Text>
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Alert
                message="环境说明"
                description="当前服务以数据库连接配置为准（可能为 MySQL 或 MongoDB）。"
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
            bordered={false}
            style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', borderRadius: 18 }}
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

          {/* 数据库状态卡片（已在上方统一渲染） */}

          {/* 前端服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>前端服务</Text>
                {getStatusIcon(serviceStatus.frontend.status)}
              </Space>
            }
            bordered={false}
            style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', borderRadius: 18 }}
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
          {/* Socket.IO 服务状态卡片 */}
          <Card
            title={
              <Space>
                <Text strong>Socket.IO 服务</Text>
                {getStatusIcon(serviceStatus.socket.status)}
              </Space>
            }
            bordered={false}
            style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)', borderRadius: 18 }}
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
        <PageSectionCard>
          <Empty description="获取服务状态失败，请检查网络连接或后端服务是否运行">
            <Button type="primary" onClick={fetchServiceStatus}>重试</Button>
          </Empty>
        </PageSectionCard>
      )}
    </PageShell>
  );
};

export default ServiceManagement;
