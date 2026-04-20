import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, message, Typography, Tabs, Table, Input, Select, DatePicker, Statistic, Row, Col, Tag } from 'antd';
import { ReloadOutlined, BarChartOutlined, FileTextOutlined, AlertOutlined, ApiOutlined } from '@ant-design/icons';
import api, { apiLogger } from '../services/api';
import * as echarts from 'echarts';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

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

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <AlertOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>系统监控</Title>
        </div>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={fetchMonitoringData}
        >
          刷新数据
        </Button>
      </div>

      <Tabs defaultActiveKey="dashboard">
        {/* 监控面板 */}
        <TabPane tab={<><BarChartOutlined /> 监控面板</>} key="dashboard">
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="CPU 使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].cpu : 0} suffix="%" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="内存使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].memory : 0} suffix="%" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="磁盘使用率" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].disk : 0} suffix="%" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="网络入站" value={monitoringData.length > 0 ? monitoringData[monitoringData.length - 1].network.in : 0} suffix="KB/s" />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card title="CPU 使用率">
                <div id="cpu-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="内存使用率">
                <div id="memory-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Card title="网络流量">
                <div id="network-chart" style={{ width: '100%', height: 300 }}></div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        {/* 日志管理 */}
        <TabPane tab={<><FileTextOutlined /> 日志管理</>} key="logs">
          <Card style={{ marginBottom: 24 }}>
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
          </Card>

          <Card>
            <Table
              columns={logColumns}
              dataSource={logs}
              rowKey="_id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </TabPane>

        {/* 系统告警 */}
        <TabPane tab={<><AlertOutlined /> 系统告警</>} key="alerts">
          <Card style={{ marginBottom: 24 }}>
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
          <Card>
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
              dataSource={[
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
              ]}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* API请求监控 */}
        <TabPane tab={<><ApiOutlined /> API请求监控</>} key="api-monitoring">
          <Card style={{ marginBottom: 24 }}>
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
      </Tabs>
    </div>
  );
};

export default Monitoring;