import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, Select, message, Tag, Space, Badge, Radio, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, FilterOutlined, TableOutlined } from '@ant-design/icons';
import { useDrag, useDrop } from 'react-dnd';
import dayjs from 'dayjs';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const { Title } = Typography;

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

  // 获取所有日程
  const fetchSchedules = async () => {
    setLoading(true);
    try {
      // 先获取用户相关的案件
      const casesResponse = await api.get('/case');
      const userCases = casesResponse.data.cases;
      setCases(userCases);

      // 对每个案件获取日程
      const allSchedules: Schedule[] = [];
      for (const caseItem of userCases) {
        const caseId = caseItem._id;
        try {
          const response = await api.get(`/case/${caseId}/schedule`);
          const caseSchedules = response.data.schedules || [];
          // 为每个日程添加案件编号
          const schedulesWithCaseNumber = caseSchedules.map((schedule: any) => ({
            ...schedule,
            caseNumber: caseItem.caseNumber
          }));
          allSchedules.push(...schedulesWithCaseNumber);
        } catch (error) {
          console.error(`获取案件 ${caseId} 的日程失败:`, error);
        }
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
      render: (text: string) => <a href={`/case/${text}`}>{text}</a>
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

  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      <div style={{ 
            marginBottom: 24, 
            display: 'flex', 
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <CalendarOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Title level={2} style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap' }}>日程管理</Title>
            </div>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 12, 
              alignItems: 'center',
              justifyContent: 'flex-start'
            }}>
              <Select
                placeholder="按分类筛选"
                style={{ width: 120, flexShrink: 0 }}
                value={categoryFilter}
                onChange={setCategoryFilter}
                allowClear
              >
                <Option value="调解会议">调解会议</Option>
                <Option value="证据提交">证据提交</Option>
                <Option value="案件讨论">案件讨论</Option>
                <Option value="其他">其他</Option>
              </Select>
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="table" icon={<TableOutlined />}>表格视图</Radio.Button>
                <Radio.Button value="calendar" icon={<CalendarOutlined />}>日历视图</Radio.Button>
              </Radio.Group>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openModal()}
              >
                添加日程
              </Button>
              {selectedSchedules.length > 0 && (
                <Space style={{ flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    onClick={() => handleBatchEdit()}
                  >
                    批量编辑
                  </Button>
                  <Button
                    danger
                    onClick={() => handleBatchDelete()}
                  >
                    批量删除
                  </Button>
                </Space>
              )}
            </div>
          </div>

      <Card>
        {viewMode === 'table' ? (
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
      </Card>

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
    </div>
  );
};

export default ScheduleManagement;