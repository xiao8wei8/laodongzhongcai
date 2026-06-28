import { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Statistic, Table, Button, message, Badge, Input, Tag, Typography, Empty, Alert } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, BellOutlined, HomeOutlined, SearchOutlined, RightOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
import api from '../services/api';
import { PageHero, PageMetricGrid, PageMetricItem, PageShell } from '../components/common/PageKit';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';

interface Broadcast {
  _id: string;
  title: string;
  content: string;
  type: string;
  urgency: string;
  creatorId: {
    name: string;
  };
  createdAt: string;
}

interface Stats {
  totalCases: number;
  pendingCases: number;
  processingCases: number;
  completedCases: number;
  failedCases: number;
  todayVisitors: number;
  aiUsageCount: number;
}

interface Case {
  _id: string;
  caseNumber: string;
  applicantId: {
    name: string;
  };
  respondentId: {
    name: string;
  };
  disputeType: string;
  status: string;
  createdAt: string;
}

interface Notification {
  overdueCases: {
    caseNumber: string;
    days: number;
    message: string;
    action: string;
  }[];
  todaySchedule: {
    time: string;
    title: string;
  }[];
  todayConsultations: {
    time: string;
    title: string;
    source: string;
  }[];
  systemNotifications: {
    title: string;
    message: string;
  }[];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalCases: 0,
    pendingCases: 0,
    processingCases: 0,
    completedCases: 0,
    failedCases: 0,
    todayVisitors: 0,
    aiUsageCount: 0
  });
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [notifications, setNotifications] = useState<Notification>({
    overdueCases: [],
    todaySchedule: [],
    todayConsultations: [],
    systemNotifications: []
  });
  const [latestBroadcasts, setLatestBroadcasts] = useState<Broadcast[]>([]);
  const [unreadBroadcastCount, setUnreadBroadcastCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { userInfo } = useAuthStore();
  const isWorkbenchRole = ['mediator', 'tenant_admin', 'superadmin'].includes(userInfo?.role || '');

  const metricCardBackground = (title: string) => {
    if (title.includes('待处理')) return 'linear-gradient(180deg, #fffaf0 0%, #ffffff 100%)';
    if (title.includes('调解中')) return 'linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%)';
    if (title.includes('今日咨询')) return 'linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)';
    if (title.includes('今日安排')) return 'linear-gradient(180deg, #f6ffed 0%, #ffffff 100%)';
    if (title.includes('超期')) return 'linear-gradient(180deg, #fff2f0 0%, #ffffff 100%)';
    return 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)';
  };

  const renderWorkbenchCard = (
    title: string,
    items: React.ReactNode[],
    emptyText: string
  ) => (
    <Card
      title={<span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>}
      style={{
        marginBottom: 16,
        borderRadius: 20,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
        border: '1px solid #eef2f7'
      }}
      size="small"
      bordered={false}
      bodyStyle={{ padding: 14 }}
    >
      {items.length > 0 ? items : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}
    </Card>
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard');
      setStats(response.data.stats);
      setPendingCases(response.data.pendingCases);
      setFilteredCases(response.data.pendingCases);
      if (response.data.notifications) {
        setNotifications(response.data.notifications);
      }
    } catch (error) {
      message.error('获取工作台数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取最新广播
  const fetchLatestBroadcasts = async () => {
    try {
      const response = await api.get('/broadcast/latest');
      setLatestBroadcasts(response.data.broadcasts);
      setUnreadBroadcastCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('获取最新广播失败:', error);
    }
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    if (value) {
      const filtered = pendingCases.filter(caseItem => {
        const searchValue = value.toLowerCase();
        return (
          (caseItem.caseNumber || '').toLowerCase().includes(searchValue) ||
          (caseItem.applicantId?.name || '').toLowerCase().includes(searchValue) ||
          (caseItem.respondentId?.name || '').toLowerCase().includes(searchValue) ||
          (caseItem.disputeType || '').toLowerCase().includes(searchValue)
        );
      });
      setFilteredCases(filtered);
    } else {
      setFilteredCases(pendingCases);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchLatestBroadcasts();
  }, []);

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      '已驳回': '失败'
    };
    return statusMap[status] || status;
  };

  const dashboardCards = useMemo(() => {
    if (isWorkbenchRole) {
      return [
        { title: '待处理案件', value: stats.pendingCases, suffix: '件', color: '#faad14', hint: '优先进入处理' },
        { title: '调解中案件', value: stats.processingCases, suffix: '件', color: '#1677ff', hint: '持续跟进' },
        { title: '今日咨询', value: notifications.todayConsultations.length, suffix: '项', color: '#722ed1', hint: '小程序与登记合并' },
        { title: '今日安排', value: notifications.todaySchedule.length, suffix: '项', color: '#52c41a', hint: '日程与会议' },
        { title: '超期提醒', value: notifications.overdueCases.length, suffix: '项', color: '#ff4d4f', hint: '需要立即关注' }
      ];
    }

    return [
      { title: '我的案件', value: stats.totalCases, suffix: '件', color: '#1677ff', hint: '累计提交' },
      { title: '待处理', value: stats.pendingCases, suffix: '件', color: '#faad14', hint: '等待受理' },
      { title: '处理中', value: stats.processingCases, suffix: '件', color: '#13c2c2', hint: '正在推进' },
      { title: '已完成', value: stats.completedCases, suffix: '件', color: '#52c41a', hint: '已办结' }
    ];
  }, [isWorkbenchRole, notifications.overdueCases.length, notifications.todayConsultations.length, notifications.todaySchedule.length, stats]);

  const pendingListSummaryText = useMemo(() => {
    const total = stats.pendingCases || 0;
    const shown = pendingCases.length;
    if (shown === 0) return '当前没有待处理案件';
    if (shown >= total) return `共 ${total} 件，当前已全部展示`;
    return `共 ${total} 件，当前展示最近 ${shown} 条`;
  }, [stats.pendingCases, pendingCases.length]);

  const hasOverdueCases = notifications.overdueCases.length > 0;
  const hasTodaySchedule = notifications.todaySchedule.length > 0;
  const hasTodayConsultations = notifications.todayConsultations.length > 0;
  const hasSystemNotifications = notifications.systemNotifications.length > 0;
  const hasLatestBroadcasts = latestBroadcasts.length > 0;
  const hasWorkbenchHighlights = hasOverdueCases || hasTodaySchedule || hasTodayConsultations;

  // 待办事项列
  const columns = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      render: (text: string, record: Case) => (
        <Link to={`/case/${record._id}`}>{text}</Link>
      )
    },
    {
      title: '申请人',
      dataIndex: ['applicantId', 'name'],
      key: 'applicant'
    },
    {
      title: '被申请人',
      dataIndex: ['respondentId', 'name'],
      key: 'respondent'
    },
    {
      title: '争议类型',
      dataIndex: 'disputeType',
      key: 'disputeType'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => getStatusText(value)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Case) => (
        <Link to={`/case/${record._id}`}>
          <Button type="link">查看</Button>
        </Link>
      )
    }
  ];

  return (
    <PageShell>
      <PageHero
        tone={isWorkbenchRole ? 'blue' : 'blue'}
        icon={<HomeOutlined />}
        title={isWorkbenchRole ? '今日工作台' : '我的服务首页'}
        description={isWorkbenchRole
          ? '把今天最需要优先处理的案件、安排、提醒和广播集中在一个入口里，减少来回切页。'
          : '先查看自己的案件进展，再按需进入申请调解或反馈入口。'}
        tags={
          <>
            <Tag color="blue-inverse" style={{ borderRadius: 999 }}>{isWorkbenchRole ? '待办优先' : '我的案件优先'}</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>{isWorkbenchRole ? '提醒与广播并行查看' : '业务入口更精简'}</Tag>
          </>
        }
        note={
          <Alert
            message={isWorkbenchRole ? '建议节奏' : '建议路径'}
            description={isWorkbenchRole ? '先处理待办，再查看超期提醒和今日安排；复杂检索进入案件查询。' : '先查看我的案件，再决定是否发起新申请或提交反馈。'}
            type="info"
            showIcon
          />
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
          gap: 16,
          marginBottom: 16
        }}
      >
        {dashboardCards.map((item) => (
          <div
            key={item.title}
            style={{
              borderRadius: 20,
              padding: '16px 18px',
              background: metricCardBackground(item.title),
              border: '1px solid #edf2f7',
              boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)',
              minHeight: 112,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 4,
                height: '100%',
                background: item.color
              }}
            />
            <Statistic
              title={item.title}
              value={item.value}
              suffix={item.suffix}
              valueStyle={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}
              titleStyle={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6, paddingLeft: 2 }}>{item.hint}</Text>
          </div>
        ))}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Card
            title="近期待办"
            extra={<Link to="/case-query">进入案件查询</Link>}
            style={{ marginBottom: 16, borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}
            bordered={false}
          >
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Text type="secondary">{pendingListSummaryText}。更多组合筛选请使用案件查询。</Text>
              <Input
                prefix={<SearchOutlined />}
                placeholder="仅搜索当前展示的近期待办..."
                style={{ width: '100%', maxWidth: 280 }}
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            <Table
              columns={[
                {
                  title: '案件编号',
                  dataIndex: 'caseNumber',
                  key: 'caseNumber',
                  render: (text: string, record: Case) => (
                    <Link to={`/case/${record._id}`}>{text}</Link>
                  ),
                  ellipsis: true
                },
                {
                  title: '申请人',
                  dataIndex: ['applicantId', 'name'],
                  key: 'applicant',
                  ellipsis: true
                },
                {
                  title: '类型',
                  dataIndex: 'disputeType',
                  key: 'disputeType',
                  ellipsis: true,
                  render: (value: string) => <Tag color={value === '咨询' ? 'geekblue' : 'blue'}>{value || '案件'}</Tag>
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (value: string) => {
                    const statusMap: Record<string, { text: string; color: string }> = {
                      pending: { text: '待处理', color: '#FAAD14' },
                      processing: { text: '调解中', color: '#1890FF' },
                      completed: { text: '已完成', color: '#52C41A' },
                      failed: { text: '失败', color: '#FF4D4F' },
                      '已驳回': { text: '失败', color: '#FF4D4F' }
                    };
                    const statusInfo = statusMap[value] || { text: value, color: '#888' };
                    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                  }
                },
                {
                  title: '登记时间',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (value: string) => new Date(value).toLocaleDateString(),
                  ellipsis: true
                },
                {
                  title: '处理',
                  key: 'action',
                  render: (_: any, record: Case) => (
                    <Link to={`/case/${record._id}`}>
                      <Button type="primary" size="small">进入</Button>
                    </Link>
                  )
                }
              ]}
              dataSource={filteredCases}
              rowKey="_id"
              pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
              loading={loading}
              scroll={{ x: 520 }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={isWorkbenchRole ? '当前没有待处理案件' : '当前没有案件记录'}
                  />
                )
              }}
            />
          </Card>

          {isWorkbenchRole && (
            <Card title="快捷入口" bordered={false} style={{ borderRadius: 18, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)' }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/case-query">
                    <Button type="primary" block>
                      案件查询
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/visitor-register">
                    <Button type="primary" block>
                      到访登记
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/broadcast">
                    <Button type="primary" block>
                      站内广播
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/data-analysis">
                    <Button type="primary" block>
                      数据分析
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {isWorkbenchRole && (
          <Col xs={24} md={8}>
            {hasWorkbenchHighlights ? (
              <>
                {hasOverdueCases && renderWorkbenchCard(
                  '即将超期案件',
                  notifications.overdueCases.map((caseItem, index) => (
                    <div key={index} style={{ padding: 14, backgroundColor: '#FFF1F0', borderRadius: 14, marginBottom: 10, border: '1px solid #ffd6d1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <ClockCircleOutlined style={{ color: '#FF4D4F', marginRight: 6, fontSize: 14 }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>案件 {caseItem.caseNumber}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.7 }}>{caseItem.message}</p>
                      <Button type="primary" size="small" style={{ marginTop: 10, borderRadius: 999 }} icon={<RightOutlined />}>{caseItem.action}</Button>
                    </div>
                  )),
                  '暂无即将超期案件'
                )}

                {hasTodaySchedule && renderWorkbenchCard(
                  '今日调解安排',
                  notifications.todaySchedule.map((schedule, index) => (
                    <div key={index} style={{ padding: 14, backgroundColor: '#F6FFED', borderRadius: 14, marginBottom: 10, border: '1px solid #d9f7be' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <CalendarOutlined style={{ color: '#52C41A', marginRight: 6, fontSize: 14 }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{schedule.time}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.7 }}>{schedule.title}</p>
                    </div>
                  )),
                  '今日无调解安排'
                )}

                {hasTodayConsultations && renderWorkbenchCard(
                  '今日咨询',
                  notifications.todayConsultations.map((item, index) => (
                    <div key={index} style={{ padding: 14, backgroundColor: '#F9F0FF', borderRadius: 14, marginBottom: 10, border: '1px solid #ead7ff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <BellOutlined style={{ color: '#722ED1', marginRight: 6, fontSize: 14 }} />
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{item.time}</span>
                        </div>
                        <Tag color="purple" style={{ marginInlineEnd: 0, borderRadius: 999 }}>{item.source}</Tag>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.7 }}>{item.title}</p>
                    </div>
                  )),
                  '今日无新增咨询'
                )}
              </>
            ) : (
              renderWorkbenchCard(
                '今日动态',
                [],
                '今日暂无超期提醒、调解安排和新增咨询'
              )
            )}

            {hasSystemNotifications && renderWorkbenchCard(
              '系统通知',
              notifications.systemNotifications.map((notification, index) => (
                <div key={index} style={{ padding: 14, backgroundColor: '#F0F5FF', borderRadius: 14, marginBottom: 10, border: '1px solid #d6e4ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <BellOutlined style={{ color: '#1890FF', marginRight: 6, fontSize: 14 }} />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{notification.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.7 }}>{notification.message}</p>
                </div>
              )),
              '暂无系统通知'
            )}

            {hasLatestBroadcasts && (
              <Card title={
                <span style={{ fontSize: 14 }}>
                  最新广播 {unreadBroadcastCount > 0 && <Badge count={unreadBroadcastCount} />}
                </span>
              } size="small" bordered={false} style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', border: '1px solid #eef2f7' }} bodyStyle={{ padding: 14 }}>
                {latestBroadcasts.map((broadcast, index) => {
                  const urgencyMap: Record<string, { text: string; color: string }> = {
                    normal: { text: '普通', color: '#1890FF' },
                    important: { text: '重要', color: '#FAAD14' },
                    emergency: { text: '紧急', color: '#FF4D4F' }
                  };
                  const urgencyInfo = urgencyMap[broadcast.urgency] || { text: broadcast.urgency, color: '#888' };
                  
                  const typeMap: Record<string, string> = {
                    handover: '工作交接',
                    special: '特别通知',
                    notice: '日常通知',
                    policy: '政策法规'
                  };
                  const typeText = typeMap[broadcast.type] || broadcast.type;
                  
                  return (
                    <div key={index} style={{ padding: 14, backgroundColor: '#F8FAFC', borderRadius: 14, marginBottom: 10, border: '1px solid #e5edf6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <BellOutlined style={{ color: urgencyInfo.color, marginRight: 6, fontSize: 14 }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{broadcast.title}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
                        {broadcast.creatorId.name} · {typeText} · {urgencyInfo.text}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.7 }}>{broadcast.content}</p>
                      <Link to={`/broadcast`}>
                        <Button type="link" size="small" style={{ marginTop: 8 }}>查看详情</Button>
                      </Link>
                    </div>
                  );
                })}
              </Card>
            )}
          </Col>
        )}
      </Row>
    </PageShell>
  );
};

export default Dashboard;
