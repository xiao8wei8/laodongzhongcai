import express from 'express';
import mongoose, { Types } from 'mongoose';
import Case from '../models/Case';
import CaseProgress from '../models/CaseProgress';
import VisitorRecord from '../models/VisitorRecord';
import Schedule from '../models/Schedule';
import Message from '../models/Message';
import Notification from '../models/Notification';
import AiUsage from '../models/AiUsage';

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
  const caseQuery: any = {};
  const visitorQuery: any = {};

  // 根据用户角色过滤
  if (role === 'personal' || role === 'company') {
    if (userId) {
      // 直接使用字符串形式的userId，MongoDB会自动转换
      caseQuery.$or = [
        { applicantId: userId },
        { respondentId: userId }
      ];
    }
  } else if (role === 'mediator') {
    if (userId) {
      // 直接使用字符串形式的userId，MongoDB会自动转换
      caseQuery.mediatorId = userId;
      visitorQuery.mediatorId = userId;
    }
  }

  console.log('Dashboard stats query:', {
    userId,
    role,
    caseQuery,
    visitorQuery
  });

  // 获取案件总数
  let totalCases = await Case.countDocuments(caseQuery);
  let totalVisitors = 0;
  
  // 个人和企业用户不应该看到到访登记记录
  console.log('Role check:', { role, isPersonal: role === 'personal', isCompany: role === 'company' });
  if (role !== 'personal' && role !== 'company') {
    console.log('Fetching visitor records for non-personal/company user');
    totalVisitors = await VisitorRecord.countDocuments(visitorQuery);
  } else {
    console.log('Skipping visitor records for personal/company user');
  }
  
  const total = totalCases + totalVisitors;

  console.log('Dashboard stats counts:', {
    totalCases,
    totalVisitors,
    total
  });

  // 调试：直接查询调解员123的案件和到访记录
  if (userId === '69a9a6d917bcb1d9978a5222') {
    console.log('=== 调教员123数据调试 ===');
    const mediatorCases = await Case.find({ mediatorId: userId });
    console.log('调教员123的正式案件:', mediatorCases.length, mediatorCases.map(c => c.caseNumber));
    
    const mediatorVisitors = await VisitorRecord.find({ mediatorId: userId });
    console.log('调教员123的到访登记:', mediatorVisitors.length, mediatorVisitors.map(v => v.registerNumber));
  }

  // 获取各状态案件数量
  const casePending = await Case.countDocuments({ ...caseQuery, status: 'pending' });
  const caseProcessing = await Case.countDocuments({ ...caseQuery, status: 'processing' });
  const caseCompleted = await Case.countDocuments({ ...caseQuery, status: 'completed' });
  const caseFailed = await Case.countDocuments({ ...caseQuery, status: 'failed' });
  
  // 获取到访登记各状态数量
  let visitorPending = 0;
  let visitorProcessing = 0;
  let visitorCompleted = 0;
  let visitorFailed = 0;
  
  // 个人和企业用户不应该看到到访登记记录
  if (role !== 'personal' && role !== 'company') {
    visitorPending = await VisitorRecord.countDocuments({ ...visitorQuery, status: 'pending' });
    visitorProcessing = await VisitorRecord.countDocuments({ ...visitorQuery, status: 'processing' });
    visitorCompleted = await VisitorRecord.countDocuments({ ...visitorQuery, status: 'completed' });
    visitorFailed = await VisitorRecord.countDocuments({ ...visitorQuery, status: 'failed' });
  }
  
  // 调试：打印详细的统计数据
  console.log('Detailed stats breakdown:', {
    casePending,
    caseProcessing,
    caseCompleted,
    caseFailed,
    visitorPending,
    visitorProcessing,
    visitorCompleted,
    visitorFailed
  });
  
  // 合并统计
  const pendingCases = casePending + visitorPending;
  const processingCases = caseProcessing + visitorProcessing;
  const completedCases = caseCompleted + visitorCompleted;
  const failedCases = caseFailed + visitorFailed;

  console.log('Dashboard status counts:', {
    pendingCases,
    processingCases,
    completedCases,
    failedCases
  });

  // 获取今日到访记录数
  let todayVisitors = 0;
  
  // 个人和企业用户不应该看到到访登记记录
  if (role !== 'personal' && role !== 'company') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    todayVisitors = await VisitorRecord.countDocuments({
      ...visitorQuery,
      createdAt: {
        $gte: today,
        $lt: tomorrow
      }
    });
  }

  console.log('Dashboard today visitors:', todayVisitors);

  // 统计邮件、短信、AI使用量
  let emailCount = 0;
  let smsCount = 0;
  let aiUsageCount = 0;
  
  // 只有调解员和管理员可以查看这些统计
  if (role === 'mediator' || role === 'admin') {
    // 统计邮件数量
    emailCount = await Notification.countDocuments({ type: 'email' });
    // 统计短信数量
    smsCount = await Notification.countDocuments({ type: 'sms' });
    // 统计AI使用量（按token统计）
    const aiUsageStats = await AiUsage.aggregate([
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' }
        }
      }
    ]);
    aiUsageCount = aiUsageStats[0]?.totalTokens || 0;
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
  // 构建正式案件查询
  const caseQuery: any = {
    status: { $in: ['pending', 'processing'] }
  };

  // 构建到访登记查询
  const visitorQuery: any = {};

  // 根据用户角色过滤
  if (role === 'personal' || role === 'company') {
    if (userId) {
      // 直接使用字符串形式的userId，MongoDB会自动转换
      caseQuery.$or = [
        { applicantId: userId },
        { respondentId: userId }
      ];
    }
  } else if (role === 'mediator') {
    if (userId) {
      // 直接使用字符串形式的userId，MongoDB会自动转换
      caseQuery.mediatorId = userId;
      visitorQuery.mediatorId = userId;
    }
  }

  // 并行查询正式案件和到访登记
  let cases = [];
  let visitors: any[] = [];
  
  if (role === 'personal' || role === 'company') {
    // 个人和企业用户只查询正式案件
    cases = await Case.find(caseQuery)
      .populate(['applicantId', 'respondentId', 'mediatorId']);
  } else {
    // 其他用户查询正式案件和到访登记
    [cases, visitors] = await Promise.all([
      Case.find(caseQuery)
        .populate(['applicantId', 'respondentId', 'mediatorId']),
      VisitorRecord.find(visitorQuery)
        .populate('mediatorId')
    ]);
  }

  // 将到访登记转换为案件格式
  const formattedVisitors = visitors.map(record => ({
    _id: record._id,
    caseNumber: record.registerNumber,
    applicantId: { name: record.visitorName },
    respondentId: { name: '未知' },
    disputeType: record.disputeType || '未知',
    status: record.status || 'pending',
    mediatorId: record.mediatorId || { name: '未分配' },
    createdAt: record.createdAt
  }));

  // 合并两种记录，确保不重复
  const allCases = role === 'personal' || role === 'company' ? cases : [...formattedVisitors, ...cases];

  // 按创建时间排序并限制数量
  allCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const limitedCases = allCases.slice(0, 10);

  return limitedCases;
};

// 获取通知数据
const getNotificationsData = async (userId: string | undefined, role: string | undefined) => {
  try {
    const notifications = {
      overdueCases: [] as { caseNumber: string; days: number; message: string; action: string }[],
      todaySchedule: [] as { time: string; title: string }[],
      systemNotifications: [] as { title: string; message: string }[]
    };

    // 计算即将超期的案件（假设超过10天未处理的案件）
    if (userId) {
      // 查询实际的案件和到访记录
      const cases = await Case.find({ mediatorId: userId });
      const visitors = await VisitorRecord.find({ mediatorId: userId });
      const today = new Date();
      
      cases.forEach(caseObj => {
        const daysSinceCreated = Math.floor((today.getTime() - caseObj.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceCreated > 10 && (caseObj.status === 'pending' || caseObj.status === 'processing')) {
          notifications.overdueCases.push({
            caseNumber: caseObj.caseNumber,
            days: daysSinceCreated,
            message: `已受理${daysSinceCreated}天，需确认双方调解意向`,
            action: '立即处理'
          });
        }
      });
      
      visitors.forEach(visitor => {
        const daysSinceCreated = Math.floor((today.getTime() - visitor.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceCreated > 10) {
          notifications.overdueCases.push({
            caseNumber: visitor.registerNumber,
            days: daysSinceCreated,
            message: `已登记${daysSinceCreated}天，需确认调解意向`,
            action: '立即处理'
          });
        }
      });

      // 获取今日调解安排
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // 先获取用户相关的案件
      const userCases = await Case.find({ mediatorId: userId });
      const caseIds = userCases.map(caseObj => caseObj._id);

      // 查询这些案件的今日日程
      const todaySchedules = await Schedule.find({
        caseId: { $in: caseIds },
        date: { $gte: todayStart, $lte: todayEnd }
      }).populate('caseId', 'caseNumber');

      todaySchedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.date);
        const timeStr = scheduleDate.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        notifications.todaySchedule.push({
          time: `今日 ${timeStr}`,
          title: schedule.title || `案件 ${(schedule.caseId as any)?.caseNumber} 调解安排`
        });
      });

      // 获取系统通知
      const systemMessages = await Message.find({
        recipientId: userId,
        type: 'system',
        isRead: false
      }).sort({ createdAt: -1 }).limit(5);

      systemMessages.forEach(message => {
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
    const caseQuery: any = {};

    // 根据用户角色过滤
    if (role === 'personal' || role === 'company') {
      if (id) {
        // 直接使用字符串形式的id，MongoDB会自动转换
        caseQuery.$or = [
          { applicantId: id },
          { respondentId: id }
        ];
      }
    } else if (role === 'mediator') {
      if (id) {
        // 直接使用字符串形式的id，MongoDB会自动转换
        caseQuery.mediatorId = id;
      }
    }

    // 按月份分组统计案件数量
    const now = new Date();
    const trendData = [];

    // 生成过去12个月的数据
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      
      const count = await Case.countDocuments({
        ...caseQuery,
        createdAt: {
          $gte: monthDate,
          $lt: nextMonth
        }
      });

      const monthName = `${monthDate.getMonth() + 1}月`;
      trendData.push({ month: monthName, count });
    }

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
    const caseQuery: any = {};

    // 根据用户角色过滤
    if (role === 'personal' || role === 'company') {
      if (id) {
        // 直接使用字符串形式的id，MongoDB会自动转换
        caseQuery.$or = [
          { applicantId: id },
          { respondentId: id }
        ];
      }
    } else if (role === 'mediator') {
      if (id) {
        // 直接使用字符串形式的id，MongoDB会自动转换
        caseQuery.mediatorId = id;
      }
    }

    // 按案件类型分组统计
    const typeData = await Case.aggregate([
      { $match: caseQuery },
      { $group: {
        _id: '$disputeType',
        count: { $sum: 1 }
      }}
    ]);

    // 转换为前端需要的格式
    const formattedData = typeData.map(item => ({
      name: item._id || '其他',
      value: item.count
    }));

    res.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('获取案件类型数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取访客趋势数据
export const getVisitorTrendData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role } = req.user || {};
    const visitorQuery: any = {};

    // 根据用户角色过滤
    if (role === 'mediator') {
      if (id) {
        // 直接使用字符串形式的id，MongoDB会自动转换
        visitorQuery.mediatorId = id;
      }
    }

    // 按月份分组统计访客数量
    const now = new Date();
    const trendData = [];

    // 生成过去12个月的数据
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      
      const count = await VisitorRecord.countDocuments({
        ...visitorQuery,
        createdAt: {
          $gte: monthDate,
          $lt: nextMonth
        }
      });

      const monthName = `${monthDate.getMonth() + 1}月`;
      trendData.push({ month: monthName, count });
    }

    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('获取访客趋势数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
