import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Descriptions, Timeline, Select, Button, Input, message, Modal, Progress, Tag, Badge, Typography, Checkbox, List, Upload } from 'antd';

// 获取API基础URL
const getApiBaseUrl = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    return import.meta.env.PROD ? '/laodongzhongcai/api' : 'http://localhost:5003/api';
  }
  return baseUrl;
};

const { Text } = Typography;
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, UserOutlined, PhoneOutlined, DollarOutlined, CalendarOutlined, MessageOutlined, UploadOutlined, VideoCameraOutlined, EditOutlined } from '@ant-design/icons';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import FileUpload from '../components/business/FileUpload';

const { Option } = Select;
const { TextArea } = Input;

interface Case {
  _id: string;
  caseNumber: string;
  applicantId: {
    name: string;
    phone: string;
  };
  respondentId: {
    name: string;
    phone: string;
  };
  disputeType: string;
  caseAmount: number;
  requestItems: string;
  factsReasons: string;
  status: string;
  mediatorId: {
    name: string;
  };
  createdAt: string;
  closeTime: string;
}

interface Progress {
  _id: string;
  content: string;
  type: string; // 进度类型：register, accept, mediate, close
  creatorId: {
    name: string;
  };
  createdAt: string;
}

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { userInfo } = useAuthStore();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [evidence, setEvidence] = useState<any[]>([]);
  const [mediatorModalVisible, setMediatorModalVisible] = useState(false);
  const [mediators, setMediators] = useState<any[]>([]);
  const [selectedMediator, setSelectedMediator] = useState('');
  const [mediatorLoading, setMediatorLoading] = useState(false);
  
  // 案件阶段状态
  const [stages, setStages] = useState({
    registration: { completed: false, name: '案件登记', description: '包含来访登记信息和当事人补充信息' },
    acceptance: { completed: false, name: '案件受理', description: '调解组织受理审批记录' },
    mediate: { completed: false, name: '调解进展', description: '多次调解的记录、会议纪要、沟通情况' },
    closure: { completed: false, name: '结案', description: '调解结果、协议签署、归档信息' }
  });
  
  // "记一笔"功能状态
  const [quickNote, setQuickNote] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [notificationType, setNotificationType] = useState<string[]>(['system', 'popup']);
  
  // 线上调解功能状态
  const [meetingModalVisible, setMeetingModalVisible] = useState(false);
  const [meetings, setMeetings] = useState<any[]>([]);
  
  // 提醒功能状态
  const [reminderVisible, setReminderVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [identifiedDates, setIdentifiedDates] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('其他');
  
  // 案件提醒期限（天）
  const [caseReminderDays, setCaseReminderDays] = useState<number>(15);
  
  // 导出卷宗功能
  const handleExportFile = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // 调用后端API导出卷宗
      const response = await api.get(`/case/${id}/export`, {
        responseType: 'text' // 设置响应类型为text
      });
      
      // 创建下载链接
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // 从响应头中获取文件名
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'case.txt';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('卷宗导出成功，开始下载');
      setLoading(false);
    } catch (error) {
      console.error('导出卷宗失败:', error);
      message.error('导出卷宗失败，请重试');
      setLoading(false);
    }
  };
  
  // AI分析报告功能
  const handleAIAnalysis = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // 调用后端API生成AI分析报告
      const response = await api.get(`/case/${id}/ai-analysis`);
      setAIAnalysisData(response.data.data);
      message.success('AI分析报告生成完成');
      // 打开AI分析报告模态框
      setAIAnalysisModalVisible(true);
      setLoading(false);
    } catch (error) {
      console.error('生成AI分析报告失败:', error);
      message.error('生成AI分析报告失败，请重试');
      setLoading(false);
    }
  };
  
  // AI分析报告数据
  const [AIAnalysisData, setAIAnalysisData] = useState<any>(null);
  
  // AI分析报告模态框状态
  const [AIAnalysisModalVisible, setAIAnalysisModalVisible] = useState(false);

  const fetchEvidence = async () => {
    if (!id) return;
    
    try {
      const response = await api.get(`/evidence/case/${id}`);
      setEvidence(response.data.evidences || []);
    } catch (error) {
      console.error('获取证据失败:', error);
      // 不显示错误，因为可能该API尚未实现
      setEvidence([]);
    }
  };
  
  // 获取案件提醒期限
  const fetchCaseReminderDays = async () => {
    try {
      const response = await api.get('/user/reminder/setting');
      setCaseReminderDays(response.data.setting.caseReminderDays || 15);
    } catch (error) {
      console.error('获取案件提醒期限失败:', error);
      // 默认为15天
      setCaseReminderDays(15);
    }
  };

  const fetchCaseDetail = async (retryCount = 0) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/case/${id}`);
      setCaseData(response.data.case);
      setProgress(response.data.progress);
      await fetchEvidence();
      
      // 更新案件阶段状态
      updateStageStatus(response.data.progress);
      
      // 获取调解会议记录
      await fetchMeetings();
    } catch (error) {
      if (retryCount < 3) {
        // 重试机制，最多重试3次
        setTimeout(() => {
          fetchCaseDetail(retryCount + 1);
        }, 500);
      } else {
        message.error('获取案件详情失败');
        setLoading(false);
      }
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };
  
  // 阶段详情模态框状态
  const [stageDetailModalVisible, setStageDetailModalVisible] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [stageDetail, setStageDetail] = useState<any>({});
  
  // 更新案件阶段状态
  const updateStageStatus = (progress: Progress[]) => {
    const newStages = { ...stages };
    
    // 检查各个阶段是否有记录
    const hasRegistration = progress.some(item => item.type === 'register');
    const hasAcceptance = progress.some(item => item.type === 'accept');
    const hasMediation = progress.some(item => item.type === 'mediate');
    const hasClosure = progress.some(item => item.type === 'close');
    
    // 更新阶段状态
    newStages.registration.completed = hasRegistration;
    newStages.acceptance.completed = hasAcceptance;
    newStages.mediate.completed = hasMediation;
    newStages.closure.completed = hasClosure;
    
    setStages(newStages);
  };
  
  // 打开阶段详情模态框
  const openStageDetailModal = (stage: string) => {
    setCurrentStage(stage);
    
    // 根据阶段类型获取相应的详细信息
    let detail = {};
    if (stage === 'registration') {
      detail = {
        title: '案件登记详情',
        items: [
          { label: '来访登记信息', value: '包含来访时间、来访人信息、纠纷类型等' },
          { label: '当事人补充信息', value: '包含当事人基本信息、联系方式、争议事实等' }
        ]
      };
    } else if (stage === 'acceptance') {
      detail = {
        title: '案件受理详情',
        items: [
          { label: '受理审批记录', value: '包含受理时间、审批人、审批意见等' },
          { label: '调解组织信息', value: '包含调解组织名称、调解员信息等' }
        ]
      };
    } else if (stage === 'mediate') {
      detail = {
        title: '调解进展详情',
        items: [
          { label: '调解记录', value: `共 ${progress.filter(item => item.type === 'mediate').length} 条调解记录` },
          { label: '会议纪要', value: `共 ${meetings.length} 次调解会议` },
          { label: '沟通情况', value: '包含与当事人的沟通记录、协商情况等' }
        ]
      };
    } else if (stage === 'closure') {
      detail = {
        title: '结案详情',
        items: [
          { label: '调解结果', value: caseData?.status === 'completed' ? '已完成' : '处理中' },
          { label: '协议签署', value: '包含调解协议内容、签署时间、签署人等' },
          { label: '归档信息', value: '包含归档时间、归档编号、归档人等' }
        ]
      };
    }
    
    setStageDetail(detail);
    setStageDetailModalVisible(true);
  };
  
  // 获取调解会议记录
  const fetchMeetings = async () => {
    if (!id) return;
    
    try {
      const response = await api.get(`/case/${id}/meetings`);
      setMeetings(response.data.meetings || []);
    } catch (error) {
      console.error('获取调解会议记录失败:', error);
      // 不显示错误，因为可能该API尚未实现
      setMeetings([]);
    }
  };

  useEffect(() => {
    fetchCaseDetail();
    fetchCaseReminderDays();
  }, [id]);
  
  useEffect(() => {
    // 检查强制提醒
    checkForcedReminder();
  }, [caseData, progress, stages, caseReminderDays]);

  const handleStatusUpdate = async () => {
    if (!id || !newStatus) return;
    
    setLoading(true);
    try {
      await api.put(`/case/${id}/status`, {
        status: newStatus,
        reason: statusReason
      });
      message.success('状态更新成功');
      setStatusModalVisible(false);
      fetchCaseDetail();
    } catch (error) {
      message.error('状态更新失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取调解员列表
  const fetchMediators = async () => {
    setMediatorLoading(true);
    try {
      const response = await api.get('/auth/users', { params: { role: 'mediator' } });
      setMediators(response.data.users || []);
    } catch (error) {
      message.error('获取调解员列表失败');
    } finally {
      setMediatorLoading(false);
    }
  };

  // 打开分配调解员模态框
  const openMediatorModal = async () => {
    await fetchMediators();
    // 只有当mediatorId有_id属性且该ID在调解员列表中存在时才设置selectedMediator
    const currentMediatorId = caseData?.mediatorId?._id;
    if (currentMediatorId) {
      const mediatorExists = mediators.some(mediator => mediator._id === currentMediatorId);
      setSelectedMediator(mediatorExists ? currentMediatorId : '');
    } else {
      setSelectedMediator('');
    }
    setMediatorModalVisible(true);
  };

  // 分配调解员
  const handleAssignMediator = async () => {
    if (!id || !selectedMediator) return;
    
    setMediatorLoading(true);
    try {
      await api.put(`/case/${id}/mediator`, {
        mediatorId: selectedMediator
      });
      message.success('调解员分配成功');
      setMediatorModalVisible(false);
      fetchCaseDetail();
    } catch (error) {
      message.error('调解员分配失败');
    } finally {
      setMediatorLoading(false);
    }
  };
  
  // 处理"记一笔"快捷记录
  const handleQuickNote = async () => {
    if (!id || !quickNote.trim()) return;
    
    setLoading(true);
    try {
      console.log('提交记录:', {
        content: quickNote,
        type: 'mediate',
        notificationType: notificationType
      });
      
      await api.post(`/case/${id}/progress`, {
        content: quickNote,
        type: 'mediate',
        notificationType: notificationType
      });
      message.success('记录添加成功');
      
      // 智能识别日期信息 - 支持多种日期格式
      const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}([日]|$)|\d{1,2}[/]\d{1,2}[/]\d{4}/g;
      const dates = quickNote.match(dateRegex);
      
      if (dates && dates.length > 0) {
        setIdentifiedDates(dates);
        setScheduleModalVisible(true);
      }
      
      setNoteModalVisible(false);
      setQuickNote('');
      fetchCaseDetail();
    } catch (error) {
      console.error('记录添加失败:', error);
      message.error('记录添加失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 检查强制提醒
  const checkForcedReminder = () => {
    if (!caseData) return;
    
    // 检查案件是否处于待处理状态
    if (caseData.status === 'pending') {
      // 案件状态为待处理时，一直显示提醒
      setReminderVisible(true);
    } else {
      // 其他状态不显示提醒
      setReminderVisible(false);
    }
  };
  
  // 处理调解意愿确认
  const handleMediationAgreement = async (agree: boolean) => {
    setLoading(true);
    try {
      console.log('开始处理调解意愿确认，caseId:', id, 'agree:', agree);
      if (agree) {
        // 同意继续调解，将案件状态改为处理中
        console.log('发送API请求更新状态为processing');
        const response = await api.put(`/case/${id}/status`, {
          status: 'processing',
          reason: '双方同意调解'
        });
        console.log('API响应:', response.data);
        message.success('已确认继续调解，案件状态已更新为处理中');
      } else {
        // 不同意调解，将案件状态改为失败
        console.log('发送API请求更新状态为failed');
        const response = await api.put(`/case/${id}/status`, {
          status: 'failed',
          reason: '一方不同意调解'
        });
        console.log('API响应:', response.data);
        message.success('已确认不同意调解，案件状态已更新为失败');
      }
      // API调用成功，先设置提醒不可见
      setReminderVisible(false);
      // 然后获取最新案件数据
      console.log('获取最新案件数据');
      await fetchCaseDetail();
      console.log('获取完成，最新caseData:', caseData);
    } catch (error: any) {
      console.error('确认失败:', error);
      console.error('错误信息:', error.message);
      console.error('错误响应:', error.response);
      message.error('确认失败，请重试: ' + (error.message || '未知错误'));
      // API调用失败，保持提醒可见
    } finally {
      setLoading(false);
    }
  };
  
  // 处理日程提醒
  const handleScheduleReminder = () => {
    if (!quickNote.trim()) {
      message.warning('请先输入记录内容');
      return;
    }
    
    // 智能识别日期信息 - 支持多种日期格式
    const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}([日]|$)|\d{1,2}[/]\d{1,2}[/]\d{4}/g;
    const dates = quickNote.match(dateRegex);
    
    if (dates && dates.length > 0) {
      setIdentifiedDates(dates);
      setScheduleModalVisible(true);
    } else {
      message.info('未识别到日期信息');
    }
  };
  
  // 处理日程添加
  const handleAddSchedule = async (date: string) => {
    setLoading(true);
    try {
      await api.post(`/case/${id}/schedule`, {
        date,
        caseId: id,
        category: selectedCategory
      });
      message.success('已添加到日程提醒');
      setScheduleModalVisible(false);
    } catch (error) {
      message.error('添加日程失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 会议预约状态
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  
  // 处理调解会议预约
  const handleMeetingSchedule = async () => {
    if (!id || !meetingTitle || !meetingDate) return;
    
    const meetingData = {
      title: meetingTitle,
      scheduledAt: meetingDate,
      description: meetingDescription,
      caseId: id
    };
    
    setLoading(true);
    try {
      // 模拟调用API
      // await api.post(`/case/${id}/meetings`, meetingData);
      
      // 模拟第三方会议API集成
      const meetingLink = `https://meeting.example.com/join/${Date.now()}`;
      
      message.success('会议预约成功');
      message.info(`会议链接：${meetingLink}`);
      
      // 重置表单
      setMeetingTitle('');
      setMeetingDate('');
      setMeetingDescription('');
      
      setMeetingModalVisible(false);
      fetchMeetings();
    } catch (error) {
      message.error('会议预约失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败'
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!caseData) {
    return <div>案件不存在</div>;
  }

  // 计算案件整体进度
  const completedStages = Object.values(stages).filter(stage => stage.completed).length;
  const totalStages = Object.values(stages).length;
  const overallProgress = (completedStages / totalStages) * 100;

  // 获取阶段图标
  const getStageIcon = (stage: string, completed: boolean) => {
    if (completed) {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
    switch (stage) {
      case 'registration':
        return <FileTextOutlined style={{ color: '#1890ff' }} />;
      case 'acceptance':
        return <UserOutlined style={{ color: '#fa8c16' }} />;
      case 'mediate':
        return <MessageOutlined style={{ color: '#722ed1' }} />;
      case 'closure':
        return <CheckCircleOutlined style={{ color: '#eb2f96' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
  };



  return (
    <div style={{ backgroundColor: 'white', padding: 24, borderRadius: 8 }}>
      {/* 页面标题和操作按钮 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2>案件详情 - {caseData.caseNumber}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" ghost onClick={handleExportFile}>
              <FileTextOutlined /> 导出卷宗
            </Button>
            <Button type="primary" onClick={handleAIAnalysis}>
              AI分析报告
            </Button>
          </div>
        </div>
        <div>
          {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
            <Button type="primary" onClick={() => setStatusModalVisible(true)} style={{ marginRight: 8 }}>
              更新状态
            </Button>
          )}
          {userInfo?.role === 'admin' && (
            <Button type="default" onClick={openMediatorModal} style={{ marginRight: 8 }}>
              分配调解员
            </Button>
          )}
          {(userInfo?.role === 'mediator' || userInfo?.role === 'admin') && (
            <Button type="default" onClick={() => setMeetingModalVisible(true)} style={{ marginRight: 8 }}>
              <VideoCameraOutlined /> 调解会议
            </Button>
          )}
        </div>
      </div>

      {/* 页面主体内容 - 左右布局 */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        {/* 左侧：案件时间轴 */}
        <div style={{ flex: 1, minWidth: 500 }}>
          <Card title="案件时间轴" style={{ marginBottom: 24 }}>
            <Timeline
              mode="left"
            >
              {/* 案件登记 */}
              <Timeline.Item color="blue">
                <div style={{ cursor: 'pointer', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>案件登记</h4>
                  </div>
                  <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                    登记时间：{new Date(caseData.createdAt).toLocaleString()}
                  </p>
                </div>
              </Timeline.Item>
              
              {/* 案件受理 */}
              <Timeline.Item color="orange">
                <div style={{ cursor: 'pointer', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>案件受理</h4>
                  </div>
                  <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                    受理人：{caseData?.mediatorId?.name || '未分配'}
                  </p>
                </div>
              </Timeline.Item>
              
              {/* 调解进展 */}
              <Timeline.Item color="purple">
                <div style={{ cursor: 'pointer', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>调解进展</h4>
                  </div>
                  {progress.filter(p => p.type === 'mediate').length > 0 ? (
                    <div>
                      {progress.filter(p => p.type === 'mediate').map((item) => (
                        <div key={item._id} style={{ marginBottom: 8, paddingLeft: 16, borderLeft: '2px solid #e8e8e8' }}>
                          <p style={{ margin: 0, marginBottom: 4 }}>{item.content}</p>
                          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                            {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                      暂无调解记录
                    </p>
                  )}
                </div>
              </Timeline.Item>
              
              {/* 结案 */}
              <Timeline.Item color="pink">
                <div style={{ cursor: 'pointer', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <h4 style={{ margin: 0 }}>结案</h4>
                  </div>
                  <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
                    {(() => {
                      // 检查案件状态是否为成功或失败
                      if (caseData?.status === 'completed' || caseData?.status === 'failed') {
                        return '状态：已结案';
                      }
                      // 检查是否有结案记录
                      if (progress.find(p => p.type === 'close')) {
                        return '状态：已结案';
                      }
                      // 计算距离结案还有多少天
                      if (caseData?.createdAt) {
                        const createdDate = new Date(caseData.createdAt);
                        const currentDate = new Date();
                        const daysPassed = Math.floor((currentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                        const daysRemaining = caseReminderDays - daysPassed;
                        return `状态：距离结案还有 ${daysRemaining > 0 ? daysRemaining : 0} 天`;
                      }
                      return '状态：未结案';
                    })()}
                  </p>
                </div>
              </Timeline.Item>
            </Timeline>
          </Card>
        </div>

        {/* 右侧：案件信息和重要提醒 */}
        <div style={{ width: 400, flexShrink: 0 }}>
          {/* 案件基本信息 */}
          <Card title="案件基本信息" style={{ marginBottom: 24 }}>
            <Descriptions column={1}>
              <Descriptions.Item label={<><FileTextOutlined /> 案件编号</>}>{caseData.caseNumber}</Descriptions.Item>
              <Descriptions.Item label={<><ClockCircleOutlined /> 状态</>}>
                <Badge status={caseData.status === 'completed' ? 'success' : caseData.status === 'processing' ? 'processing' : 'default'} text={getStatusText(caseData.status)} />
              </Descriptions.Item>
              <Descriptions.Item label={<><UserOutlined /> 申请人</>}>{caseData.applicantId?.name || '未知'} ({caseData.applicantId?.phone || '未知'})</Descriptions.Item>
              <Descriptions.Item label={<><UserOutlined /> 被申请人</>}>{caseData.respondentId?.name || '未知'} ({caseData.respondentId?.phone || '未知'})</Descriptions.Item>
              <Descriptions.Item label={<><ExclamationCircleOutlined /> 争议类型</>}>{caseData.disputeType}</Descriptions.Item>
              <Descriptions.Item label={<><DollarOutlined /> 涉案金额</>}>¥{caseData.caseAmount || 0}</Descriptions.Item>
              <Descriptions.Item label={<><UserOutlined /> 调解员</>}>{caseData.mediatorId?.name || '未分配'}</Descriptions.Item>
              <Descriptions.Item label={<><CalendarOutlined /> 创建时间</>}>{new Date(caseData.createdAt).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label={<><CalendarOutlined /> 结案时间</>}>{caseData.closeTime ? new Date(caseData.closeTime).toLocaleString() : '未结案'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 调解请求 */}
          <Card title="调解请求" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 8 }}>{caseData.requestItems}</p>
              <Button type="link">查看详细请求</Button>
            </div>
          </Card>

          {/* 重要提醒 */}
          <Card title="重要提醒" style={{ marginBottom: 24, borderLeft: '4px solid #faad14' }}>
            {caseData.status === 'pending' && (
              <div style={{ backgroundColor: '#fffbe6', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                <p style={{ marginBottom: 8, fontWeight: 'bold' }}>调解意愿确认</p>
                <p style={{ marginBottom: 12 }}>案件状态为待处理，需确认双方调解意愿</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" size="small" onClick={() => handleMediationAgreement(true)}>
                    双方同意调解
                  </Button>
                  <Button danger size="small" onClick={() => handleMediationAgreement(false)}>
                    一方不同意调解
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* 证据材料 */}
          <Card title="证据材料" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>证据列表</h4>
                <Button size="small" type="link" onClick={() => setNoteModalVisible(true)}>
                  文件识别
                </Button>
              </div>
              <List
                dataSource={evidence}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text>{item.name}</Text>}
                      description={<Text type="secondary" style={{ fontSize: 12 }}>{new Date(item.uploadTime || Date.now()).toLocaleString()}</Text>}
                    />
                    <Button size="small" type="link">查看</Button>
                  </List.Item>
                )}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* 底部：记一笔功能 */}
      <Card title="记一笔" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Button type="dashed" icon={<UploadOutlined />} onClick={() => setNoteModalVisible(true)}>
              文件识别
            </Button>
            <Button type="dashed" icon={<CalendarOutlined />} onClick={handleScheduleReminder}>
              日程提醒
            </Button>
          </div>
          <TextArea
            rows={4}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="请快速记录调解过程中的关键信息..."
          />
        </div>
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" onClick={handleQuickNote}>
            保存记录
          </Button>
        </div>
      </Card>

      <Modal
        title="更新案件状态"
        open={statusModalVisible}
        onOk={handleStatusUpdate}
        onCancel={() => setStatusModalVisible(false)}
        okButtonProps={{ loading }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>新状态</label>
          <Select
            style={{ width: '100%' }}
            value={newStatus}
            onChange={setNewStatus}
            placeholder="请选择状态"
          >
            <Option value="pending">待处理</Option>
            <Option value="processing">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
          </Select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>变更原因</label>
          <TextArea
            rows={4}
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            placeholder="请输入状态变更原因"
          />
        </div>
      </Modal>

      <Modal
        title="分配调解员"
        open={mediatorModalVisible}
        onOk={handleAssignMediator}
        onCancel={() => setMediatorModalVisible(false)}
        okButtonProps={{ loading: mediatorLoading }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>选择调解员</label>
          <Select
            style={{ width: '100%' }}
            value={selectedMediator}
            onChange={setSelectedMediator}
            placeholder="请选择调解员"
            loading={mediatorLoading}
          >
            {mediators.map((mediator) => (
              <Option key={mediator._id} value={mediator._id}>
                {mediator.name} ({mediator.phone})
              </Option>
            ))}
          </Select>
        </div>
        <div>
          <p style={{ color: '#666' }}>
            当前调解员：{caseData?.mediatorId?.name || '未分配'}
          </p>
        </div>
      </Modal>

      {/* "记一笔"快捷记录模态框 */}
      <Modal
        title="记一笔"
        open={noteModalVisible}
        onOk={handleQuickNote}
        onCancel={() => setNoteModalVisible(false)}
        okButtonProps={{ loading }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>调解记录</label>
          <TextArea
            rows={6}
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="请快速记录调解过程中的关键信息..."
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>通知方式</label>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            value={notificationType}
            onChange={setNotificationType}
            options={[
              { value: 'system', label: '站内消息' },
              { value: 'popup', label: '弹窗提醒' },
              { value: 'sms', label: '短信提醒' }
            ]}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>文件识别（自动提取关键信息）</label>
          <Upload
            action={`${getApiBaseUrl()}/evidence/recognize`}
            method="POST"
            data={{ caseId: id }}
            headers={{
              Authorization: useAuthStore.getState().token ? `Bearer ${useAuthStore.getState().token}` : ''
            }}
            onChange={(info) => {
              if (info.file.status === 'done') {
                // 处理识别结果
                if (info.file.response && info.file.response.recognizedContent) {
                  const extractedText = `从文件 ${info.file.name} 中提取的内容：\n${info.file.response.recognizedContent}`;
                  setQuickNote(prev => prev + '\n' + extractedText);
                  message.success(`${info.file.name} 识别成功，关键信息已提取并填入记录`);
                } else {
                  // 模拟文件文本提取
                  const extractedText = `从文件 ${info.file.name} 中提取的文本内容示例。这是一个模拟的文本提取结果，实际应用中会从文件中真实提取内容。`;
                  setQuickNote(prev => prev + '\n' + extractedText);
                  message.success(`${info.file.name} 识别成功，文本已提取并填入记录`);
                }
              } else if (info.file.status === 'error') {
                message.error(`${info.file.name} 识别失败`);
              }
            }}
            showUploadList={false}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          >
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
        </div>
        <div>
          <p style={{ color: '#666', fontSize: 12 }}>
            提示：系统会自动识别记录中的日期信息，询问是否添加到日程提醒
          </p>
        </div>
      </Modal>

      {/* 调解会议模态框 */}
      <Modal
        title="调解会议"
        open={meetingModalVisible}
        onCancel={() => {
          setMeetingModalVisible(false);
          // 重置表单
          setMeetingTitle('');
          setMeetingDate('');
          setMeetingDescription('');
        }}
        footer={null}
      >
        <div style={{ marginBottom: 24 }}>
          <h3>预约新会议</h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>会议标题</label>
            <Input 
              placeholder="请输入会议标题" 
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>会议时间</label>
            <Input 
              type="datetime-local" 
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>会议描述</label>
            <TextArea 
              rows={4} 
              placeholder="请输入会议描述" 
              value={meetingDescription}
              onChange={(e) => setMeetingDescription(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
            <h4 style={{ marginBottom: 8 }}>会议功能</h4>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox defaultChecked /> 视频会议
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox defaultChecked /> 会议录音
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox defaultChecked /> 语音转文字
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox defaultChecked /> 电子签字
              </div>
            </div>
          </div>
          <Button 
            type="primary" 
            style={{ marginRight: 8 }}
            onClick={handleMeetingSchedule}
            loading={loading}
          >
            预约会议
          </Button>
          <Button onClick={() => {
            setMeetingModalVisible(false);
            // 重置表单
            setMeetingTitle('');
            setMeetingDate('');
            setMeetingDescription('');
          }}>
            取消
          </Button>
        </div>
        <div>
          <h3>历史会议</h3>
          {meetings.length > 0 ? (
            meetings.map((meeting) => (
              <div key={meeting._id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span>{meeting.title || '调解会议'}</span>
                  <Tag color="blue">{new Date(meeting.scheduledAt).toLocaleString()}</Tag>
                </div>
                <p style={{ fontSize: 12, color: '#666' }}>{meeting.description || '无会议描述'}</p>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button type="link" size="small">查看详情</Button>
                  <Button type="link" size="small">加入会议</Button>
                  <Button type="link" size="small">会议记录</Button>
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', color: '#999' }}>暂无历史会议</p>
          )}
        </div>
      </Modal>
      
      {/* 智能日程提醒模态框 */}
      <Modal
        title="智能日程提醒"
        open={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        footer={null}
      >
        <div style={{ marginBottom: 24 }}>
          <p style={{ marginBottom: 16 }}>系统从您的记录中识别到以下日期信息，是否添加到日程提醒？</p>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>日程分类</label>
            <Select
              style={{ width: '100%' }}
              value={selectedCategory}
              onChange={setSelectedCategory}
            >
              <Option value="调解会议">调解会议</Option>
              <Option value="证据提交">证据提交</Option>
              <Option value="案件讨论">案件讨论</Option>
              <Option value="其他">其他</Option>
            </Select>
          </div>
          {identifiedDates.map((date, index) => (
            <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{date}</span>
                <Button type="primary" size="small" onClick={() => handleAddSchedule(date)}>
                  添加到日程
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'right' }}>
          <Button onClick={() => setScheduleModalVisible(false)}>取消</Button>
        </div>
      </Modal>
      
      {/* 强制提醒模态框 */}
      <Modal
        title="强制提醒"
        open={reminderVisible}
        onCancel={() => setReminderVisible(false)}
        footer={null}
        okButtonProps={{ loading }}
      >
        <div style={{ marginBottom: 24 }}>
          <p style={{ marginBottom: 16, fontSize: 16, fontWeight: 'bold' }}>案件受理已超过15天</p>
          <p style={{ marginBottom: 16 }}>根据调解流程规定，案件受理后第15天需要确认双方调解意愿。请确认当事人是否同意继续调解。</p>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#e6f7ff', borderRadius: 4 }}>
            <p style={{ marginBottom: 8 }}>案件信息：</p>
            <p>案件编号：{caseData?.caseNumber}</p>
            <p>申请人：{caseData?.applicantId?.name}</p>
            <p>被申请人：{caseData?.respondentId?.name}</p>
            <p>争议类型：{caseData?.disputeType}</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button danger onClick={() => handleMediationAgreement(false)}>
            不同意调解，进入结案流程
          </Button>
          <Button type="primary" onClick={() => handleMediationAgreement(true)}>
            同意继续调解
          </Button>
        </div>
      </Modal>
      
      {/* 阶段详情模态框 */}
      <Modal
        title={stageDetail.title}
        open={stageDetailModalVisible}
        onCancel={() => setStageDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 24 }}>
          <Descriptions column={1}>
            {stageDetail.items?.map((item: any, index: number) => (
              <Descriptions.Item key={index} label={item.label}>
                {item.value}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
        
        {/* 阶段相关记录 */}
        <div style={{ marginBottom: 24 }}>
          <h4>相关记录</h4>
          {currentStage === 'registration' && (
            <div>
              {progress.filter(item => item.type === 'register').map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <p style={{ marginBottom: 4 }}>{item.content}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {currentStage === 'acceptance' && (
            <div>
              {progress.filter(item => item.type === 'accept').map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <p style={{ marginBottom: 4 }}>{item.content}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {currentStage === 'mediate' && (
            <div>
              {progress.filter(item => item.type === 'mediate').map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <p style={{ marginBottom: 4 }}>{item.content}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {currentStage === 'closure' && (
            <div>
              {progress.filter(item => item.type === 'close').map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                  <p style={{ marginBottom: 4 }}>{item.content}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    {item.creatorId?.name || '未知'} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 阶段相关证据 */}
        <div style={{ marginBottom: 24 }}>
          <h4>相关证据</h4>
          {evidence.length > 0 ? (
            <div>
              {evidence.map((item, index) => (
                <div key={index} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                  <p style={{ marginBottom: 4 }}>{item.name}</p>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    上传时间：{new Date(item.uploadTime || Date.now()).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#999' }}>暂无相关证据</p>
          )}
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <Button onClick={() => setStageDetailModalVisible(false)}>关闭</Button>
        </div>
      </Modal>
      
      {/* AI分析报告模态框 */}
      <Modal
        title="AI分析报告"
        open={AIAnalysisModalVisible}
        onCancel={() => setAIAnalysisModalVisible(false)}
        footer={null}
        width={800}
      >
        {AIAnalysisData ? (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16 }}>案件分析报告</h3>
            
            {/* 案件基本信息 */}
            <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <h4 style={{ marginBottom: 12 }}>案件基本信息</h4>
              <Descriptions column={2}>
                <Descriptions.Item label="案件编号">{AIAnalysisData.caseInfo?.caseNumber}</Descriptions.Item>
                <Descriptions.Item label="争议类型">{AIAnalysisData.caseInfo?.disputeType}</Descriptions.Item>
                <Descriptions.Item label="申请人">{AIAnalysisData.caseInfo?.applicant}</Descriptions.Item>
                <Descriptions.Item label="被申请人">{AIAnalysisData.caseInfo?.respondent}</Descriptions.Item>
                <Descriptions.Item label="涉案金额">¥{AIAnalysisData.caseInfo?.caseAmount || 0}</Descriptions.Item>
                <Descriptions.Item label="当前状态">{AIAnalysisData.caseInfo?.status}</Descriptions.Item>
              </Descriptions>
            </div>
            
            {/* 争议焦点分析 */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>争议焦点分析</h4>
              <div style={{ padding: 16, backgroundColor: '#e6f7ff', borderRadius: 8 }}>
                <p style={{ marginBottom: 8 }}><strong>主要争议点：</strong>{AIAnalysisData.disputeFocus}</p>
                <p style={{ marginBottom: 8 }}><strong>潜在风险点：</strong>{AIAnalysisData.potentialRisks}</p>
              </div>
            </div>
            
            {/* 调解策略建议 */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>调解策略建议</h4>
              <div style={{ padding: 16, backgroundColor: '#f6ffed', borderRadius: 8 }}>
                {AIAnalysisData.mediationStrategies?.map((strategy: string, index: number) => (
                  <p key={index} style={{ marginBottom: 8 }}>{strategy}</p>
                ))}
              </div>
            </div>
            
            {/* 类案推荐 */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>类案推荐</h4>
              <div style={{ padding: 16, backgroundColor: '#fff7e6', borderRadius: 8 }}>
                {AIAnalysisData.similarCases?.map((caseItem: any, index: number) => (
                  <div key={index} style={{ marginBottom: 16 }}>
                    <p style={{ marginBottom: 4 }}><strong>推荐案例{index + 1}：</strong>{caseItem.title}</p>
                    <p style={{ marginBottom: 4 }}><strong>调解结果：</strong>{caseItem.result}</p>
                    <p style={{ marginBottom: 4 }}><strong>关键因素：</strong>{caseItem.keyFactors}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 后续建议 */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>后续建议</h4>
              <div style={{ padding: 16, backgroundColor: '#f0f5ff', borderRadius: 8 }}>
                {AIAnalysisData.followUpSuggestions?.map((suggestion: string, index: number) => (
                  <p key={index} style={{ marginBottom: 8 }}>{suggestion}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p>加载中...</p>
          </div>
        )}
        
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" style={{ marginRight: 8 }}>
            导出报告
          </Button>
          <Button onClick={() => setAIAnalysisModalVisible(false)}>
            关闭
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default CaseDetail;