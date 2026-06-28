import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, message, Tag, Space, Badge, Radio, Typography, Row, Col, Statistic, Avatar, Alert, Segmented } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, FilterOutlined, TableOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useDrag, useDrop } from 'react-dnd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import { ExportButton, PageHero, PageMetricGrid, PageMetricItem, PageSectionCard, PageShell, PageToolbar } from '../components/common/PageKit';
import { buildExportFileName, exportExcel, exportExcelWorkbook, type ExcelColumn, warnNoExportData } from '../utils/excel';

const { Title, Text } = Typography;

const { Option } = Select;
const { TextArea } = Input;

// Set up the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

interface Schedule {
  _id: string;
  caseId: string;
  date: string;
  title: string;
  description: string;
  category: string;
  createdBy: {
    name: string;
  };
  createdAt: string;
  caseNumber?: string;
}

interface DutyRosterItem {
  id: string;
  name: string;
  phone?: string;
  order: number;
  isCurrentDuty: boolean;
}

interface MediatorDutyInfo {
  tenantId: string;
  tenantName: string;
  allowAdminAsMediator: boolean;
  dutyRotationStartDate?: string | null;
  dutyOverrideUserId?: string | null;
  dutyOverrideDate?: string | null;
  currentDutyAssignee?: {
    id: string;
    name: string;
    role: string;
    phone?: string;
    source?: string;
  } | null;
  myDuty: {
    id: string;
    name: string;
    phone?: string;
    isInDutyRoster: boolean;
    isCurrentDuty: boolean;
    rosterOrder: number | null;
  };
  dutyRoster: DutyRosterItem[];
  dutyPreview?: Array<{
    date: string;
    isToday?: boolean;
    isOverride?: boolean;
    assignee?: {
      id: string;
      name: string;
      role: string;
      phone?: string;
      source?: string;
    } | null;
  }>;
}

const SCHEDULE_OVERVIEW_SUPPORT_KEY = 'schedule-overview-supported';

const getScheduleOverviewSupport = (): boolean | null => {
  const cached = window.localStorage.getItem(SCHEDULE_OVERVIEW_SUPPORT_KEY);
  if (cached === 'true') return true;
  if (cached === 'false') return false;
  return null;
};

const setScheduleOverviewSupport = (supported: boolean) => {
  window.localStorage.setItem(SCHEDULE_OVERVIEW_SUPPORT_KEY, String(supported));
};

// 可拖拽的事件组件
const DraggableEvent: React.FC<{
  event: any;
  onDragEnd: (event: any, newDate: any) => void;
  onClick: (event: any) => void;
}> = ({ event, onDragEnd, onClick }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'SCHEDULE',
    item: event,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      style={{
        padding: 6,
        margin: 4,
        backgroundColor: event.color || '#1890ff',
        color: 'white',
        borderRadius: 6,
        cursor: 'pointer',
        opacity: isDragging ? 0.5 : 1,
        fontSize: 12,
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease'
      }}
      onClick={() => onClick(event)}
    >
      {event.title}
    </div>
  );
};

// 可放置的日期单元格组件
const DroppableDateCell: React.FC<{
  date: any;
  children: React.ReactNode;
  onDrop: (item: any, date: any) => void;
  onEventClick: (event: any) => void;
  onAddSchedule: (date: any) => void;
}> = ({ date, children, onDrop, onEventClick, onAddSchedule }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'SCHEDULE',
    drop: (item) => onDrop(item, date),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      style={{
        padding: 24, // 增加顶部padding，避免与日期数字重叠
        paddingTop: 32, // 特别增加顶部padding
        backgroundColor: isOver ? '#e6f7ff' : 'transparent',
        minHeight: 120,
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <div style={{ flex: 1 }}>
        {children}
      </div>
      <button
        onClick={() => onAddSchedule(date)}
        style={{
          marginTop: 8,
          padding: '6px 4px',
          backgroundColor: '#f0f0f0',
          border: '1px dashed #d9d9d9',
          borderRadius: 4,
          fontSize: 12,
          color: '#1890ff',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.3s ease',
          width: '100%',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e6f7ff';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
      >
        + 添加
      </button>
    </div>
  );
};

const ScheduleManagement: React.FC = () => {
  const { userInfo } = useAuthStore();
  const isMediator = userInfo?.role === 'mediator';
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [form] = Form.useForm();
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [cases, setCases] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedSchedules, setSelectedSchedules] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [workspaceView, setWorkspaceView] = useState<'schedule' | 'duty'>('schedule');
  const [dutyInfo, setDutyInfo] = useState<MediatorDutyInfo | null>(null);
  const [dutyLoading, setDutyLoading] = useState(false);

  // 获取所有日程
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const casesResponse = await api.get('/case');
      const userCases = casesResponse.data.cases || [];
      setCases(userCases);
      let allSchedules: Schedule[] = [];
      const overviewSupported = getScheduleOverviewSupport();
      let shouldUseLegacyFallback = overviewSupported === false;

      if (overviewSupported !== false) {
        try {
          const schedulesResponse = await api.get('/case/schedules/overview');
          allSchedules = (schedulesResponse.data.schedules || []) as Schedule[];
          setScheduleOverviewSupport(true);
        } catch (overviewError: any) {
          const status = overviewError?.response?.status;

          if (status === 404) {
            setScheduleOverviewSupport(false);
            shouldUseLegacyFallback = true;
          } else {
            throw overviewError;
          }
        }
      }

      if (shouldUseLegacyFallback) {
        const scheduleResults = await Promise.allSettled(
          userCases.map(async (caseItem: any) => {
            const caseId = caseItem._id;
            const response = await api.get(`/case/${caseId}/schedule`);
            const caseSchedules = response.data.schedules || [];
            return caseSchedules.map((schedule: any) => ({
              ...schedule,
              caseNumber: schedule.caseNumber || caseItem.caseNumber
            }));
          })
        );

        allSchedules = scheduleResults.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : []
        ) as Schedule[];
      }

      // 按日期排序
      allSchedules.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setSchedules(allSchedules);
    } catch (error) {
      message.error('获取日程列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchMediatorDuty = async () => {
    if (!isMediator) return;
    setDutyLoading(true);
    try {
      const response = await api.get('/tenant/my-duty');
      setDutyInfo(response.data);
    } catch (_error) {
      message.error('获取我的值班信息失败');
    } finally {
      setDutyLoading(false);
    }
  };

  useEffect(() => {
    if (isMediator) {
      fetchMediatorDuty();
    }
  }, [isMediator]);

  // 打开添加/编辑模态框
  const openModal = (schedule?: Schedule, date?: any) => {
    if (schedule) {
      setEditingSchedule(schedule);
      form.setFieldsValue({
        caseId: schedule.caseId,
        date: dayjs(schedule.date),
        title: schedule.title,
        description: schedule.description,
        category: schedule.category
      });
    } else {
      setEditingSchedule(null);
      form.resetFields();
      if (date) {
        form.setFieldsValue({
          date: dayjs(date)
        });
      }
    }
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 转换日期格式为ISO字符串
      const submitValues = {
        ...values,
        date: values.date.toISOString()
      };
      
      if (editingSchedule) {
        // 更新日程
        await api.put(`/case/${values.caseId}/schedule/${editingSchedule._id}`, submitValues);
        message.success('日程更新成功');
      } else {
        // 添加日程
        await api.post(`/case/${values.caseId}/schedule`, submitValues);
        message.success('日程添加成功');
      }
      setModalVisible(false);
      fetchSchedules();
    } catch (error) {
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 删除日程
  const handleDelete = async (schedule: Schedule) => {
    try {
      await api.delete(`/case/${schedule.caseId}/schedule/${schedule._id}`);
      message.success('日程删除成功');
      fetchSchedules();
    } catch (error) {
      message.error('删除失败，请重试');
    }
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: any, newDate: any) => {
    try {
      // 找到对应的日程
      const schedule = schedules.find(s => s._id === event.id);
      if (schedule) {
        // 更新日程日期
        const dateObj = dayjs(newDate);
        await api.put(`/case/${schedule.caseId}/schedule/${schedule._id}`, {
          ...schedule,
          date: dateObj.toISOString()
        });
        message.success('日程拖拽更新成功');
        fetchSchedules();
      }
    } catch (error) {
      message.error('拖拽更新失败，请重试');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    try {
      // 对每个选中的日程进行删除
      for (const scheduleId of selectedSchedules) {
        const schedule = schedules.find(s => s._id === scheduleId);
        if (schedule) {
          await api.delete(`/case/${schedule.caseId}/schedule/${scheduleId}`);
        }
      }
      message.success('批量删除成功');
      setSelectedSchedules([]);
      fetchSchedules();
    } catch (error) {
      message.error('批量删除失败，请重试');
    }
  };

  // 批量编辑
  const handleBatchEdit = () => {
    // 这里可以实现批量编辑功能
    // 例如打开一个模态框，让用户选择要批量修改的字段
    message.info('批量编辑功能开发中');
  };

  // 过滤日程
  const filteredSchedules = categoryFilter
    ? schedules.filter(schedule => schedule.category === categoryFilter)
    : schedules;

  const scheduleStats = useMemo(() => ({
    total: filteredSchedules.length,
    meetings: filteredSchedules.filter((item) => item.category === '调解会议').length,
    submissions: filteredSchedules.filter((item) => item.category === '证据提交').length,
    selected: selectedSchedules.length
  }), [filteredSchedules, selectedSchedules]);

  const dutyStats = useMemo(() => ({
    rosterCount: dutyInfo?.dutyRoster.length || 0,
    currentDuty: dutyInfo?.currentDutyAssignee?.name || '未安排',
    myOrder: dutyInfo?.myDuty.rosterOrder || 0,
    isCurrentDuty: dutyInfo?.myDuty.isCurrentDuty ? '是' : '否'
  }), [dutyInfo]);

  const dutyRotation = useMemo(() => {
    const preview = dutyInfo?.dutyPreview || [];
    return preview.map((item) => ({
      date: dayjs(item.date),
      assignee: item.assignee || null,
      isOverride: Boolean(item.isOverride)
    })).filter((item) => item.assignee);
  }, [dutyInfo]);

  const weeklyDuty = useMemo(() => dutyRotation.slice(0, 7), [dutyRotation]);

  const myNextDuty = useMemo(() => {
    if (!dutyInfo?.myDuty.id) return null;
    return dutyRotation.find((item) => item.assignee?.id === dutyInfo.myDuty.id) || null;
  }, [dutyInfo, dutyRotation]);

  const myMonthlyDuty = useMemo(
    () => dutyRotation.filter((item) => item.assignee?.id === dutyInfo?.myDuty.id),
    [dutyRotation, dutyInfo]
  );

  // 根据分类获取颜色
  const getCategoryColor = (category: string) => {
    switch (category) {
      case '调解会议':
        return '#1890ff';
      case '证据提交':
        return '#52c41a';
      case '案件讨论':
        return '#fa8c16';
      default:
        return '#8c8c8c';
    }
  };

  // 列定义
  const columns = [
    {
      title: '案件编号',
      dataIndex: 'caseNumber',
      key: 'caseNumber',
      render: (text: string, record: Schedule) =>
        record.caseId ? <Link to={`/case/${record.caseId}`}>{text}</Link> : text
    },
    {
      title: '日程标题',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => new Date(text).toLocaleString()
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => {
        let color = '';
        switch (text) {
          case '调解会议':
            color = 'blue';
            break;
          case '证据提交':
            color = 'green';
            break;
          case '案件讨论':
            color = 'orange';
            break;
          default:
            color = 'gray';
        }
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: '调解会议', value: '调解会议' },
        { text: '证据提交', value: '证据提交' },
        { text: '案件讨论', value: '案件讨论' },
        { text: '其他', value: '其他' }
      ],
      onFilter: (value: any, record: Schedule) => record.category === value
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (createdBy: { name: string } | null | undefined) => createdBy?.name || '未知'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Schedule) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const scheduleExportColumns: ExcelColumn<Schedule>[] = [
    { header: '案件编号', key: 'caseNumber', formatter: (row) => row.caseNumber || '' },
    { header: '日程标题', key: 'title' },
    { header: '日期', key: 'date', formatter: (row) => new Date(row.date).toLocaleString() },
    { header: '分类', key: 'category' },
    { header: '说明', key: 'description', formatter: (row) => row.description || '' },
    { header: '创建人', key: 'createdBy', formatter: (row) => row.createdBy?.name || '未知' },
    { header: '创建时间', key: 'createdAt', formatter: (row) => new Date(row.createdAt).toLocaleString() }
  ];

  const handleExport = () => {
    if (workspaceView === 'schedule') {
      if (filteredSchedules.length === 0) {
        warnNoExportData('当前没有可导出的日程数据');
        return;
      }
      exportExcel(buildExportFileName('日程管理'), scheduleExportColumns, filteredSchedules);
      message.success(`已导出 ${filteredSchedules.length} 条日程记录`);
      return;
    }

    if (!dutyInfo) {
      warnNoExportData('当前没有可导出的值班数据');
      return;
    }

    exportExcelWorkbook(buildExportFileName('我的值班'), [
      {
        name: '值班名单',
        columns: [
          { header: '顺位', key: 'order' },
          { header: '姓名', key: 'name' },
          { header: '电话', key: 'phone' },
          { header: '当前值班', key: 'isCurrentDuty', formatter: (row: DutyRosterItem) => row.isCurrentDuty ? '是' : '否' }
        ],
        rows: dutyInfo.dutyRoster
      },
      {
        name: '未来预览',
        columns: [
          { header: '日期', key: 'date' },
          { header: '值班人', key: 'assignee', formatter: (row: any) => row.assignee?.name || '' },
          { header: '电话', key: 'assigneePhone', formatter: (row: any) => row.assignee?.phone || '' },
          { header: '是否代理', key: 'isOverride', formatter: (row: any) => row.isOverride ? '是' : '否' }
        ],
        rows: dutyInfo.dutyPreview || []
      }
    ]);
    message.success('已导出值班安排');
  };

  return (
    <PageShell>
      <PageHero
        tone="teal"
        icon={<CalendarOutlined />}
        title="日程工作台"
        description="集中管理调解会议、证据提交和案件讨论安排。表格适合批量处理，日历视图适合观察时间分布。"
        tags={
          <>
            <Tag color="cyan-inverse" style={{ borderRadius: 999 }}>表格与日历双视图</Tag>
            <Tag color="geekblue-inverse" style={{ borderRadius: 999 }}>支持批量操作</Tag>
          </>
        }
        note={
          <Alert
            message="安排建议"
            description="先按分类筛选，再切换表格或日历；需要集中调整时优先在表格里勾选批量操作。"
            type="info"
            showIcon
          />
        }
      />

      <PageMetricGrid>
        {workspaceView === 'schedule' ? (
          <>
            <PageMetricItem><Statistic title="当前日程" value={scheduleStats.total} suffix="项" /></PageMetricItem>
            <PageMetricItem><Statistic title="调解会议" value={scheduleStats.meetings} suffix="项" /></PageMetricItem>
            <PageMetricItem><Statistic title="证据提交" value={scheduleStats.submissions} suffix="项" /></PageMetricItem>
            <PageMetricItem><Statistic title="已选中" value={scheduleStats.selected} suffix="项" prefix={<ClockCircleOutlined />} /></PageMetricItem>
          </>
        ) : (
          <>
            <PageMetricItem><Statistic title="值班名单" value={dutyStats.rosterCount} suffix="人" /></PageMetricItem>
            <PageMetricItem><Statistic title="当前值班" value={dutyStats.currentDuty} /></PageMetricItem>
            <PageMetricItem><Statistic title="我的顺位" value={dutyStats.myOrder} suffix={dutyStats.myOrder ? '位' : ''} /></PageMetricItem>
            <PageMetricItem><Statistic title="今日是否值班" value={dutyStats.isCurrentDuty} prefix={<ClockCircleOutlined />} /></PageMetricItem>
          </>
        )}
      </PageMetricGrid>

      <PageToolbar>
        <Row gutter={[16, 16]} align="bottom">
          {isMediator && (
            <Col xs={24} sm={12} lg={6}>
              <Text type="secondary">工作视图</Text>
              <div style={{ marginTop: 8 }}>
                <Segmented
                  value={workspaceView}
                  onChange={(value) => setWorkspaceView(value as 'schedule' | 'duty')}
                  options={[
                    { label: '我的日程', value: 'schedule' },
                    { label: '我的值班', value: 'duty' }
                  ]}
                />
              </div>
            </Col>
          )}
          {workspaceView === 'schedule' && (
            <>
              <Col xs={24} sm={12} lg={7}>
                <Text type="secondary">分类筛选</Text>
                <Select
                  placeholder="按分类筛选"
                  style={{ width: '100%', marginTop: 8 }}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  allowClear
                >
                  <Option value="调解会议">调解会议</Option>
                  <Option value="证据提交">证据提交</Option>
                  <Option value="案件讨论">案件讨论</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} lg={5}>
                <Text type="secondary">视图切换</Text>
                <div style={{ marginTop: 8 }}>
                  <Segmented
                    value={viewMode}
                    onChange={(value) => setViewMode(value as 'table' | 'calendar')}
                    options={[
                      { label: '表格视图', value: 'table' },
                      { label: '日历视图', value: 'calendar' }
                    ]}
                  />
                </div>
              </Col>
            </>
          )}
          <Col
            xs={24}
            sm={12}
            lg={workspaceView === 'schedule' ? (isMediator ? 6 : 8) : (isMediator ? 18 : 8)}
          >
            <Space
              wrap
              size={10}
              style={{ width: '100%', justifyContent: 'flex-end' }}
            >
              {workspaceView === 'schedule' ? (
                <>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    添加日程
                  </Button>
                  <ExportButton onClick={handleExport} />
                  {selectedSchedules.length > 0 && (
                    <>
                      <Button onClick={() => handleBatchEdit()}>
                        批量编辑
                      </Button>
                      <Button danger onClick={() => handleBatchDelete()}>
                        批量删除
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <ExportButton onClick={handleExport} />
                  <Button onClick={fetchMediatorDuty} loading={dutyLoading}>
                    刷新值班
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>
      </PageToolbar>

      <PageSectionCard bodyClassName="">
        {workspaceView === 'duty' && isMediator ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <Alert
              type={dutyInfo?.myDuty.isCurrentDuty ? 'success' : 'info'}
              showIcon
              message={dutyInfo?.myDuty.isCurrentDuty ? '你当前处于值班中' : '你当前不在值班中'}
              description={
                dutyInfo
                  ? `所属街道：${dutyInfo.tenantName}。${dutyInfo.currentDutyAssignee ? `当前接收人：${dutyInfo.currentDutyAssignee.name}${dutyInfo.currentDutyAssignee.phone ? `（${dutyInfo.currentDutyAssignee.phone}）` : ''}。` : '当前暂无值班接收人。'}`
                  : '正在读取你的值班安排。'
              }
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <PageSectionCard title="我的值班状态">
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ padding: 16, borderRadius: 14, background: '#f8fbff' }}>
                      <Text type="secondary">是否在值班名单</Text>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
                        {dutyInfo?.myDuty.isInDutyRoster ? '在名单中' : '未加入名单'}
                      </div>
                    </div>
                    <div style={{ padding: 16, borderRadius: 14, background: '#fff9e8' }}>
                      <Text type="secondary">我的值班顺位</Text>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
                        {dutyInfo?.myDuty.rosterOrder ? `第 ${dutyInfo.myDuty.rosterOrder} 位` : '未设置'}
                      </div>
                    </div>
                    <div style={{ padding: 16, borderRadius: 14, background: '#f6ffed' }}>
                      <Text type="secondary">管理员临时接管</Text>
                      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
                        {dutyInfo?.allowAdminAsMediator ? '已开启' : '未开启'}
                      </div>
                    </div>
                  </div>
                </PageSectionCard>
              </Col>
              <Col xs={24} md={14}>
                <PageSectionCard title="本街道值班名单">
                  <div style={{ display: 'grid', gap: 12 }}>
                    {(dutyInfo?.dutyRoster || []).length === 0 ? (
                      <Alert type="warning" showIcon message="当前街道尚未配置值班名单" />
                    ) : (
                      dutyInfo?.dutyRoster.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: 14,
                            borderRadius: 14,
                            border: `1px solid ${item.isCurrentDuty ? '#91caff' : '#edf2f7'}`,
                            background: item.isCurrentDuty ? '#f0f7ff' : '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{item.order}. {item.name}</div>
                              <Text type="secondary">{item.phone || '未留联系电话'}</Text>
                            </div>
                            <Space wrap>
                              {item.id === dutyInfo?.myDuty.id && <Tag color="purple">我</Tag>}
                              {item.isCurrentDuty && <Tag color="blue">当前值班</Tag>}
                            </Space>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </PageSectionCard>
              </Col>
              <Col xs={24} md={12}>
                <PageSectionCard title="本周轮值">
                  <div style={{ display: 'grid', gap: 10 }}>
                    {weeklyDuty.length === 0 ? (
                      <Text type="secondary">当前无法生成轮值视图</Text>
                    ) : weeklyDuty.map((item) => (
                      <div
                        key={item.date.format('YYYY-MM-DD')}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${item.assignee?.id === dutyInfo?.myDuty.id ? '#d3adf7' : '#edf2f7'}`,
                          background: item.assignee?.id === dutyInfo?.myDuty.id ? '#faf5ff' : '#fff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{item.date.format('MM月DD日 dddd')}</div>
                            <Text type="secondary">{item.assignee?.name || '未安排'}</Text>
                          </div>
                          <Space wrap>
                            {item.date.isSame(dayjs(), 'day') && <Tag color="blue">今天</Tag>}
                            {item.assignee?.id === dutyInfo?.myDuty.id && <Tag color="purple">我值班</Tag>}
                            {item.isOverride && <Tag color="gold">代理</Tag>}
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                </PageSectionCard>
              </Col>
              <Col xs={24} md={12}>
                <PageSectionCard title="值班提醒">
                  <div style={{ display: 'grid', gap: 12 }}>
                    <Alert
                      type={dutyInfo?.myDuty.isCurrentDuty ? 'success' : 'info'}
                      showIcon
                      message={
                        dutyInfo?.myDuty.isCurrentDuty
                          ? '今天由你负责值班接收'
                          : myNextDuty
                            ? `你的下一次值班：${myNextDuty.date.format('MM月DD日')}`
                            : '当前未排到你的值班轮次'
                      }
                      description={
                        dutyInfo?.myDuty.isCurrentDuty
                          ? '建议优先关注新申请、咨询与待分配事项，保持电话与站内消息畅通。'
                          : myNextDuty
                            ? `距离下一次值班还有 ${myNextDuty.date.startOf('day').diff(dayjs().startOf('day'), 'day')} 天，可提前预留处理时间。`
                            : '如需加入值班，请联系街道管理员将你加入值班名单。'
                      }
                    />
                    <div style={{ padding: 14, borderRadius: 14, background: '#fff9e8' }}>
                      <Text type="secondary">未来 30 天我的值班次数</Text>
                      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 700 }}>{myMonthlyDuty.length} 次</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {myMonthlyDuty.length === 0 ? (
                        <Text type="secondary">未来 30 天暂无你的轮值日期</Text>
                      ) : myMonthlyDuty.slice(0, 8).map((item) => (
                        <Tag key={item.date.format('YYYY-MM-DD')} color="purple">
                          {item.date.format('MM-DD')}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </PageSectionCard>
              </Col>
            </Row>
          </div>
        ) : viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={filteredSchedules}
            rowKey="_id"
            loading={loading}
            pagination={{ 
              pageSize: 10,
              responsive: true
            }}
            scroll={{ 
              x: 'max-content'
            }}
            rowSelection={{
              selectedRowKeys: selectedSchedules,
              onChange: (selectedKeys) => setSelectedSchedules(selectedKeys as string[]),
            }}
            className="responsive-table"
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: 600,
            maxHeight: 800,
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f5f5f5', 
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <h3 style={{ margin: 0, fontSize: 16, flexShrink: 0 }}>日历视图</h3>
              <Radio.Group
                value={calendarView}
                onChange={(e) => setCalendarView(e.target.value)}
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="month">月</Radio.Button>
                <Radio.Button value="week">周</Radio.Button>
                <Radio.Button value="day">日</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Calendar
                localizer={localizer}
                events={filteredSchedules.map(schedule => ({
                  id: schedule._id,
                  title: `${schedule.title} (${schedule.caseNumber || ''})`,
                  start: new Date(schedule.date),
                  end: new Date(new Date(schedule.date).getTime() + 60 * 60 * 1000), // 1 hour duration
                  allDay: false,
                  caseId: schedule.caseId,
                  category: schedule.category,
                  description: schedule.description
                }))}
                startAccessor="start"
                endAccessor="end"
                view={calendarView}
                onView={setCalendarView}
                selectable={true}
                onSelectEvent={(event) => {
                  // Find the original schedule
                  const schedule = schedules.find(s => s._id === event.id);
                  if (schedule) {
                    openModal(schedule);
                  }
                }}
                onSelectSlot={(slotInfo) => {
                  const selected = dayjs(slotInfo.start);
                  const today = dayjs();
                  const isExpired = selected.isBefore(today, 'day');
                  
                  if (!isExpired) {
                    setSelectedDate(selected);
                    openModal(null, selected.toDate());
                  }
                }}
                style={{
                  height: '100%',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}
                dayPropGetter={(date) => {
                  const today = dayjs();
                  const currentDate = dayjs(date);
                  const isExpired = currentDate.isBefore(today, 'day');
                  const isToday = currentDate.isSame(today, 'day');
                  
                  if (isExpired) {
                    return {
                      style: {
                        backgroundColor: '#f5f5f5',
                        cursor: 'not-allowed'
                      }
                    };
                  }
                  if (isToday) {
                    return {
                      style: {
                        backgroundColor: '#e6f7ff'
                      }
                    };
                  }
                  return {};
                }}
                eventPropGetter={(event) => {
                  const backgroundColor = getCategoryColor(event.category);
                  return {
                    style: {
                      backgroundColor,
                      color: 'white',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '12px',
                      padding: '2px 4px'
                    }
                  };
                }}
                components={{
                  event: ({ event, style, onClick }) => (
                    <div
                      style={{
                        ...style,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                      onClick={onClick}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
                      }}
                      title={`${event.title}\n${event.description || ''}`}
                    >
                      {event.title}
                    </div>
                  )
                }}
              />
            </div>
          </div>
        )}
      </PageSectionCard>

      <Modal
        title={editingSchedule ? '编辑日程' : '添加日程'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="caseId"
            label="案件"
            rules={[{ required: true, message: '请选择案件' }]}
          >
            <Select placeholder="请选择案件">
              {cases.map(caseItem => (
                <Option key={caseItem._id} value={caseItem._id}>
                  {caseItem.caseNumber} - {caseItem.applicantId?.name || '未知申请人'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="date"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              showTime
              format="YYYY-MM-DD HH:mm:ss"
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入日程标题" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              <Option value="调解会议">调解会议</Option>
              <Option value="证据提交">证据提交</Option>
              <Option value="案件讨论">案件讨论</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={4} placeholder="请输入日程描述" />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <Button
              onClick={() => setModalVisible(false)}
            >
              取消
            </Button>
            {editingSchedule && (
              <Button
                danger
                onClick={() => {
                  handleDelete(editingSchedule);
                  setModalVisible(false);
                }}
              >
                删除
              </Button>
            )}
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
            >
              {editingSchedule ? '更新' : '添加'}
            </Button>
          </div>
        </Form>
      </Modal>
    </PageShell>
  );
};

export default ScheduleManagement;
