import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Tabs, Statistic, Row, Col, Spin, message, Typography, Alert, Tag, Table, Progress, Space } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import { ExportButton, PageHero, PageMetricGrid, PageMetricItem, PageSectionCard, PageShell } from '../components/common/PageKit';
import { useNavigate } from 'react-router-dom';
import { buildExportFileName, exportExcelWorkbook } from '../utils/excel';

const { Title, Text } = Typography;
import api from '../services/api';

const { TabPane } = Tabs;

interface MediatorOverviewItem {
  id: string;
  name: string;
  phone?: string;
  tenantName?: string;
  totalCases: number;
  processingCases: number;
  completedCases: number;
  failedCases: number;
  overdueCases: number;
  avgClosedDays: number;
  avgFirstResponseHours: number;
  successRate: number;
  overdueRate: number;
}

interface DutyOverviewItem {
  tenantId: string;
  tenantName: string;
  mediatorCount: number;
  dutyRosterCount: number;
  allowAdminAsMediator: boolean;
  hasGap: boolean;
  currentDutyAssignee?: {
    id: string;
    name: string;
    phone?: string;
    source?: string;
  } | null;
}

interface DutyStabilityItem {
  tenantId: string;
  tenantName: string;
  rosterCount: number;
  hasGap: boolean;
  totalAdjustments: number;
  overrideCount: number;
  advanceCount: number;
  consecutiveOverrideDays: number;
  stabilityScore: number;
}

const DataAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalCases: 0,
    pendingCases: 0,
    resolvedCases: 0,
    visitorCount: 0
  });
  const [caseTrendData, setCaseTrendData] = useState<any[]>([]);
  const [caseTypeData, setCaseTypeData] = useState<any[]>([]);
  const [visitorTrendData, setVisitorTrendData] = useState<any[]>([]);
  const [mediatorOverview, setMediatorOverview] = useState<MediatorOverviewItem[]>([]);
  const [dutyOverview, setDutyOverview] = useState<DutyOverviewItem[]>([]);
  const [dutyStabilityRanking, setDutyStabilityRanking] = useState<DutyStabilityItem[]>([]);
  const caseTrendRef = useRef<HTMLDivElement>(null);
  const visitorRef = useRef<HTMLDivElement>(null);
  const caseTypeRef = useRef<HTMLDivElement>(null);
  let caseTrendChart: echarts.ECharts | null = null;
  let visitorChart: echarts.ECharts | null = null;
  let caseTypeChart: echarts.ECharts | null = null;

  const dutyWarnings = useMemo(() => {
    return dutyStabilityRanking
      .filter((item) => item.hasGap || item.stabilityScore < 80 || item.consecutiveOverrideDays > 0)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        warningText: item.hasGap
          ? '值班名单存在缺口'
          : item.consecutiveOverrideDays > 0
            ? `已连续 ${item.consecutiveOverrideDays} 天使用代理`
            : `近30天代理 ${item.overrideCount} 次，需关注轮值稳定性`
      }));
  }, [dutyStabilityRanking]);

  const handleExportAnalysis = () => {
    exportExcelWorkbook(buildExportFileName('运营分析'), [
      {
        name: '概览指标',
        columns: [
          { header: '指标', key: 'label' },
          { header: '数值', key: 'value' }
        ],
        rows: [
          { label: '总案件数', value: statistics.totalCases },
          { label: '待处理案件', value: statistics.pendingCases },
          { label: '已解决案件', value: statistics.resolvedCases },
          { label: '今日访客', value: statistics.visitorCount }
        ]
      },
      {
        name: '案件趋势',
        columns: [
          { header: '月份', key: 'month' },
          { header: '案件数量', key: 'count' }
        ],
        rows: caseTrendData
      },
      {
        name: '案件类型',
        columns: [
          { header: '案件类型', key: 'name' },
          { header: '数量', key: 'value' }
        ],
        rows: caseTypeData
      },
      {
        name: '访客趋势',
        columns: [
          { header: '月份', key: 'month' },
          { header: '访客数量', key: 'count' }
        ],
        rows: visitorTrendData
      },
      {
        name: '调解员分析',
        columns: [
          { header: '调解员', key: 'name' },
          { header: '所属街道', key: 'tenantName' },
          { header: '承办案件', key: 'totalCases' },
          { header: '处理中', key: 'processingCases' },
          { header: '成功率', key: 'successRate' },
          { header: '超期案件', key: 'overdueCases' },
          { header: '超期率', key: 'overdueRate' },
          { header: '首次响应(小时)', key: 'avgFirstResponseHours' }
        ],
        rows: mediatorOverview
      },
      {
        name: '值班预警',
        columns: [
          { header: '街道', key: 'tenantName' },
          { header: '预警说明', key: 'warningText' },
          { header: '近30天调整', key: 'totalAdjustments' },
          { header: '稳定度', key: 'stabilityScore' }
        ],
        rows: dutyWarnings
      },
      {
        name: '稳定度排行',
        columns: [
          { header: '街道', key: 'tenantName' },
          { header: '值班名单', key: 'rosterCount' },
          { header: '近30天调整', key: 'totalAdjustments' },
          { header: '近30天代理', key: 'overrideCount' },
          { header: '顺延次数', key: 'advanceCount' },
          { header: '连续代理天数', key: 'consecutiveOverrideDays' },
          { header: '稳定度', key: 'stabilityScore' }
        ],
        rows: dutyStabilityRanking
      },
      {
        name: '值班总览',
        columns: [
          { header: '街道', key: 'tenantName' },
          { header: '调解员数', key: 'mediatorCount' },
          { header: '值班名单数', key: 'dutyRosterCount' },
          { header: '当前接收人', key: 'currentDutyAssignee', formatter: (row: DutyOverviewItem) => row.currentDutyAssignee?.name || '未设置' },
          { header: '允许管理员接管', key: 'allowAdminAsMediator', formatter: (row: DutyOverviewItem) => row.allowAdminAsMediator ? '是' : '否' },
          { header: '状态', key: 'hasGap', formatter: (row: DutyOverviewItem) => row.hasGap ? '存在缺口' : '覆盖正常' }
        ],
        rows: dutyOverview
      }
    ]);
    message.success('已导出运营分析报表');
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        statsResponse,
        caseTrendResponse,
        caseTypeResponse,
        visitorTrendResponse
      ] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/case-trend'),
        api.get('/dashboard/case-type'),
        api.get('/dashboard/visitor-trend')
      ]);

      // 设置统计数据
      setStatistics({
        totalCases: statsResponse.data.data.totalCases,
        pendingCases: statsResponse.data.data.pendingCases,
        resolvedCases: statsResponse.data.data.completedCases,
        visitorCount: statsResponse.data.data.todayVisitors
      });

      // 设置图表数据
      setCaseTrendData(caseTrendResponse.data.data || []);
      setCaseTypeData(caseTypeResponse.data.data || []);
      setVisitorTrendData(visitorTrendResponse.data.data || []);

      try {
        const mediatorOverviewResponse = await api.get('/dashboard/mediator-overview');
        setMediatorOverview(mediatorOverviewResponse.data.data || []);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setMediatorOverview([]);
        } else {
          throw error;
        }
      }

      try {
        const dutyOverviewResponse = await api.get('/dashboard/duty-overview');
        setDutyOverview(dutyOverviewResponse.data.data || []);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setDutyOverview([]);
        } else {
          throw error;
        }
      }

      try {
        const dutyStabilityResponse = await api.get('/dashboard/duty-stability-ranking');
        setDutyStabilityRanking(dutyStabilityResponse.data.data || []);
      } catch (error: any) {
        if (error?.response?.status === 404) {
          setDutyStabilityRanking([]);
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('获取数据失败:', error);
      console.error('错误信息:', error.message);
      console.error('错误响应:', error.response);
      message.error('获取数据失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const initCharts = () => {
    initCaseTrendChart();
    initVisitorChart();
    initCaseTypeChart();
  };

  const initCaseTrendChart = () => {
    if (caseTrendRef.current) {
      caseTrendChart = echarts.init(caseTrendRef.current);
      // 从后端数据中提取月份和案件数量
      const months = caseTrendData.map(item => item.month);
      const counts = caseTrendData.map(item => item.count);
      
      const option = {
        title: {
          text: '案件趋势分析',
          left: 'center'
        },
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          data: ['案件数量'],
          bottom: 10
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: months.length > 0 ? months : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        },
        yAxis: {
          type: 'value'
        },
        series: [
          {
            name: '案件数量',
            type: 'line',
            stack: 'Total',
            data: counts.length > 0 ? counts : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            areaStyle: {}
          }
        ]
      };
      caseTrendChart.setOption(option);
    }
  };

  const initVisitorChart = () => {
    if (visitorRef.current) {
      visitorChart = echarts.init(visitorRef.current);
      // 从后端数据中提取月份和访客数量
      const months = visitorTrendData.map(item => item.month);
      const counts = visitorTrendData.map(item => item.count);
      
      const option = {
        title: {
          text: '访客趋势分析',
          left: 'center'
        },
        tooltip: {
          trigger: 'axis'
        },
        legend: {
          data: ['访客数量'],
          bottom: 10
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: months.length > 0 ? months : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        },
        yAxis: {
          type: 'value'
        },
        series: [
          {
            name: '访客数量',
            type: 'bar',
            data: counts.length > 0 ? counts : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        ]
      };
      visitorChart.setOption(option);
    }
  };

  const initCaseTypeChart = () => {
    if (caseTypeRef.current) {
      caseTypeChart = echarts.init(caseTypeRef.current);
      
      const option = {
        title: {
          text: '案件类型分布',
          left: 'center'
        },
        tooltip: {
          trigger: 'item'
        },
        legend: {
          orient: 'vertical',
          left: 'left'
        },
        series: [
          {
            name: '案件类型',
            type: 'pie',
            radius: '50%',
            data: caseTypeData.length > 0 ? caseTypeData : [
              { value: 1, name: '暂无数据' }
            ],
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      };
      caseTypeChart.setOption(option);
    }
  };

  // 监听窗口大小变化，调整图表大小
  useEffect(() => {
    const handleResize = () => {
      caseTrendChart?.resize();
      visitorChart?.resize();
      caseTypeChart?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 初始化图表
  useEffect(() => {
    if (!loading && (caseTrendData.length > 0 || caseTypeData.length > 0 || visitorTrendData.length > 0)) {
      initCharts();
    }
  }, [loading, caseTrendData, caseTypeData, visitorTrendData]);

  // 当标签页切换时重新初始化图表
  const handleTabChange = () => {
    // 延迟初始化，确保DOM已经更新
    setTimeout(() => {
      initCharts();
    }, 100);
  };

  return (
    <PageShell>
      <PageHero
        tone="teal"
        icon={<BarChartOutlined />}
        title="运营分析台"
        description="用于观察案件规模、处理进度、类型结构和访客走势。建议先看概览，再进入趋势和访客分析做拆解。"
        tags={
          <>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>趋势分析</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>结构洞察</Tag>
          </>
        }
        note={
          <Alert
            message="使用建议"
            description="先看概览确认整体走势，再进入调解员分析和值班总览定位街道执行缺口。"
            type="info"
            showIcon
          />
        }
      />
      <PageSectionCard>
      <Spin spinning={loading}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <ExportButton onClick={handleExportAnalysis}>导出分析报表</ExportButton>
        </div>
        <Tabs defaultActiveKey="overview" onChange={handleTabChange}>
          <TabPane tab="概览" key="overview">
            <PageMetricGrid>
              <PageMetricItem><Statistic title="总案件数" value={statistics.totalCases} prefix={<LineChartOutlined />} /></PageMetricItem>
              <PageMetricItem><Statistic title="待处理案件" value={statistics.pendingCases} /></PageMetricItem>
              <PageMetricItem><Statistic title="已解决案件" value={statistics.resolvedCases} /></PageMetricItem>
              <PageMetricItem><Statistic title="今日访客" value={statistics.visitorCount} prefix={<PieChartOutlined />} /></PageMetricItem>
            </PageMetricGrid>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <div ref={caseTypeRef} style={{ height: 400 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <div ref={caseTrendRef} style={{ height: 400 }} />
                </Card>
              </Col>
            </Row>
          </TabPane>
          <TabPane tab="调解员分析" key="mediators">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic title="调解员人数" value={mediatorOverview.length} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic
                    title="平均成功率"
                    value={mediatorOverview.length ? Math.round(mediatorOverview.reduce((sum, item) => sum + item.successRate, 0) / mediatorOverview.length) : 0}
                    suffix="%"
                  />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic
                    title="高负荷调解员"
                    value={mediatorOverview.filter(item => item.processingCases >= 5 || item.overdueCases > 0).length}
                  />
                </Card>
              </Col>
              <Col xs={24}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Table
                    rowKey="id"
                    pagination={{ pageSize: 8 }}
                    dataSource={mediatorOverview}
                    columns={[
                      { title: '调解员', dataIndex: 'name' },
                      { title: '所属街道', dataIndex: 'tenantName', render: (value: string) => value || '未分配' },
                      { title: '承办案件', dataIndex: 'totalCases' },
                      { title: '处理中', dataIndex: 'processingCases' },
                      {
                        title: '成功率',
                        dataIndex: 'successRate',
                        render: (value: number) => <Progress percent={value} size="small" />
                      },
                      {
                        title: '超期率',
                        dataIndex: 'overdueRate',
                        render: (value: number, record: MediatorOverviewItem) => (
                          <div>
                            <Progress percent={value} size="small" strokeColor={value > 20 ? '#ff4d4f' : '#1677ff'} />
                            <Text type="secondary">{record.overdueCases} 件超期</Text>
                          </div>
                        )
                      },
                      { title: '首次响应', dataIndex: 'avgFirstResponseHours', render: (value: number) => `${value} 小时` }
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>值班预警榜单</div>
                  <Table
                    rowKey="tenantId"
                    pagination={false}
                    dataSource={dutyWarnings}
                    columns={[
                      { title: '街道', dataIndex: 'tenantName' },
                      { title: '预警说明', dataIndex: 'warningText' },
                      { title: '近30天调整', dataIndex: 'totalAdjustments' },
                      {
                        title: '稳定度',
                        dataIndex: 'stabilityScore',
                        render: (value: number) => <Tag color={value < 60 ? 'red' : value < 80 ? 'orange' : 'green'}>{value}</Tag>
                      }
                    ]}
                  />
                </Card>
              </Col>
              <Col xs={24}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>街道值班稳定度排行</div>
                  <Table
                    rowKey="tenantId"
                    pagination={{ pageSize: 8 }}
                    dataSource={dutyStabilityRanking}
                    onRow={(record) => ({
                      onClick: () => navigate(`/user-management?tenantId=${record.tenantId}&focus=duty`),
                      style: { cursor: 'pointer' }
                    })}
                    columns={[
                      {
                        title: '街道',
                        dataIndex: 'tenantName',
                        render: (value: string) => <a>{value}</a>
                      },
                      {
                        title: '稳定度',
                        dataIndex: 'stabilityScore',
                        render: (value: number) => <Progress percent={value} size="small" strokeColor={value < 60 ? '#ff4d4f' : value < 80 ? '#faad14' : '#52c41a'} />
                      },
                      { title: '值班名单', dataIndex: 'rosterCount' },
                      { title: '近30天调整', dataIndex: 'totalAdjustments' },
                      { title: '近30天代理', dataIndex: 'overrideCount' },
                      { title: '连续代理天数', dataIndex: 'consecutiveOverrideDays' },
                      {
                        title: '状态',
                        render: (_, record: DutyStabilityItem) => (
                          <Tag color={record.hasGap ? 'red' : record.stabilityScore < 60 ? 'orange' : 'green'}>
                            {record.hasGap ? '缺口' : record.stabilityScore < 60 ? '需关注' : '稳定'}
                          </Tag>
                        )
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>
          <TabPane tab="值班总览" key="duty">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic title="街道数量" value={dutyOverview.length} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic title="已配置值班街道" value={dutyOverview.filter(item => item.dutyRosterCount > 0).length} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic title="存在缺口街道" value={dutyOverview.filter(item => item.hasGap).length} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Statistic title="需重点关注街道" value={dutyWarnings.length} />
                </Card>
              </Col>
              <Col xs={24}>
                <Card bordered={false} style={{ borderRadius: 18 }}>
                  <Table
                    rowKey="tenantId"
                    pagination={{ pageSize: 8 }}
                    dataSource={dutyOverview}
                    columns={[
                      { title: '街道', dataIndex: 'tenantName' },
                      { title: '调解员数', dataIndex: 'mediatorCount' },
                      { title: '值班名单', dataIndex: 'dutyRosterCount' },
                      { title: '当前接收人', render: (_, record: DutyOverviewItem) => record.currentDutyAssignee?.name || '未设置' },
                      {
                        title: '接管策略',
                        render: (_, record: DutyOverviewItem) => (
                          <Tag color={record.allowAdminAsMediator ? 'gold' : 'default'}>
                            {record.allowAdminAsMediator ? '允许管理员接管' : '仅调解员接收'}
                          </Tag>
                        )
                      },
                      {
                        title: '状态',
                        render: (_, record: DutyOverviewItem) => (
                          <Tag color={record.hasGap ? 'red' : 'green'}>
                            {record.hasGap ? '存在缺口' : '覆盖正常'}
                          </Tag>
                        )
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>
          <TabPane tab="案件趋势" key="trends">
            <Card bordered={false} style={{ borderRadius: 18 }}>
              <div ref={caseTrendRef} style={{ height: 500 }} />
            </Card>
          </TabPane>
          <TabPane tab="访客分析" key="visitors">
            <Card bordered={false} style={{ borderRadius: 18 }}>
              <div ref={visitorRef} style={{ height: 500 }} />
            </Card>
          </TabPane>
        </Tabs>
      </Spin>
      </PageSectionCard>
    </PageShell>
  );
};

export default DataAnalysis;
