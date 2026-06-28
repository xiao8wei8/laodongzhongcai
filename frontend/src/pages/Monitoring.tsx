import React, { useMemo, useState, useEffect } from 'react';
import { Card, Button, Spin, message, Typography, Tabs, Table, Input, Select, Statistic, Row, Col, Tag, Space, Alert } from 'antd';
import { ReloadOutlined, BarChartOutlined, FileTextOutlined, AlertOutlined, ApiOutlined, RadarChartOutlined } from '@ant-design/icons';
import api, { apiLogger } from '../services/api';
import * as echarts from 'echarts';
import { ExportButton, PageHero, PageMetricGrid, PageMetricItem, PageShell, PageToolbar, PageSectionCard } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, warnNoExportData } from '../utils/excel';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface LogEntry {
  _id: string;
  level: string;
  message: string;
  timestamp: string;
  service: string;
  context?: any;
}

interface MonitoringData {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
  timestamp: string;
}

interface AccessUser {
  key: string;
  userId?: string | null;
  username: string;
  role: string;
  tenantId?: string | null;
  clientType: string;
  loginAt?: string | null;
  lastActiveAt: string;
  visitCount: number;
  pageViewCount: number;
  ip: string;
}

interface AccessLog {
  event: string;
  username?: string;
  role?: string;
  page?: string;
  ip?: string;
  createdAt: string;
  clientType?: string;
}

interface OperationLog {
  id: string;
  username?: string;
  role?: string;
  module: string;
  action: string;
  targetDisplay?: string;
  result: 'success' | 'failed';
  errorMessage?: string;
  detail?: string;
  createdAt: string;
}

const Monitoring: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [monitoringData, setMonitoringData] = useState<MonitoringData[]>([]);
  const [logFilter, setLogFilter] = useState({
    level: '',
    service: '',
    keyword: '',
    timeRange: null as any
  });

  // API请求监控相关状态
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [apiFilter, setApiFilter] = useState({
    page: '',
    method: '',
    status: ''
  });
  const [apiStats, setApiStats] = useState({
    total: 0,
    success: 0,
    error: 0,
    averageDuration: 0
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [accessSummary, setAccessSummary] = useState({ totalUsers: 0, loginCount: 0, pageViewCount: 0, heartbeatCount: 0, pcAdminUsers: 0, miniProgramUsers: 0 });
  const [accessKeyword, setAccessKeyword] = useState('');
  const [accessClientType, setAccessClientType] = useState('');
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [operationSummary, setOperationSummary] = useState({ total: 0, successCount: 0, failedCount: 0 });
  const [operationKeyword, setOperationKeyword] = useState('');

  // 获取日志数据
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/services/logs', {
        params: logFilter
      });
      setLogs(response.data.logs);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取日志失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 获取监控数据
  const fetchMonitoringData = async () => {
    try {
      const response = await api.get('/services/monitoring');
      setMonitoringData(response.data.data);
      // 渲染图表
      renderCharts(response.data.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || '获取监控数据失败';
      message.error(errorMessage);
    }
  };

  // 渲染图表
  const renderCharts = (data: MonitoringData[]) => {
    // CPU 使用率图表
    const cpuChart = echarts.init(document.getElementById('cpu-chart'));
    const cpuOption = {
      title: {
        text: 'CPU 使用率'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: data.map(item => new Date(item.timestamp).toLocaleTimeString())
      },
      yAxis: {
        type: 'value',
        max: 100
      },
      series: [{
        data: data.map(item => item.cpu),
        type: 'line',
        smooth: true,
        areaStyle: {}
      }]
    };
    cpuChart.setOption(cpuOption);

    // 内存使用率图表
    const memoryChart = echarts.init(document.getElementById('memory-chart'));
    const memoryOption = {
      title: {
        text: '内存使用率'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: data.map(item => new Date(item.timestamp).toLocaleTimeString())
      },
      yAxis: {
        type: 'value',
        max: 100
      },
      series: [{
        data: data.map(item => item.memory),
        type: 'line',
        smooth: true,
        areaStyle: {}
      }]
    };
    memoryChart.setOption(memoryOption);

    // 网络流量图表
    const networkChart = echarts.init(document.getElementById('network-chart'));
    const networkOption = {
      title: {
        text: '网络流量'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: data.map(item => new Date(item.timestamp).toLocaleTimeString())
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '入站',
          data: data.map(item => item.network.in),
          type: 'line',
          smooth: true
        },
        {
          name: '出站',
          data: data.map(item => item.network.out),
          type: 'line',
          smooth: true
        }
      ]
    };
    networkChart.setOption(networkOption);
  };

  // 组件挂载时获取数据
  useEffect(() => {
    fetchLogs();
    fetchMonitoringData();
    
    // 定时获取监控数据
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 处理日志筛选
  const handleLogFilter = () => {
    fetchLogs();
  };

  // 获取API日志数据
  const fetchApiLogs = () => {
    const logs = apiLogger.getLogs();
    setApiLogs(logs);
    updateApiStats(logs);
  };

  // 更新API统计信息
  const updateApiStats = (logs: any[]) => {
    if (logs.length === 0) {
      setApiStats({
        total: 0,
        success: 0,
        error: 0,
        averageDuration: 0
      });
      return;
    }

    const total = logs.length;
    const success = logs.filter(log => log.status >= 200 && log.status < 300).length;
    const error = total - success;
    const totalDuration = logs.reduce((sum, log) => sum + log.duration, 0);
    const averageDuration = totalDuration / total;

    setApiStats({
      total,
      success,
      error,
      averageDuration: parseFloat(averageDuration.toFixed(2))
    });
  };

  // 处理API日志筛选
  const handleApiFilter = () => {
    let filteredLogs = apiLogger.getLogs();
    
    if (apiFilter.page) {
      filteredLogs = filteredLogs.filter(log => log.page === apiFilter.page);
    }
    
    if (apiFilter.method) {
      filteredLogs = filteredLogs.filter(log => log.method === apiFilter.method);
    }
    
    if (apiFilter.status) {
      const status = parseInt(apiFilter.status);
      filteredLogs = filteredLogs.filter(log => log.status === status);
    }
    
    setApiLogs(filteredLogs);
    updateApiStats(filteredLogs);
  };

  // 清除API日志
  const clearApiLogs = () => {
    apiLogger.clearLogs();
    setApiLogs([]);
    updateApiStats([]);
  };

  const fetchAccessUsers = async () => {
    try {
      const response = await api.get('/analytics/access-users', {
        params: { keyword: accessKeyword, clientType: accessClientType }
      });
      const payload = response.data?.data || {};
      setAccessSummary(payload.summary || { totalUsers: 0, loginCount: 0, pageViewCount: 0, heartbeatCount: 0, pcAdminUsers: 0, miniProgramUsers: 0 });
      setAccessUsers(payload.users || []);
      setAccessLogs(payload.logs || []);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取访问用户失败');
    }
  };

  const fetchOperationLogs = async () => {
    try {
      const response = await api.get('/analytics/operation-logs', {
        params: { keyword: operationKeyword }
      });
      const payload = response.data?.data || {};
      setOperationSummary(payload.summary || { total: 0, successCount: 0, failedCount: 0 });
      setOperationLogs(payload.logs || []);
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取操作日志失败');
    }
  };

  useEffect(() => {
    if (activeTab === 'access-users') {
      fetchAccessUsers();
    }
    if (activeTab === 'operation-logs') {
      fetchOperationLogs();
    }
  }, [activeTab]);

  // 日志表格列配置
  const logColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (text: string) => {
        const color = {
          error: '#ff4d4f',
          warn: '#faad14',
          info: '#1890ff',
          debug: '#52c41a'
        }[text] || '#666';
        return <Text style={{ color }}>{text.toUpperCase()}</Text>;
      }
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service'
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    }
  ];

  // API请求日志表格列配置
  const apiLogColumns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '页面',
      dataIndex: 'page',
      key: 'page',
      render: (text: string) => text || '/' 
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      render: (text: string) => {
        const color = {
          GET: '#52c41a',
          POST: '#1890ff',
          PUT: '#faad14',
          DELETE: '#ff4d4f'
        }[text] || '#666';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => {
        const color = status >= 200 && status < 300 ? '#52c41a' : '#ff4d4f';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: '响应时间',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${duration}ms`
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error: string) => error || '-'
    }
  ];

  const alertRecords = useMemo(() => ([
    {
      key: '1',
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'backend',
      message: 'CPU 使用率超过 80%',
      status: 'pending'
    },
    {
      key: '2',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      level: 'info',
      service: 'socket',
      message: 'Socket.IO 连接数异常增长',
      status: 'resolved'
    },
    {
      key: '3',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      level: 'error',
      service: 'mongodb',
      message: 'MongoDB 连接失败',
      status: 'resolved'
    }
  ]), []);

  const handleExport = () => {
    if (activeTab === 'dashboard') {
      if (monitoringData.length === 0) {
        warnNoExportData('当前没有可导出的监控数据');
        return;
      }
      exportExcel(buildExportFileName('系统监控面板'), [
        { header: '时间', key: 'timestamp', formatter: (row: MonitoringData) => new Date(row.timestamp).toLocaleString() },
        { header: 'CPU', key: 'cpu' },
        { header: '内存', key: 'memory' },
        { header: '磁盘', key: 'disk' },
        { header: '入站网络', key: 'networkIn', formatter: (row: MonitoringData) => row.network.in },
        { header: '出站网络', key: 'networkOut', formatter: (row: MonitoringData) => row.network.out }
      ], monitoringData);
      message.success(`已导出 ${monitoringData.length} 条监控记录`);
      return;
    }

    if (activeTab === 'logs') {
      if (logs.length === 0) {
        warnNoExportData('当前没有可导出的日志');
        return;
      }
      exportExcel(buildExportFileName('系统日志'), [
        { header: '时间', key: 'timestamp', formatter: (row: LogEntry) => new Date(row.timestamp).toLocaleString() },
        { header: '级别', key: 'level' },
        { header: '服务', key: 'service' },
        { header: '消息', key: 'message' }
      ], logs);
      message.success(`已导出 ${logs.length} 条日志`);
      return;
    }

    if (activeTab === 'alerts') {
      exportExcel(buildExportFileName('系统告警'), [
        { header: '时间', key: 'timestamp', formatter: (row: any) => new Date(row.timestamp).toLocaleString() },
        { header: '级别', key: 'level' },
        { header: '服务', key: 'service' },
        { header: '消息', key: 'message' },
        { header: '状态', key: 'status', formatter: (row: any) => row.status === 'resolved' ? '已解决' : '待处理' }
      ], alertRecords);
      message.success(`已导出 ${alertRecords.length} 条告警记录`);
      return;
    }

    if (activeTab === 'access-users') {
      if (accessUsers.length === 0) {
        warnNoExportData('当前没有可导出的访问用户数据');
        return;
      }
      exportExcel(buildExportFileName('访问用户'), [
        { header: '用户名', key: 'username' },
        { header: '角色', key: 'role' },
        { header: '来源端', key: 'clientType' },
        { header: '登录时间', key: 'loginAt', formatter: (row: AccessUser) => row.loginAt ? new Date(row.loginAt).toLocaleString() : '-' },
        { header: '最后活跃', key: 'lastActiveAt', formatter: (row: AccessUser) => new Date(row.lastActiveAt).toLocaleString() },
        { header: '访问次数', key: 'visitCount' },
        { header: '页面浏览', key: 'pageViewCount' },
        { header: 'IP', key: 'ip' }
      ], accessUsers);
      message.success(`已导出 ${accessUsers.length} 条访问用户记录`);
      return;
    }

    if (activeTab === 'operation-logs') {
      if (operationLogs.length === 0) {
        warnNoExportData('当前没有可导出的操作日志');
        return;
      }
      exportExcel(buildExportFileName('操作日志'), [
        { header: '时间', key: 'createdAt', formatter: (row: OperationLog) => new Date(row.createdAt).toLocaleString() },
        { header: '用户', key: 'username' },
        { header: '角色', key: 'role' },
        { header: '模块', key: 'module' },
        { header: '动作', key: 'action' },
        { header: '对象', key: 'targetDisplay' },
        { header: '结果', key: 'result' },
        { header: '详情', key: 'detail' },
        { header: '错误信息', key: 'errorMessage' }
      ], operationLogs);
      message.success(`已导出 ${operationLogs.length} 条操作日志`);
      return;
    }

    if (apiLogs.length === 0) {
      warnNoExportData('当前没有可导出的 API 日志');
      return;
    }
    exportExcel(buildExportFileName('API请求日志'), [
      { header: '时间', key: 'timestamp', formatter: (row: any) => new Date(row.timestamp).toLocaleString() },
      { header: '页面', key: 'page', formatter: (row: any) => row.page || '/' },
      { header: '方法', key: 'method' },
      { header: 'URL', key: 'url' },
      { header: '状态码', key: 'status' },
      { header: '响应时间(ms)', key: 'duration' },
      { header: '错误信息', key: 'error', formatter: (row: any) => row.error || '' }
    ], apiLogs);
    message.success(`已导出 ${apiLogs.length} 条 API 日志`);
  };

  return (
    <PageShell>
      <PageHero
        tone="slate"
        icon={<RadarChartOutlined />}
        title="系统监控台"
        description="用于查看资源使用、系统日志、告警记录和 API 请求情况。建议先看监控面板，再进入日志和告警定位问题。"
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>资源监控</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>日志与告警</Tag>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>API链路观测</Tag>
          </>
        }
        actions={
          <Space wrap>
            <ExportButton onClick={handleExport} />
            <Button type="primary" icon={<ReloadOutlined />} onClick={fetchMonitoringData} size="large" style={{ borderRadius: 10 }}>
              刷新数据
            </Button>
          </Space>
        }
        note={
          <Alert
            message="巡检建议"
            description="先确认 CPU、内存和网络趋势，再根据日志和告警记录定位异常。"
            type="info"
            showIcon
          />
        }
      />

      <Tabs defaultActiveKey="dashboard" activeKey={activeTab} onChange={setActiveTab}>
        {/* 监控面板 */}
        <TabPane tab={<><BarChartOutlined /> 监控面板</>} key="dashboard">
          <PageMetricGrid>
            <PageMetricItem><Statistic title="CPU 使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].cpu : 0} suffix="%" /></PageMetricItem>
            <PageMetricItem><Statistic title="内存使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].memory : 0} suffix="%" /></PageMetricItem>
            <PageMetricItem><Statistic title="磁盘使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].disk : 0} suffix="%" /></PageMetricItem>
            <PageMetricItem><Statistic title="网络入站" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].network.in : 0} suffix="KB/s" /></PageMetricItem>
          </PageMetricGrid>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="CPU 使用率" bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
                <div id="cpu-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="内存使用率" bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
                <div id="memory-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Card title="网络流量" bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
                <div id="network-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* 日志管理 */}
        <TabPane tab={<><FileTextOutlined /> 日志管理</>} key="logs">
          <PageToolbar>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>日志级别:</Text>
                <Select 
                  style={{ width: 120 }} 
                  value={logFilter.level} 
                  onChange={(value) => setLogFilter({ ...logFilter, level: value })}
                >
                  <Option value="">全部</Option>
                  <Option value="error">错误</Option>
                  <Option value="warn">警告</Option>
                  <Option value="info">信息</Option>
                  <Option value="debug">调试</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>服务:</Text>
                <Select 
                  style={{ width: 120 }} 
                  value={logFilter.service} 
                  onChange={(value) => setLogFilter({ ...logFilter, service: value })}
                >
                  <Option value="">全部</Option>
                  <Option value="backend">后端</Option>
                  <Option value="frontend">前端</Option>
                  <Option value="socket">Socket.IO</Option>
                  <Option value="mongodb">MongoDB</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <Text>关键词:</Text>
                <Input 
                  style={{ flex: 1, maxWidth: 300 }} 
                  placeholder="输入关键词"
                  value={logFilter.keyword}
                  onChange={(e) => setLogFilter({ ...logFilter, keyword: e.target.value })}
                />
              </div>
              <Button type="primary" onClick={handleLogFilter}>
                筛选
              </Button>
            </div>
          </PageToolbar>

          <PageSectionCard>
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="_id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </PageSectionCard>
        </TabPane>

        {/* 系统告警 */}
        <TabPane tab={<><AlertOutlined /> 系统告警</>} key="alerts">
          <Card bordered={false} style={{ marginBottom: 24, borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>告警规则</Text>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <Card bordered>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text>CPU 使用率</Text>
                  <Text style={{ color: '#faad14' }}>80%</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>当 CPU 使用率超过 80% 时触发告警</Text>
              </Card>
              <Card bordered>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text>内存使用率</Text>
                  <Text style={{ color: '#faad14' }}>90%</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>当内存使用率超过 90% 时触发告警</Text>
              </Card>
              <Card bordered>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text>磁盘使用率</Text>
                  <Text style={{ color: '#faad14' }}>95%</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>当磁盘使用率超过 95% 时触发告警</Text>
              </Card>
            </div>
          </Card>
          <Card bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>告警记录</Text>
            </div>
            <Table
              columns={[
                {
                  title: '时间',
                  dataIndex: 'timestamp',
                  key: 'timestamp',
                  render: (text: string) => new Date(text).toLocaleString()
                },
                {
                  title: '级别',
                  dataIndex: 'level',
                  key: 'level',
                  render: (text: string) => {
                    const color = {
                      error: '#ff4d4f',
                      warn: '#faad14',
                      info: '#1890ff'
                    }[text] || '#666';
                    return <Text style={{ color }}>{text.toUpperCase()}</Text>;
                  }
                },
                {
                  title: '服务',
                  dataIndex: 'service',
                  key: 'service'
                },
                {
                  title: '消息',
                  dataIndex: 'message',
                  key: 'message',
                  ellipsis: true
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (text: string) => {
                    const color = {
                      resolved: '#52c41a',
                      pending: '#faad14'
                    }[text] || '#666';
                    return <Text style={{ color }}>{text === 'resolved' ? '已解决' : '待处理'}</Text>;
                  }
                }
              ]}
              dataSource={alertRecords}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* API请求监控 */}
        <TabPane tab={<><ApiOutlined /> API请求监控</>} key="api-monitoring">
          <Card bordered={false} style={{ marginBottom: 24, borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text strong>API请求统计</Text>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button type="primary" onClick={fetchApiLogs} icon={<ReloadOutlined />}>
                  刷新数据
                </Button>
                <Button danger onClick={clearApiLogs}>
                  清除日志
                </Button>
              </div>
            </div>
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic title="总请求数" value={apiStats.total} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="成功请求" value={apiStats.success} prefix={<Tag color="green">✓</Tag>} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="失败请求" value={apiStats.error} prefix={<Tag color="red">✗</Tag>} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="平均响应时间" value={apiStats.averageDuration} suffix="ms" />
                </Card>
              </Col>
            </Row>
          </Card>

          <Card style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>页面:</Text>
                <Select 
                  style={{ width: 150 }} 
                  value={apiFilter.page} 
                  onChange={(value) => setApiFilter({ ...apiFilter, page: value })}
                >
                  <Option value="">全部</Option>
                  {Array.from(new Set(apiLogger.getLogs().map((log: any) => log.page))).map((page: string) => (
                    <Option key={page} value={page}>{page || '/'}</Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>方法:</Text>
                <Select 
                  style={{ width: 100 }} 
                  value={apiFilter.method} 
                  onChange={(value) => setApiFilter({ ...apiFilter, method: value })}
                >
                  <Option value="">全部</Option>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                </Select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>状态:</Text>
                <Select 
                  style={{ width: 100 }} 
                  value={apiFilter.status} 
                  onChange={(value) => setApiFilter({ ...apiFilter, status: value })}
                >
                  <Option value="">全部</Option>
                  <Option value="200">200</Option>
                  <Option value="400">400</Option>
                  <Option value="401">401</Option>
                  <Option value="500">500</Option>
                </Select>
              </div>
              <Button type="primary" onClick={handleApiFilter}>
                筛选
              </Button>
            </div>
          </Card>

          <Card>
            <div style={{ marginBottom: 16 }}>
              <Text strong>API请求日志</Text>
            </div>
            <Table
              columns={apiLogColumns}
              dataSource={apiLogs}
              rowKey="id"
              pagination={{ pageSize: 15 }}
              onRow={(record) => ({
                onClick: () => {
                  // 可以添加点击查看详情的功能
                  console.log('API请求详情:', record);
                }
              })}
            />
          </Card>
        </TabPane>

        <TabPane tab={<><FileTextOutlined /> 访问用户</>} key="access-users">
          <PageMetricGrid>
            <PageMetricItem><Statistic title="今日活跃用户" value={accessSummary.totalUsers} suffix="人" /></PageMetricItem>
            <PageMetricItem><Statistic title="PC端活跃" value={accessSummary.pcAdminUsers} suffix="人" /></PageMetricItem>
            <PageMetricItem><Statistic title="小程序活跃" value={accessSummary.miniProgramUsers} suffix="人" /></PageMetricItem>
            <PageMetricItem><Statistic title="登录次数" value={accessSummary.loginCount} suffix="次" /></PageMetricItem>
            <PageMetricItem><Statistic title="页面浏览" value={accessSummary.pageViewCount} suffix="次" /></PageMetricItem>
            <PageMetricItem><Statistic title="心跳次数" value={accessSummary.heartbeatCount} suffix="次" /></PageMetricItem>
          </PageMetricGrid>

          <PageToolbar>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Input
                style={{ width: 320 }}
                placeholder="搜索用户名、角色、页面或IP"
                value={accessKeyword}
                onChange={(e) => setAccessKeyword(e.target.value)}
              />
              <Select
                style={{ width: 160 }}
                value={accessClientType}
                onChange={setAccessClientType}
              >
                <Option value="">全部来源</Option>
                <Option value="pc_admin">PC端</Option>
                <Option value="mini_program">小程序端</Option>
              </Select>
              <Button type="primary" onClick={fetchAccessUsers}>查询</Button>
            </div>
          </PageToolbar>

          <Row gutter={16}>
            <Col span={14}>
              <PageSectionCard title="今日访问用户">
                <Table
                  rowKey="key"
                  columns={[
                    { title: '用户', dataIndex: 'username', key: 'username' },
                    { title: '角色', dataIndex: 'role', key: 'role', render: (text: string) => <Tag>{text || '-'}</Tag> },
                    {
                      title: '来源端',
                      dataIndex: 'clientType',
                      key: 'clientType',
                      render: (text: string) => (
                        <Tag color={text === 'mini_program' ? 'purple' : 'blue'}>
                          {text === 'mini_program' ? '小程序端' : text === 'pc_admin' ? 'PC端' : text || '-'}
                        </Tag>
                      )
                    },
                    { title: '登录时间', dataIndex: 'loginAt', key: 'loginAt', render: (text?: string) => text ? new Date(text).toLocaleString() : '-' },
                    { title: '最后活跃', dataIndex: 'lastActiveAt', key: 'lastActiveAt', render: (text: string) => new Date(text).toLocaleString() },
                    { title: '访问', dataIndex: 'visitCount', key: 'visitCount' }
                  ]}
                  dataSource={accessUsers}
                  pagination={{ pageSize: 10 }}
                />
              </PageSectionCard>
            </Col>
            <Col span={10}>
              <PageSectionCard title="今日访问明细">
                <Table
                  rowKey={(record: AccessLog, index) => `${record.createdAt}-${index}`}
                  columns={[
                    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (text: string) => new Date(text).toLocaleString() },
                    { title: '用户', dataIndex: 'username', key: 'username', render: (text: string) => text || '匿名用户' },
                    { title: '事件', dataIndex: 'event', key: 'event', render: (text: string) => <Tag color="blue">{text}</Tag> },
                    {
                      title: '来源',
                      dataIndex: 'clientType',
                      key: 'clientType',
                      render: (text?: string) => (
                        <Tag color={text === 'mini_program' ? 'purple' : 'blue'}>
                          {text === 'mini_program' ? '小程序端' : text === 'pc_admin' ? 'PC端' : text || '-'}
                        </Tag>
                      )
                    },
                    { title: '页面/IP', key: 'meta', render: (_: any, record: AccessLog) => <span>{record.page || '-'} / {record.ip || '-'}</span> }
                  ]}
                  dataSource={accessLogs}
                  pagination={{ pageSize: 8 }}
                />
              </PageSectionCard>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab={<><AlertOutlined /> 操作日志</>} key="operation-logs">
          <PageMetricGrid>
            <PageMetricItem><Statistic title="今日日志总数" value={operationSummary.total} suffix="条" /></PageMetricItem>
            <PageMetricItem><Statistic title="成功操作" value={operationSummary.successCount} suffix="条" /></PageMetricItem>
            <PageMetricItem><Statistic title="失败操作" value={operationSummary.failedCount} suffix="条" /></PageMetricItem>
          </PageMetricGrid>

          <PageToolbar>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Input
                style={{ width: 320 }}
                placeholder="搜索用户、模块、对象"
                value={operationKeyword}
                onChange={(e) => setOperationKeyword(e.target.value)}
              />
              <Button type="primary" onClick={fetchOperationLogs}>查询</Button>
            </div>
          </PageToolbar>

          <PageSectionCard title="操作日志列表">
            <Table
              rowKey="id"
              columns={[
                { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (text: string) => new Date(text).toLocaleString() },
                { title: '用户', dataIndex: 'username', key: 'username', render: (text: string) => text || '-' },
                { title: '模块', dataIndex: 'module', key: 'module', render: (text: string) => <Tag>{text}</Tag> },
                { title: '动作', dataIndex: 'action', key: 'action' },
                { title: '对象', dataIndex: 'targetDisplay', key: 'targetDisplay', render: (text?: string) => text || '-' },
                { title: '结果', dataIndex: 'result', key: 'result', render: (text: string) => <Tag color={text === 'success' ? 'green' : 'red'}>{text}</Tag> },
                { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
                { title: '错误', dataIndex: 'errorMessage', key: 'errorMessage', ellipsis: true, render: (text?: string) => text || '-' }
              ]}
              dataSource={operationLogs}
              pagination={{ pageSize: 12 }}
            />
          </PageSectionCard>
        </TabPane>
      </Tabs>
    </PageShell>
  );
};

export default Monitoring;
