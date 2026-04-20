import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, message, Badge, Input, Tag, Typography } from 'antd';
import { ClockCircleOutlined, CalendarOutlined, BellOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, HomeOutlined } from '@ant-design/icons';

const { Title } = Typography;
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { Link } from 'react-router-dom';

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
  emailCount: number;
  smsCount: number;
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
    emailCount: 0,
    smsCount: 0,
    aiUsageCount: 0
  });
  const [pendingCases, setPendingCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [notifications, setNotifications] = useState<Notification>({
    overdueCases: [],
    todaySchedule: [],
    systemNotifications: []
  });
  const [latestBroadcasts, setLatestBroadcasts] = useState<Broadcast[]>([]);
  const [unreadBroadcastCount, setUnreadBroadcastCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { userInfo } = useAuthStore();

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

  // 案件状态数据
  const caseStatusData = [
    { name: '待处理', value: stats.pendingCases, color: '#FFA500' },
    { name: '处理中', value: stats.processingCases, color: '#1890FF' },
    { name: '已完成', value: stats.completedCases, color: '#52C41A' },
    { name: '失败', value: stats.failedCases, color: '#FF4D4F' }
  ];

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
    <div style={{ backgroundColor: 'white', padding: 16, borderRadius: 8 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <HomeOutlined style={{ fontSize: 20, color: '#1890ff' }} />
        <Title level={2} style={{ margin: 0, fontSize: '18px' }}>工作台</Title>
      </div>
      <p style={{ fontSize: '14px', marginBottom: 24 }}>欢迎使用劳动仲裁调解系统</p>

      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card style={{ borderTop: '3px solid #1890FF' }}>
            <Statistic 
              title="总案数" 
              value={stats.totalCases} 
              suffix="个"
              prefix={<Badge count="本月新增" style={{ backgroundColor: '#1890FF' }} />}
              valueStyle={{ fontSize: '16px' }}
              titleStyle={{ fontSize: '12px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card style={{ borderTop: '3px solid #52C41A' }}>
            <Statistic 
              title="调解成功" 
              value={stats.completedCases} 
              suffix="个"
              prefix={<Badge count={`成功率${Math.round((stats.completedCases / (stats.totalCases || 1)) * 100)}%`} style={{ backgroundColor: '#52C41A' }} />}
              valueStyle={{ fontSize: '16px' }}
              titleStyle={{ fontSize: '12px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card style={{ borderTop: '3px solid #FF4D4F' }}>
            <Statistic 
              title="调解中" 
              value={stats.processingCases} 
              suffix="个"
              prefix={<Badge count={`需处理${stats.processingCases}件`} style={{ backgroundColor: '#FF4D4F' }} />}
              valueStyle={{ fontSize: '16px' }}
              titleStyle={{ fontSize: '12px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6} lg={6} xl={6}>
          <Card style={{ borderTop: '3px solid #FAAD14' }}>
            <Statistic 
              title="调解失败" 
              value={stats.failedCases} 
              suffix="个"
              prefix={<Badge count={`失败率${Math.round((stats.failedCases / (stats.totalCases || 1)) * 100)}%`} style={{ backgroundColor: '#FAAD14' }} />}
              valueStyle={{ fontSize: '16px' }}
              titleStyle={{ fontSize: '12px' }}
            />
          </Card>
        </Col>
        {/* 邮件、短信、AI使用量统计 - 只对调解员和管理员显示 */}
        {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
          <>
            <Col xs={12} sm={12} md={6} lg={6} xl={6}>
              <Card style={{ borderTop: '3px solid #722ED1' }}>
                <Statistic 
                  title="邮件发送" 
                  value={stats.emailCount} 
                  suffix="封"
                  valueStyle={{ fontSize: '16px' }}
                  titleStyle={{ fontSize: '12px' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6} lg={6} xl={6}>
              <Card style={{ borderTop: '3px solid #13C2C2' }}>
                <Statistic 
                  title="短信发送" 
                  value={stats.smsCount} 
                  suffix="条"
                  valueStyle={{ fontSize: '16px' }}
                  titleStyle={{ fontSize: '12px' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6} lg={6} xl={6}>
              <Card style={{ borderTop: '3px solid #FA541C' }}>
                <Statistic 
                  title="AI使用量" 
                  value={stats.aiUsageCount} 
                  suffix="token"
                  valueStyle={{ fontSize: '16px' }}
                  titleStyle={{ fontSize: '12px' }}
                />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* 主要内容和右侧通知 */}
      <Row gutter={[16, 16]}>
        {/* 左侧主要内容 */}
        <Col xs={24} md={16}>
          {/* 待办案件 */}
          <Card title="我的待办案件" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <Input 
                placeholder="搜索案件..." 
                style={{ width: '100%', maxWidth: 300 }} 
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                size="small"
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
                  title: '被申请人',
                  dataIndex: ['respondentId', 'name'],
                  key: 'respondent',
                  ellipsis: true
                },
                {
                  title: '申请日期',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (value: string) => new Date(value).toLocaleDateString(),
                  ellipsis: true
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
                  title: '操作',
                  key: 'action',
                  render: (_: any, record: Case) => (
                    <Button type="primary" size="small">处理</Button>
                  )
                }
              ]}
              dataSource={filteredCases}
              rowKey="_id"
              pagination={{ pageSize: 5, size: 'small' }}
              loading={loading}
              scroll={{ x: 600 }}
              size="small"
            />
          </Card>

          {/* 快捷操作 - 只对调解员和管理员显示 */}
          {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
            <Card title="快捷操作">
              <Row gutter={[12, 12]}>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/case-query">
                    <Button type="primary" block size="small">
                      案件查询
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/visitor-register">
                    <Button type="primary" block size="small">
                      到访登记
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/broadcast">
                    <Button type="primary" block size="small">
                      站内广播
                    </Button>
                  </Link>
                </Col>
                <Col xs={12} sm={12} md={6} lg={6} xl={6}>
                  <Link to="/data-analysis">
                    <Button type="primary" block size="small">
                      数据分析
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {/* 右侧通知区域 - 只对调解员和管理员显示 */}
        {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
          <Col xs={24} md={8}>
            {/* 即将超期案件 */}
            <Card title="即将超期案件" style={{ marginBottom: 16 }} size="small">
              {notifications.overdueCases.length > 0 ? (
                notifications.overdueCases.map((caseItem, index) => (
                  <div key={index} style={{ padding: 12, backgroundColor: '#FFF1F0', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <ClockCircleOutlined style={{ color: '#FF4D4F', marginRight: 6, fontSize: 14 }} />
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>案件 {caseItem.caseNumber}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{caseItem.message}</p>
                    <Button type="primary" size="small" style={{ marginTop: 8 }}>{caseItem.action}</Button>
                  </div>
                ))
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 14 }}>
                  暂无即将超期案件
                </div>
              )}
            </Card>

            {/* 今日调解安排 */}
            <Card title="今日调解安排" style={{ marginBottom: 16 }} size="small">
              {notifications.todaySchedule.length > 0 ? (
                notifications.todaySchedule.map((schedule, index) => (
                  <div key={index} style={{ padding: 12, backgroundColor: '#F6FFED', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <CalendarOutlined style={{ color: '#52C41A', marginRight: 6, fontSize: 14 }} />
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>{schedule.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{schedule.title}</p>
                  </div>
                ))
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 14 }}>
                  今日无调解安排
                </div>
              )}
            </Card>

            {/* 系统通知 */}
            <Card title="系统通知" style={{ marginBottom: 16 }} size="small">
              {notifications.systemNotifications.length > 0 ? (
                notifications.systemNotifications.map((notification, index) => (
                  <div key={index} style={{ padding: 12, backgroundColor: '#F0F5FF', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <BellOutlined style={{ color: '#1890FF', marginRight: 6, fontSize: 14 }} />
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>{notification.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{notification.message}</p>
                  </div>
                ))
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 14 }}>
                  暂无系统通知
                </div>
              )}
            </Card>

            {/* 最新广播 */}
            <Card title={
              <span style={{ fontSize: 14 }}>
                最新广播 {unreadBroadcastCount > 0 && <Badge count={unreadBroadcastCount} />}
              </span>
            } size="small">
              {latestBroadcasts.length > 0 ? (
                latestBroadcasts.map((broadcast, index) => {
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
                    <div key={index} style={{ padding: 12, backgroundColor: '#F6FFED', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                        <BellOutlined style={{ color: urgencyInfo.color, marginRight: 6, fontSize: 14 }} />
                        <span style={{ fontWeight: 'bold', fontSize: 14 }}>{broadcast.title}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>
                        {broadcast.creatorId.name} · {typeText} · {urgencyInfo.text}
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{broadcast.content}</p>
                      <Link to={`/broadcast`}>
                        <Button type="link" size="small" style={{ marginTop: 8 }}>查看详情</Button>
                      </Link>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: 12, textAlign: 'center', color: '#666', fontSize: 14 }}>
                  暂无广播消息
                </div>
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Dashboard;
