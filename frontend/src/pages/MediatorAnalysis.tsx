import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Progress, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, FileSearchOutlined, RiseOutlined } from '@ant-design/icons';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Link } from 'react-router-dom';
import { ExportButton, PageHero, PageMetricGrid, PageMetricItem, PageSectionCard, PageShell, PageToolbar } from '../components/common/PageKit';
import { buildExportFileName, exportExcelWorkbook } from '../utils/excel';

const { Text } = Typography;

interface MediatorCase {
  _id: string;
  caseNumber: string;
  disputeType?: string;
  status: string;
  createdAt: string;
  closeTime?: string | null;
  applicantName?: string;
  respondentName?: string;
  latestProgressAt?: string | null;
}

interface MediatorAnalysisSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  overdue: number;
  avgClosedDays: number;
  avgFirstResponseHours: number;
  successRate: number;
  overdueRate: number;
}

const MediatorAnalysis: React.FC = () => {
  const { userInfo } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<MediatorCase[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState<MediatorAnalysisSummary | null>(null);

  const fetchMediatorCases = async () => {
    setLoading(true);
    try {
      const [casesResponse, summaryResponse] = await Promise.all([
        api.get('/case'),
        api.get('/case/mediator-analysis/summary')
      ]);
      setCases(casesResponse.data.cases || []);
      setSummary(summaryResponse.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediatorCases();
  }, []);

  const filteredCases = useMemo(() => {
    if (statusFilter === 'all') return cases;
    return cases.filter((item) => item.status === statusFilter);
  }, [cases, statusFilter]);

  const analysis = useMemo(() => {
    const now = Date.now();
    const total = cases.length;
    const pending = cases.filter((item) => item.status === 'pending').length;
    const processing = cases.filter((item) => item.status === 'processing').length;
    const completed = cases.filter((item) => item.status === 'completed').length;
    const overdue = cases.filter((item) => {
      if (!['pending', 'processing'].includes(item.status)) return false;
      const createdAt = new Date(item.createdAt).getTime();
      return Number.isFinite(createdAt) && now - createdAt > 1000 * 60 * 60 * 24 * 10;
    }).length;

    const closedDurations = cases
      .filter((item) => item.status === 'completed' && item.closeTime)
      .map((item) => {
        const createdAt = new Date(item.createdAt).getTime();
        const closeTime = new Date(item.closeTime as string).getTime();
        return Number.isFinite(createdAt) && Number.isFinite(closeTime)
          ? Math.max(1, Math.round((closeTime - createdAt) / (1000 * 60 * 60 * 24)))
          : null;
      })
      .filter((item): item is number => item !== null);

    const avgClosedDays = closedDurations.length
      ? Math.round(closedDurations.reduce((sum, item) => sum + item, 0) / closedDurations.length)
      : 0;

    const failed = cases.filter((item) => item.status === 'failed').length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const disputeTypeMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    cases.forEach((item) => {
      const type = item.disputeType || '其他';
      disputeTypeMap.set(type, (disputeTypeMap.get(type) || 0) + 1);

      const date = new Date(item.createdAt);
      if (!Number.isNaN(date.getTime())) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
      }
    });

    const disputeTypes = Array.from(disputeTypeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      overdue,
      avgClosedDays,
      completionRate,
      successRate: completed + failed ? Math.round((completed / (completed + failed)) * 100) : 0,
      overdueRate: total ? Math.round((overdue / total) * 100) : 0,
      disputeTypes,
      monthlyTrend
    };
  }, [cases]);

  const tableData = filteredCases.map((item) => ({
    ...item,
    key: item._id
  }));

  const handleExport = () => {
    exportExcelWorkbook(buildExportFileName('调解员办案分析'), [
      {
        name: '分析概览',
        columns: [
          { header: '指标', key: 'label' },
          { header: '数值', key: 'value' }
        ],
        rows: [
          { label: '承办案件', value: analysis.total },
          { label: '待处理', value: analysis.pending },
          { label: '处理中', value: analysis.processing },
          { label: '已完成', value: analysis.completed },
          { label: '失败', value: analysis.failed },
          { label: '超期', value: analysis.overdue },
          { label: '平均结案天数', value: summary?.avgClosedDays ?? analysis.avgClosedDays },
          { label: '首次响应小时', value: summary?.avgFirstResponseHours ?? 0 },
          { label: '成功率', value: summary?.successRate ?? analysis.successRate },
          { label: '超期率', value: summary?.overdueRate ?? analysis.overdueRate }
        ]
      },
      {
        name: '案件结构',
        columns: [
          { header: '争议类型', key: 'name' },
          { header: '数量', key: 'value' }
        ],
        rows: analysis.disputeTypes
      },
      {
        name: '月度趋势',
        columns: [
          { header: '月份', key: 'month' },
          { header: '新接案件', key: 'value' }
        ],
        rows: analysis.monthlyTrend
      },
      {
        name: '案件清单',
        columns: [
          { header: '案件编号', key: 'caseNumber' },
          { header: '申请人', key: 'applicantName' },
          { header: '被申请人', key: 'respondentName' },
          { header: '争议类型', key: 'disputeType' },
          { header: '状态', key: 'status', formatter: (row: MediatorCase) => ({
            pending: '待处理',
            processing: '处理中',
            completed: '已完成',
            failed: '失败'
          }[row.status] || row.status) },
          { header: '创建时间', key: 'createdAt' },
          { header: '最近进展时间', key: 'latestProgressAt', formatter: (row: MediatorCase) => row.latestProgressAt || '' }
        ],
        rows: filteredCases
      }
    ]);
  };

  return (
    <PageShell>
      <PageHero
        tone="violet"
        icon={<BarChartOutlined />}
        title="办案分析"
        description="围绕个人办案节奏、案件结构和处理效率做复盘，帮助调解员判断当前工作负荷与优先级。"
        tags={
          <Space wrap>
            <Tag color="purple-inverse" style={{ borderRadius: 999 }}>个人视角</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>效率复盘</Tag>
          </Space>
        }
        note={
          <Alert
            type="info"
            showIcon
            message="查看建议"
            description="先看完成率和超期数，再看案件结构与最近 6 个月趋势，最后回到案件列表处理重点案件。"
          />
        }
      />

      <PageMetricGrid>
        <PageMetricItem><Statistic title="承办案件" value={analysis.total} suffix="件" prefix={<FileSearchOutlined />} /></PageMetricItem>
        <PageMetricItem><Statistic title="处理中" value={analysis.processing} suffix="件" /></PageMetricItem>
        <PageMetricItem><Statistic title="成功率" value={summary?.successRate ?? analysis.successRate} suffix="%" /></PageMetricItem>
        <PageMetricItem><Statistic title="首次响应" value={summary?.avgFirstResponseHours ?? 0} suffix="小时" prefix={<ClockCircleOutlined />} /></PageMetricItem>
      </PageMetricGrid>

      <PageToolbar>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Text type="secondary">状态筛选</Text>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: '全部案件', value: 'all' },
                { label: '待处理', value: 'pending' },
                { label: '处理中', value: 'processing' },
                { label: '已完成', value: 'completed' },
                { label: '失败', value: 'failed' }
              ]}
            />
          </Col>
          <Col xs={24} md={16}>
            <div style={{ display: 'grid', gap: 12 }}>
              <Alert
                type={analysis.overdue > 0 ? 'warning' : 'success'}
                showIcon
                message={`当前调解员：${userInfo?.name || '未命名调解员'}`}
                description={analysis.overdue > 0
                  ? `有 ${analysis.overdue} 件案件已超过 10 天仍未办结，建议优先处理超期案件。`
                  : '当前暂无超期案件，可以按处理中与新接案件节奏继续推进。'}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <ExportButton onClick={handleExport}>导出办案分析</ExportButton>
              </div>
            </div>
          </Col>
        </Row>
      </PageToolbar>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <PageSectionCard title="办案效率">
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>结案完成率</Text>
                  <Text strong>{analysis.completionRate}%</Text>
                </div>
                <Progress percent={analysis.completionRate} strokeColor="#722ed1" showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>调解成功率</Text>
                  <Text strong>{summary?.successRate ?? analysis.successRate}%</Text>
                </div>
                <Progress percent={summary?.successRate ?? analysis.successRate} strokeColor="#52c41a" showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>待处理压力</Text>
                  <Text strong>{analysis.pending + analysis.processing} 件</Text>
                </div>
                <Progress percent={analysis.total ? Math.round(((analysis.pending + analysis.processing) / analysis.total) * 100) : 0} strokeColor="#1677ff" showInfo={false} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>超期风险</Text>
                  <Text strong>{summary?.overdueRate ?? analysis.overdueRate}%</Text>
                </div>
                <Progress percent={summary?.overdueRate ?? analysis.overdueRate} strokeColor="#ff4d4f" showInfo={false} />
              </div>
              <div style={{ padding: 14, borderRadius: 14, background: '#f8fbff', border: '1px solid #e6f4ff' }}>
                <Text type="secondary">平均结案时长</Text>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{summary?.avgClosedDays ?? analysis.avgClosedDays} 天</div>
                <Text type="secondary">首次响应平均 {summary?.avgFirstResponseHours ?? 0} 小时</Text>
              </div>
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24} xl={14}>
          <PageSectionCard title="案件结构">
            <div style={{ display: 'grid', gap: 12 }}>
              {analysis.disputeTypes.length === 0 ? (
                <Text type="secondary">暂无案件结构数据</Text>
              ) : analysis.disputeTypes.map((item) => (
                <div key={item.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>{item.name}</Text>
                    <Text strong>{item.value} 件</Text>
                  </div>
                  <Progress
                    percent={analysis.total ? Math.round((item.value / analysis.total) * 100) : 0}
                    showInfo={false}
                    strokeColor="#13a8a8"
                  />
                </div>
              ))}
            </div>
          </PageSectionCard>
        </Col>

        <Col xs={24}>
          <PageSectionCard title="最近 6 个月承办趋势">
            <Row gutter={[16, 16]}>
              {analysis.monthlyTrend.length === 0 ? (
                <Col span={24}>
                  <Text type="secondary">暂无趋势数据</Text>
                </Col>
              ) : analysis.monthlyTrend.map((item) => (
                <Col xs={12} md={8} lg={4} key={item.month}>
                  <div style={{ padding: 16, borderRadius: 16, background: '#f8f7ff', border: '1px solid #efebff' }}>
                    <Text type="secondary">{item.month}</Text>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#531dab' }}>{item.value}</div>
                    <Text type="secondary">新接案件</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </PageSectionCard>
        </Col>

        <Col xs={24}>
          <PageSectionCard title="案件清单" extra={<Link to="/case-query">去案件查询</Link>}>
            <Table
              rowKey="key"
              loading={loading}
              dataSource={tableData}
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: '案件编号',
                  dataIndex: 'caseNumber',
                  render: (_: string, record: MediatorCase) => <Link to={`/case/${record._id}`}>{record.caseNumber}</Link>
                },
                {
                  title: '申请人 / 被申请人',
                  render: (_: unknown, record: MediatorCase) => `${record.applicantName || '-'} / ${record.respondentName || '-'}`
                },
                {
                  title: '争议类型',
                  dataIndex: 'disputeType',
                  render: (value: string) => value || '其他'
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (value: string) => {
                    const colorMap: Record<string, string> = {
                      pending: 'gold',
                      processing: 'blue',
                      completed: 'green',
                      failed: 'red'
                    };
                    const labelMap: Record<string, string> = {
                      pending: '待处理',
                      processing: '处理中',
                      completed: '已完成',
                      failed: '失败'
                    };
                    return <Tag color={colorMap[value] || 'default'}>{labelMap[value] || value}</Tag>;
                  }
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  render: (value: string) => new Date(value).toLocaleDateString()
                },
                {
                  title: '最近进展',
                  dataIndex: 'latestProgressAt',
                  render: (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : '暂无更新'
                }
              ]}
            />
          </PageSectionCard>
        </Col>
      </Row>
    </PageShell>
  );
};

export default MediatorAnalysis;
