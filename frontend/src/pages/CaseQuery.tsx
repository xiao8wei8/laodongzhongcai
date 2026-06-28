import { useMemo, useState, useEffect } from 'react';
import { Table, Input, Button, message, Typography, Tag, Space, Select, Card, Row, Col, Statistic, Avatar, Alert } from 'antd';
import { SearchOutlined, FileSearchOutlined, PhoneOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { ExportButton, PageHero, PageSectionCard, PageShell, PageToolbar } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface TenantOption {
  id: string;
  tenantName: string;
}

interface Case {
  _id: string;
  caseNumber: string;
  disputeType?: string;
  isConsultation?: boolean;
  applicantName?: string;
  applicantPhone?: string;
  respondentName?: string;
  respondentPhone?: string;
  status: string;
  mediatorName?: string;
  mediatorPhone?: string;
  tenantName?: string;
  districtName?: string;
  streetName?: string;
  latestProgress?: string;
  latestProgressAt?: string;
  requestItems?: string;
  factsReasons?: string;
  createdAt: string;
  updatedAt?: string;
}

const getTimeValue = (value?: string) => new Date(value || 0).getTime();
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString() : '-';
const truncate = (value?: string, max = 36) => {
  const text = String(value || '').trim();
  if (!text) return '暂无';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};
const getStatusMeta = (status?: string) => {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待处理', color: 'gold' },
    processing: { label: '调解中', color: 'processing' },
    completed: { label: '已完成', color: 'success' },
    failed: { label: '失败', color: 'error' },
    in_progress: { label: '调解中', color: 'processing' },
    '已驳回': { label: '失败', color: 'error' }
  };
  return map[status || ''] || { label: status || '未知', color: 'default' };
};

const CaseQuery: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { userInfo } = useAuthStore();

  const fetchCases = async () => {
    setLoading(true);
    try {
      const response = await api.get('/case', {
        params: { keyword }
      });
      setCases(response.data.cases);
    } catch (error) {
      message.error('获取案件列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get('/tenant');
      setTenants(response.data.tenants || []);
    } catch (_error) {
      setTenants([]);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [keyword]);

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSearch = (value: string) => {
    setKeyword(value);
  };

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const statusMatched = statusFilter === 'all' ? true : item.status === statusFilter;
      const typeMatched =
        typeFilter === 'all'
          ? true
          : typeFilter === 'consultation'
            ? !!item.isConsultation
            : !item.isConsultation;
      const tenantMatched = tenantFilter === 'all' ? true : item.tenantName === tenantFilter;

      return statusMatched && typeMatched && tenantMatched;
    });
  }, [cases, statusFilter, typeFilter, tenantFilter]);

  const queryStats = useMemo(() => ({
    total: filteredCases.length,
    pending: filteredCases.filter((item) => item.status === 'pending').length,
    processing: filteredCases.filter((item) => item.status === 'processing' || item.status === 'in_progress').length,
    completed: filteredCases.filter((item) => item.status === 'completed').length,
    failed: filteredCases.filter((item) => item.status === 'failed' || item.status === '已驳回').length,
    consultation: filteredCases.filter((item) => item.isConsultation).length,
    mediationApply: filteredCases.filter((item) => !item.isConsultation).length,
    withMediator: filteredCases.filter((item) => !!item.mediatorName).length,
    withoutMediator: filteredCases.filter((item) => !item.mediatorName).length
  }), [filteredCases]);

  const exportColumns: ExcelColumn<Case>[] = [
    { header: '案件编号', key: 'caseNumber' },
    { header: '类型', key: 'disputeType', formatter: (row) => row.isConsultation ? '咨询' : (row.disputeType || '调解申请') },
    { header: '申请人', key: 'applicantName' },
    { header: '申请人电话', key: 'applicantPhone' },
    { header: '被申请人', key: 'respondentName' },
    { header: '被申请人电话', key: 'respondentPhone' },
    { header: '所属街道', key: 'tenantName', formatter: (row) => row.tenantName || '-' },
    { header: '状态', key: 'status', formatter: (row) => getStatusMeta(row.status).label },
    { header: '承办调解员', key: 'mediatorName', formatter: (row) => row.mediatorName || '待分配' },
    { header: '调解员电话', key: 'mediatorPhone', formatter: (row) => row.mediatorPhone || '' },
    { header: '最近进展', key: 'latestProgress', formatter: (row) => row.latestProgress || '' },
    { header: '创建时间', key: 'createdAt', formatter: (row) => formatDateTime(row.createdAt) }
  ];

  const handleExport = () => {
    if (filteredCases.length === 0) {
      warnNoExportData('当前没有可导出的案件数据');
      return;
    }
    exportExcel(buildExportFileName('案件查询'), exportColumns, filteredCases);
    message.success(`已导出 ${filteredCases.length} 条案件记录`);
  };

  const columns: ColumnsType<Case> = [
    {
      title: '案件信息',
      key: 'caseInfo',
      width: 220,
      fixed: 'left',
      sorter: (a: Case, b: Case) => String(a.caseNumber || '').localeCompare(String(b.caseNumber || '')),
      render: (_: unknown, record: Case) => (
        <Space direction="vertical" size={2}>
          <Link to={`/case/${record._id}`} style={{ fontWeight: 600 }}>{record.caseNumber}</Link>
          <Space size={6} wrap>
            <Tag color={record.isConsultation ? 'geekblue' : 'blue'}>
              {record.isConsultation ? '咨询' : (record.disputeType || '案件')}
            </Tag>
            {record.tenantName ? <Tag color="default">{record.tenantName}</Tag> : null}
          </Space>
        </Space>
      )
    },
    {
      title: '当事人',
      key: 'parties',
      width: 220,
      render: (_: unknown, record: Case) => (
        <Space direction="vertical" size={2}>
          <Text>{record.applicantName || '未填写申请人'}</Text>
          <Text type="secondary">{record.applicantPhone || '-'}</Text>
          {!record.isConsultation && (
            <Text type="secondary">对方：{record.respondentName || '-'}</Text>
          )}
        </Space>
      )
    },
    {
      title: '业务信息',
      key: 'business',
      width: 260,
      render: (_: unknown, record: Case) => (
        <Space direction="vertical" size={4}>
          <Space size={6}>
            <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
            <Text>{record.tenantName || '未分配街道'}</Text>
          </Space>
          <Text type="secondary">{truncate(record.requestItems || record.factsReasons, 28)}</Text>
        </Space>
      )
    },
    {
      title: '状态与时间',
      key: 'statusTime',
      width: 170,
      sorter: (a: Case, b: Case) => getTimeValue(a.createdAt) - getTimeValue(b.createdAt),
      defaultSortOrder: 'descend' as const,
      render: (_: unknown, record: Case) => {
        const statusMeta = getStatusMeta(record.status);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            <Text type="secondary">{formatDateTime(record.createdAt)}</Text>
          </Space>
        );
      }
    },
    {
      title: '承办调解员',
      key: 'mediator',
      width: 180,
      sorter: (a: Case, b: Case) => String(a.mediatorName || '').localeCompare(String(b.mediatorName || '')),
      render: (_: unknown, record: Case) => (
        <Space direction="vertical" size={2}>
          <Text>{record.mediatorName || '待分配'}</Text>
          <Space size={6}>
            <PhoneOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">{record.mediatorPhone || '暂无联系方式'}</Text>
          </Space>
        </Space>
      )
    },
    {
      title: '最近进展',
      key: 'latestProgress',
      width: 280,
      render: (_: unknown, record: Case) => (
        <Space direction="vertical" size={3}>
          <Text>{truncate(record.latestProgress, 44)}</Text>
          <Space size={6}>
            <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">{formatDateTime(record.latestProgressAt || record.updatedAt || record.createdAt)}</Text>
          </Space>
        </Space>
      )
    }
  ];

  return (
    <PageShell>
      <PageHero
        tone="blue"
        icon={<FileSearchOutlined />}
        title="案件检索台"
        description="用于精确检索、组合筛选和快速定位案件，不重复承担工作台总览职责，更强调检索效率和结果质量。"
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>组合筛选</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>快速进入详情</Tag>
          </>
        }
        note={
          <Alert
            message="检索建议"
            description="先用关键词缩小范围，再用街道、状态和类型组合筛选，能更快找到目标案件。"
            type="info"
            showIcon
          />
        }
      />

      <PageSectionCard title="检索概览">
        <div style={{ display: 'grid', gap: 16 }}>
          <Card bordered={false} style={{ background: '#f8fbff', borderRadius: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: '#262626' }}>流程状态</div>
              <Text type="secondary">先看总量和处理进度，再决定是否继续筛选。</Text>
            </div>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={8} lg={4}>
                <Card bordered={false} className="page-metric-card">
                  <Statistic title="检索结果" value={queryStats.total} suffix="条" />
                </Card>
              </Col>
              <Col xs={12} md={8} lg={5}>
                <Card bordered={false} className="page-metric-card">
                  <Statistic title="待处理" value={queryStats.pending} suffix="条" />
                </Card>
              </Col>
              <Col xs={12} md={8} lg={5}>
                <Card bordered={false} className="page-metric-card">
                  <Statistic title="调解中" value={queryStats.processing} suffix="条" />
                </Card>
              </Col>
              <Col xs={12} md={8} lg={5}>
                <Card bordered={false} className="page-metric-card">
                  <Statistic title="已完成" value={queryStats.completed} suffix="条" />
                </Card>
              </Col>
              <Col xs={12} md={8} lg={5}>
                <Card bordered={false} className="page-metric-card">
                  <Statistic title="处理失败" value={queryStats.failed} suffix="条" />
                </Card>
              </Col>
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card bordered={false} style={{ background: '#fafafa', borderRadius: 16, height: '100%' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#262626' }}>案件类型</div>
                  <Text type="secondary">快速区分咨询和正式申请调解。</Text>
                </div>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Card bordered={false} className="page-metric-card">
                      <Statistic title="咨询类" value={queryStats.consultation} suffix="条" />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card bordered={false} className="page-metric-card">
                      <Statistic title="申请调解类" value={queryStats.mediationApply} suffix="条" />
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card bordered={false} style={{ background: '#fafafa', borderRadius: 16, height: '100%' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: '#262626' }}>分配情况</div>
                  <Text type="secondary">判断案件是否已经进入明确承办阶段。</Text>
                </div>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Card bordered={false} className="page-metric-card">
                      <Statistic title="已分配调解员" value={queryStats.withMediator} suffix="条" />
                    </Card>
                  </Col>
                  <Col xs={24} md={12}>
                    <Card bordered={false} className="page-metric-card">
                      <Statistic title="未分配调解员" value={queryStats.withoutMediator} suffix="条" />
                    </Card>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </div>
      </PageSectionCard>

      <PageToolbar>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} lg={10}>
            <Text type="secondary">关键词搜索</Text>
            <Search
              placeholder="按案件编号、申请人、被申请人、街道或进展内容搜索"
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: '100%', marginTop: 8 }}
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Text type="secondary">街道筛选</Text>
            <Select value={tenantFilter} onChange={setTenantFilter} style={{ width: '100%', marginTop: 8 }} placeholder="筛选街道">
              <Option value="all">全部街道</Option>
              {tenants.map((tenant) => (
                <Option key={tenant.id} value={tenant.tenantName}>{tenant.tenantName}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Text type="secondary">状态筛选</Text>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%', marginTop: 8 }}>
              <Option value="all">全部状态</Option>
              <Option value="pending">待处理</Option>
              <Option value="processing">调解中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Text type="secondary">类型筛选</Text>
            <Select value={typeFilter} onChange={setTypeFilter} style={{ width: '100%', marginTop: 8 }}>
              <Option value="all">全部类型</Option>
              <Option value="consultation">咨询</Option>
              <Option value="case">调解申请</Option>
            </Select>
          </Col>
        </Row>
        <div style={{ marginTop: 16 }}>
          <Space wrap>
            <Button
              onClick={() => {
                setTenantFilter('all');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              重置筛选
            </Button>
            <ExportButton onClick={handleExport} />
          </Space>
        </div>
      </PageToolbar>

      <PageSectionCard bodyClassName="" className="">
        <Table
        columns={columns}
        dataSource={filteredCases}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 1280 }}
        size="middle"
        onRow={(record) => ({
          onClick: () => navigate(`/case/${record._id}`),
          style: { cursor: 'pointer' }
        })}
        locale={{
          emptyText: (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ marginBottom: 12 }}>未找到相关案件</div>
            </div>
          )
        }}
      />
      </PageSectionCard>
    </PageShell>
  );
};

export default CaseQuery;
