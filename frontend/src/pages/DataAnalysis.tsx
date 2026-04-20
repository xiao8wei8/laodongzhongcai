import React, { useState, useEffect, useRef } from 'react';
import { Card, Tabs, Statistic, Row, Col, Spin, message, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';

const { Title } = Typography;
import api from '../services/api';

const { TabPane } = Tabs;

const DataAnalysis: React.FC = () => {
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
  const caseTrendRef = useRef<HTMLDivElement>(null);
  const visitorRef = useRef<HTMLDivElement>(null);
  const caseTypeRef = useRef<HTMLDivElement>(null);
  let caseTrendChart: echarts.ECharts | null = null;
  let visitorChart: echarts.ECharts | null = null;
  let caseTypeChart: echarts.ECharts | null = null;

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log('开始获取数据...');
      // 分别获取数据，以便更好地定位错误
      const statsResponse = await api.get('/dashboard/stats');
      console.log('获取统计数据成功:', statsResponse.data);
      
      const caseTrendResponse = await api.get('/dashboard/case-trend');
      console.log('获取案件趋势数据成功:', caseTrendResponse.data);
      
      const caseTypeResponse = await api.get('/dashboard/case-type');
      console.log('获取案件类型数据成功:', caseTypeResponse.data);
      
      const visitorTrendResponse = await api.get('/dashboard/visitor-trend');
      console.log('获取访客趋势数据成功:', visitorTrendResponse.data);

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
      
      console.log('数据获取和设置完成');
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
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <BarChartOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>数据分析</Title>
        </div>
      </div>
      <Card className="mb-4">
      <Spin spinning={loading}>
        <Tabs defaultActiveKey="overview" onChange={handleTabChange}>
          <TabPane tab="概览" key="overview">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                <Card>
                  <Statistic title="总案件数" value={statistics.totalCases} />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                <Card>
                  <Statistic title="待处理案件" value={statistics.pendingCases} />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                <Card>
                  <Statistic title="已解决案件" value={statistics.resolvedCases} />
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                <Card>
                  <Statistic title="今日访客" value={statistics.visitorCount} />
                </Card>
              </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}>
                <Card>
                  <div ref={caseTypeRef} style={{ height: 400 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card>
                  <div ref={caseTrendRef} style={{ height: 400 }} />
                </Card>
              </Col>
            </Row>
          </TabPane>
          <TabPane tab="案件趋势" key="trends">
            <Card>
              <div ref={caseTrendRef} style={{ height: 500 }} />
            </Card>
          </TabPane>
          <TabPane tab="访客分析" key="visitors">
            <Card>
              <div ref={visitorRef} style={{ height: 500 }} />
            </Card>
          </TabPane>
        </Tabs>
      </Spin>
      </Card>
    </div>
  );
};

export default DataAnalysis;