import React, { useEffect, useState } from 'react';
import { Card, Statistic, Row, Col, Spin, Alert } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface StatsData {
  totalCases: number;
  pendingCases: number;
  completedCases: number;
  successRate: number;
  thisMonthCases: number;
  lastMonthCases: number;
}

const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (err) {
      setError('获取统计数据失败');
      // 使用模拟数据
      setStats({
        totalCases: 1280,
        pendingCases: 120,
        completedCases: 1160,
        successRate: 92.3,
        thisMonthCases: 86,
        lastMonthCases: 72,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert message={error} type="error" showIcon />
    );
  }

  if (!stats) {
    return null;
  }

  const monthChange = ((stats.thisMonthCases - stats.lastMonthCases) / stats.lastMonthCases * 100).toFixed(1);
  const monthChangePositive = stats.thisMonthCases > stats.lastMonthCases;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="总案件数"
            value={stats.totalCases}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="待处理案件"
            value={stats.pendingCases}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="已完成案件"
            value={stats.completedCases}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="调解成功率"
            value={stats.successRate}
            suffix="%"
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="本月新增"
            value={stats.thisMonthCases}
            prefix={monthChangePositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            valueStyle={{ color: monthChangePositive ? '#52c41a' : '#f5222d' }}
            suffix={`${monthChange}%`}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={8}>
        <Card>
          <Statistic
            title="待办事项"
            value={stats.pendingCases}
            valueStyle={{ color: '#fa541c' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default DashboardStats;
