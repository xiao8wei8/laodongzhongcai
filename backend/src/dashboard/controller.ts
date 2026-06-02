import express from 'express';
import caseRepository from '../repositories/caseRepository';
import visitorRecordRepository from '../repositories/visitorRecordRepository';
import scheduleRepository from '../repositories/scheduleRepository';
import messageRepository from '../repositories/messageRepository';
import notificationRepository from '../repositories/notificationRepository';
import aiUsageRepository from '../repositories/aiUsageRepository';

// 获取工作台数据
export const getDashboardData = async (req: express.Request, res: express.Response) => {
  try {
    // 并行获取数据
    const [stats, pendingCases, notifications] = await Promise.all([
      getStatsData(req.user?.id, req.user?.role),
      getPendingCasesData(req.user?.id, req.user?.role),
      getNotificationsData(req.user?.id, req.user?.role)
    ]);

    res.json({
      stats,
      pendingCases,
      notifications
    });
  } catch (error) {
    console.error('获取工作台数据错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取统计数据
export const getStats = async (req: express.Request, res: express.Response) => {
  try {
    const stats = await getStatsData(req.user?.id, req.user?.role);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取待办事项
export const getPendingCases = async (req: express.Request, res: express.Response) => {
  try {
    const pendingCases = await getPendingCasesData(req.user?.id, req.user?.role);
    res.json({ cases: pendingCases });
  } catch (error) {
    console.error('获取待办事项错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取统计数据
const getStatsData = async (userId: string | undefined, role: string | undefined) => {
  // 获取案件统计
  const caseStats = await caseRepository.getStatistics(userId, role);
  
  // 获取访客统计（仅管理员和调解员可见）
  let visitorStats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  if (role !== 'personal' && role !== 'company') {
    visitorStats = await visitorRecordRepository.getStatistics(userId);
  }
  
  // 合并统计
  const total = (caseStats.total || 0) + (visitorStats.total || 0);
  const pendingCases = (caseStats.pending || 0) + (visitorStats.pending || 0);
  const processingCases = (caseStats.processing || 0) + (visitorStats.processing || 0);
  const completedCases = (caseStats.completed || 0) + (visitorStats.completed || 0);
  const failedCases = (caseStats.failed || 0) + (visitorStats.failed || 0);

  // 获取今日访客记录数（仅管理员和调解员可见）
  let todayVisitors = 0;
  if (role !== 'personal' && role !== 'company') {
    todayVisitors = await visitorRecordRepository.getTodayCount(userId);
  }

  // 统计邮件、短信、AI使用量（仅调解员和管理员可见）
  let emailCount = 0;
  let smsCount = 0;
  let aiUsageCount = 0;
  
  if (role === 'mediator' || role === 'admin') {
    // 统计通知数量
    const emailNotifs = await notificationRepository.findByUser(userId!);
    const smsNotifs = emailNotifs.filter(n => n.type === 'sms' || n.type === 'email');
    emailCount = smsNotifs.filter(n => n.type === 'email').length;
    smsCount = smsNotifs.filter(n => n.type === 'sms').length;
    
    // 统计AI使用量
    const aiStats = await aiUsageRepository.getUsageStatistics();
    aiUsageCount = aiStats.totalTokens || 0;
  }

  return {
    totalCases: total,
    pendingCases,
    processingCases,
    completedCases,
    failedCases,
    todayVisitors,
    emailCount,
    smsCount,
    aiUsageCount
  };
};

// 获取待办事项
const getPendingCasesData = async (userId: string | undefined, role: string | undefined) => {
  // 获取待处理的案件
  const cases = await caseRepository.getPendingAndProcessing(userId, role);
  
  // 将案件转换为统一格式
  const formattedCases = cases.map(c => ({
    _id: c.id,
    id: c.id,
    caseNumber: c.caseNumber,
    applicantId: { name: c.applicantName },
    applicantName: c.applicantName,
    respondentId: { name: c.respondentName },
    respondentName: c.respondentName,
    disputeType: c.disputeType,
    status: c.status,
    mediatorId: c.mediatorId ? { name: c.mediatorName } : null,
    mediatorName: c.mediatorName,
    createdAt: c.createdAt
  }));

  // 获取待处理的访客记录（仅管理员和调解员可见）
  let formattedVisitors: any[] = [];
  if (role !== 'personal' && role !== 'company') {
    const visitors = await visitorRecordRepository.getPendingAndProcessing(userId);
    formattedVisitors = visitors.map(v => ({
      _id: v.id,
      id: v.id,
      caseNumber: v.registerNumber,
      applicantId: { name: v.visitorName },
      applicantName: v.visitorName,
      respondentId: { name: '未知' },
      respondentName: '未知',
      disputeType: v.disputeType || '未知',
      status: v.status || 'pending',
      mediatorId: v.mediatorId ? { name: v.mediatorName } : null,
      mediatorName: v.mediatorName,
      createdAt: v.createdAt
    }));
  }

  // 合并并排序
  const allCases = [...formattedVisitors, ...formattedCases];
  allCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // 限制数量
  return allCases.slice(0, 10);
};

// 获取通知数据
const getNotificationsData = async (userId: string | undefined, role: string | undefined) => {
  try {
    const notifications = {
      overdueCases: [] as { caseNumber: string; days: number; message: string; action: string }[],
      todaySchedule: [] as { time: string; title: string }[],
      systemNotifications: [] as { title: string; message: string }[]
    };

    if (userId && (role === 'mediator' || role === 'admin')) {
      // 计算即将超期的案件
      const today = new Date();
      
      // 获取超期案件
      const overdueCases = await caseRepository.getOverdueCases(userId, 10);
      overdueCases.forEach(caseObj => {
        const daysSinceCreated = Math.floor((today.getTime() - new Date(caseObj.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        notifications.overdueCases.push({
          caseNumber: caseObj.caseNumber,
          days: daysSinceCreated,
          message: `已受理${daysSinceCreated}天，需确认双方调解意向`,
          action: '立即处理'
        });
      });
      
      // 获取超期访客记录
      const overdueVisitors = await visitorRecordRepository.getOverdueRecords(userId, 10);
      overdueVisitors.forEach(visitor => {
        const daysSinceCreated = Math.floor((today.getTime() - new Date(visitor.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        notifications.overdueCases.push({
          caseNumber: visitor.registerNumber,
          days: daysSinceCreated,
          message: `已登记${daysSinceCreated}天，需确认调解意向`,
          action: '立即处理'
        });
      });

      // 获取今日调解安排
      const todaySchedules = await scheduleRepository.findByDate(today);
      todaySchedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.date);
        const timeStr = scheduleDate.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        notifications.todaySchedule.push({
          time: `今日 ${timeStr}`,
          title: schedule.title || `案件 ${schedule.caseNumber} 调解安排`
        });
      });

      // 获取系统通知
      const systemMessages = await messageRepository.findByReceiver(userId);
      const unreadSystemMessages = systemMessages.filter(m => m.type === 'system' && !m.isRead).slice(0, 5);
      unreadSystemMessages.forEach(message => {
        notifications.systemNotifications.push({
          title: '系统通知',
          message: message.content
        });
      });
    }

    return notifications;
  } catch (error) {
    console.error('获取通知数据错误:', error);
    return {
      overdueCases: [],
      todaySchedule: [],
      systemNotifications: []
    };
  }
};

// 获取案件趋势数据
export const getCaseTrendData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role } = req.user || {};
    const trendData = await caseRepository.getTrendData(id, role);
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('获取案件趋势数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取案件类型分布数据
export const getCaseTypeData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role } = req.user || {};
    const typeData = await caseRepository.getTypeDistribution(id, role);
    res.json({ success: true, data: typeData });
  } catch (error) {
    console.error('获取案件类型数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取访客趋势数据
export const getVisitorTrendData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role } = req.user || {};
    let visitorQueryUserId: string | undefined;
    
    // 仅调解员可见
    if (role === 'mediator') {
      visitorQueryUserId = id;
    }
    
    const trendData = await visitorRecordRepository.getTrendData(visitorQueryUserId);
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('获取访客趋势数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
