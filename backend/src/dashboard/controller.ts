import express from 'express';
import caseRepository from '../repositories/caseRepository';
import visitorRecordRepository from '../repositories/visitorRecordRepository';
import scheduleRepository from '../repositories/scheduleRepository';
import messageRepository from '../repositories/messageRepository';
import aiUsageRepository from '../repositories/aiUsageRepository';
import pool from '../config/mysql';
import { getTenantDutyConfig, resolveDutyMediator } from '../utils/dutyMediator';

// 获取工作台数据
export const getDashboardData = async (req: express.Request, res: express.Response) => {
  try {
    // 并行获取数据
    const [stats, pendingCases, notifications] = await Promise.all([
      getStatsData(req.user?.id, req.user?.role, req.user?.tenantId || null),
      getPendingCasesData(req.user?.id, req.user?.role, req.user?.tenantId || null),
      getNotificationsData(req.user?.id, req.user?.role, req.user?.tenantId || null)
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
    const stats = await getStatsData(req.user?.id, req.user?.role, req.user?.tenantId || null);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取待办事项
export const getPendingCases = async (req: express.Request, res: express.Response) => {
  try {
    const pendingCases = await getPendingCasesData(req.user?.id, req.user?.role, req.user?.tenantId || null);
    res.json({ cases: pendingCases });
  } catch (error) {
    console.error('获取待办事项错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取统计数据
const getStatsData = async (userId: string | undefined, role: string | undefined, tenantId?: string | null) => {
  // 获取案件统计
  const caseStats = await caseRepository.getStatistics(userId, role, tenantId);
  
  // 获取访客统计（仅管理员和调解员可见）
  let visitorStats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  if (role !== 'personal' && role !== 'company') {
    visitorStats = await visitorRecordRepository.getStatistics(role === 'mediator' ? userId : undefined, role === 'tenant_admin' ? tenantId : undefined);
  }
  
  // MySQL 驱动在某些情况下会把 COUNT/聚合字段返回为字符串（例如 "1"），
  // 直接用 + 会发生字符串拼接（例如 "1" + "0" => "10"），导致统计数异常。
  const toNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // 合并统计
  const total = toNum(caseStats.total) + toNum(visitorStats.total);
  const pendingCases = toNum(caseStats.pending) + toNum(visitorStats.pending);
  const processingCases = toNum(caseStats.processing) + toNum(visitorStats.processing);
  const completedCases = toNum(caseStats.completed) + toNum(visitorStats.completed);
  const failedCases = toNum(caseStats.failed) + toNum(visitorStats.failed);

  // 获取今日访客记录数（仅管理员和调解员可见）
  let todayVisitors = 0;
  if (role !== 'personal' && role !== 'company') {
    todayVisitors = await visitorRecordRepository.getTodayCount(role === 'mediator' ? userId : undefined, role === 'tenant_admin' ? tenantId : undefined);
  }

  // 统计 AI 使用量（仅调解员和管理员可见）
  let aiUsageCount = 0;
  
  if (role === 'mediator' || role === 'tenant_admin' || role === 'superadmin') {
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
    aiUsageCount
  };
};

// 获取待办事项
const getPendingCasesData = async (userId: string | undefined, role: string | undefined, tenantId?: string | null) => {
  // 获取待处理的案件
  const cases = await caseRepository.getPendingAndProcessing(userId, role, tenantId);
  
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
    const visitors = await visitorRecordRepository.getPendingAndProcessing(role === 'mediator' ? userId : undefined, role === 'tenant_admin' ? tenantId : undefined);
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
const getNotificationsData = async (userId: string | undefined, role: string | undefined, tenantId?: string | null) => {
  try {
    const notifications = {
      overdueCases: [] as { caseId?: string; caseNumber: string; days: number; message: string; action: string; recordType?: 'case' | 'visitor' }[],
      todaySchedule: [] as { time: string; title: string }[],
      todayConsultations: [] as { time: string; title: string; source: string }[],
      systemNotifications: [] as { title: string; message: string }[]
    };

    if (userId && (role === 'mediator' || role === 'tenant_admin' || role === 'superadmin')) {
      // 计算即将超期的案件
      const today = new Date();
      
      // 获取超期案件
      const overdueCases = await caseRepository.getOverdueCases(userId, 10, role, tenantId);
      overdueCases.forEach(caseObj => {
        const daysSinceCreated = Math.floor((today.getTime() - new Date(caseObj.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        notifications.overdueCases.push({
          caseId: caseObj.id,
          caseNumber: caseObj.caseNumber,
          days: daysSinceCreated,
          message: `已受理${daysSinceCreated}天，需确认双方调解意向`,
          action: '立即处理',
          recordType: 'case'
        });
      });
      
      // 获取超期访客记录
      const overdueVisitors = await visitorRecordRepository.getOverdueRecords(userId, 10, role === 'tenant_admin' ? tenantId : undefined);
      overdueVisitors.forEach(visitor => {
        const daysSinceCreated = Math.floor((today.getTime() - new Date(visitor.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        notifications.overdueCases.push({
          caseNumber: visitor.registerNumber,
          days: daysSinceCreated,
          message: `已登记${daysSinceCreated}天，需确认调解意向`,
          action: '立即处理',
          recordType: 'visitor'
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

      const dayStart = new Date(today);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const consultationParams: any[] = [dayStart, dayEnd];
      const consultationConditions = [
        'c.createdAt >= ?',
        'c.createdAt < ?',
        `(c.disputeType = '咨询' OR c.caseNumber LIKE 'CONSULT%')`
      ];

      if (role === 'mediator' && userId) {
        consultationConditions.push('c.mediatorId = ?');
        consultationParams.push(userId);
      } else if (role === 'tenant_admin' && tenantId) {
        consultationConditions.push('c.tenantId = ?');
        consultationParams.push(tenantId);
      }

      const [todayConsultationCases] = await pool.query(
        `SELECT c.id, c.caseNumber, c.createdAt, COALESCE(NULLIF(c.applicantDisplayName, ''), a.name, '用户') as applicantName
         FROM cases c
         LEFT JOIN users a ON c.applicantId = a.id
         WHERE ${consultationConditions.join(' AND ')}
         ORDER BY c.createdAt DESC
         LIMIT 10`,
        consultationParams
      );

      (todayConsultationCases as any[]).forEach((item) => {
        const createdAt = new Date(item.createdAt);
        const timeStr = createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        notifications.todayConsultations.push({
          time: `今日 ${timeStr}`,
          title: `${item.applicantName || '用户'} 提交了咨询 ${item.caseNumber ? `（${item.caseNumber}）` : ''}`.trim(),
          source: '小程序咨询'
        });
      });

      const visitorParams: any[] = [dayStart, dayEnd];
      const visitorConditions = [
        'vr.createdAt >= ?',
        'vr.createdAt < ?'
      ];

      if (role === 'mediator' && userId) {
        visitorConditions.push('vr.mediatorId = ?');
        visitorParams.push(userId);
      } else if (role === 'tenant_admin' && tenantId) {
        visitorConditions.push('vr.tenantId = ?');
        visitorParams.push(tenantId);
      }

      const [todayVisitorRecords] = await pool.query(
        `SELECT vr.id, vr.registerNumber, vr.createdAt, vr.visitorName, vr.visitType, vr.disputeType
         FROM visitor_records vr
         WHERE ${visitorConditions.join(' AND ')}
         ORDER BY vr.createdAt DESC
         LIMIT 10`,
        visitorParams
      );

      (todayVisitorRecords as any[]).forEach((item) => {
        const createdAt = new Date(item.createdAt);
        const timeStr = createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        notifications.todayConsultations.push({
          time: `今日 ${timeStr}`,
          title: `${item.visitorName || '来访人'} 完成了${item.visitType === 'phone' ? '电话' : '现场'}登记 ${item.registerNumber ? `（${item.registerNumber}）` : ''}`.trim(),
          source: 'PC端登记'
        });
      });

      notifications.todayConsultations.sort((a, b) => {
        const timeA = a.time.replace('今日 ', '');
        const timeB = b.time.replace('今日 ', '');
        return timeB.localeCompare(timeA);
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
      todayConsultations: [],
      systemNotifications: []
    };
  }
};

// 获取案件趋势数据
export const getCaseTrendData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role, tenantId } = req.user || {};
    const trendData = await caseRepository.getTrendData(id, role, tenantId || null);
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('获取案件趋势数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取案件类型分布数据
export const getCaseTypeData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role, tenantId } = req.user || {};
    const typeData = await caseRepository.getTypeDistribution(id, role, tenantId || null);
    res.json({ success: true, data: typeData });
  } catch (error) {
    console.error('获取案件类型数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取访客趋势数据
export const getVisitorTrendData = async (req: express.Request, res: express.Response) => {
  try {
    const { id, role, tenantId } = req.user || {};
    let visitorQueryUserId: string | undefined;
    let visitorQueryTenantId: string | undefined;
    
    // 仅调解员可见
    if (role === 'mediator') {
      visitorQueryUserId = id;
    } else if (role === 'tenant_admin') {
      visitorQueryTenantId = tenantId || undefined;
    }
    
    const trendData = await visitorRecordRepository.getTrendData(visitorQueryUserId, visitorQueryTenantId);
    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('获取访客趋势数据错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

export const getMediatorOverview = async (req: express.Request, res: express.Response) => {
  try {
    const { role, tenantId } = req.user || {};
    if (!role || !['tenant_admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ success: false, message: '无权限查看调解员分析' });
    }

    const params: any[] = [];
    const whereClauses = [`u.role = 'mediator'`];
    if (role === 'tenant_admin' && tenantId) {
      whereClauses.push('u.tenantId = ?');
      params.push(tenantId);
    }

    const [rows] = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.phone,
         u.officePhone,
         u.tenantId,
         t.tenantName,
         COUNT(c.id) as totalCases,
         SUM(CASE WHEN c.status = 'processing' THEN 1 ELSE 0 END) as processingCases,
         SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completedCases,
         SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) as failedCases,
         SUM(CASE WHEN c.status IN ('pending', 'processing') AND c.createdAt < DATE_SUB(NOW(), INTERVAL 10 DAY) THEN 1 ELSE 0 END) as overdueCases,
         AVG(CASE WHEN c.status = 'completed' AND c.closeTime IS NOT NULL THEN TIMESTAMPDIFF(HOUR, c.createdAt, c.closeTime) / 24 ELSE NULL END) as avgClosedDays,
         AVG(CASE WHEN first_progress.firstProgressAt IS NOT NULL THEN TIMESTAMPDIFF(HOUR, c.createdAt, first_progress.firstProgressAt) ELSE NULL END) as avgFirstResponseHours
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenantId
       LEFT JOIN cases c ON c.mediatorId = u.id
       LEFT JOIN (
         SELECT cp.caseId, MIN(cp.createdAt) as firstProgressAt
         FROM case_progress cp
         WHERE cp.type IN ('accept', 'mediate', 'close')
         GROUP BY cp.caseId
       ) first_progress ON first_progress.caseId = c.id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY u.id, u.name, u.phone, u.officePhone, u.tenantId, t.tenantName
       ORDER BY totalCases DESC, completedCases DESC, u.name ASC`,
      params
    );

    const mediators = (rows as any[]).map((item) => {
      const totalCases = Number(item.totalCases || 0);
      const completedCases = Number(item.completedCases || 0);
      const failedCases = Number(item.failedCases || 0);
      const closedCases = completedCases + failedCases;
      const overdueCases = Number(item.overdueCases || 0);
      return {
        id: item.id,
        name: item.name,
        phone: item.phone || item.officePhone || '',
        tenantId: item.tenantId,
        tenantName: item.tenantName || '',
        totalCases,
        processingCases: Number(item.processingCases || 0),
        completedCases,
        failedCases,
        overdueCases,
        avgClosedDays: Math.round(Number(item.avgClosedDays || 0)),
        avgFirstResponseHours: Math.round(Number(item.avgFirstResponseHours || 0)),
        successRate: closedCases ? Math.round((completedCases / closedCases) * 100) : 0,
        overdueRate: totalCases ? Math.round((overdueCases / totalCases) * 100) : 0
      };
    });

    res.json({ success: true, data: mediators });
  } catch (error) {
    console.error('获取调解员分析错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

export const getDutyOverview = async (req: express.Request, res: express.Response) => {
  try {
    const { role, tenantId } = req.user || {};
    if (!role || !['tenant_admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ success: false, message: '无权限查看值班总览' });
    }

    const tenantWhere = role === 'tenant_admin' && tenantId ? 'WHERE t.id = ?' : '';
    const params = tenantWhere ? [tenantId] : [];
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.tenantName,
         t.dutyUserIds,
         t.currentDutyUserId,
         t.allowAdminAsMediator,
         COUNT(CASE WHEN u.role = 'mediator' THEN 1 END) as mediatorCount
       FROM tenants t
       LEFT JOIN users u ON u.tenantId = t.id
       ${tenantWhere}
       GROUP BY t.id, t.tenantName, t.dutyUserIds, t.currentDutyUserId, t.allowAdminAsMediator
       ORDER BY t.tenantName ASC`,
      params
    );

    const overview = await Promise.all((rows as any[]).map(async (item) => {
      const config = await getTenantDutyConfig(item.id);
      const currentDutyAssignee = await resolveDutyMediator(item.id);
      return {
        tenantId: item.id,
        tenantName: item.tenantName,
        mediatorCount: Number(item.mediatorCount || 0),
        dutyRosterCount: config.dutyUserIds.length,
        currentDutyAssignee,
        allowAdminAsMediator: Boolean(item.allowAdminAsMediator ?? 1),
        hasGap: config.dutyUserIds.length === 0 || !currentDutyAssignee
      };
    }));

    res.json({ success: true, data: overview });
  } catch (error) {
    console.error('获取值班总览错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

export const getDutyStabilityRanking = async (req: express.Request, res: express.Response) => {
  try {
    const { role, tenantId } = req.user || {};
    if (!role || !['tenant_admin', 'superadmin'].includes(role)) {
      return res.status(403).json({ success: false, message: '无权限查看值班稳定度排行' });
    }

    const tenantWhere = role === 'tenant_admin' && tenantId ? 'WHERE t.id = ?' : '';
    const params = tenantWhere ? [tenantId] : [];
    const [rows] = await pool.query(
      `SELECT t.id, t.tenantName
       FROM tenants t
       ${tenantWhere}
       ORDER BY t.tenantName ASC`,
      params
    );

    const ranking = await Promise.all((rows as any[]).map(async (item) => {
      const config = await getTenantDutyConfig(item.id);
      const [statsRows] = await pool.query(
        `SELECT
           COUNT(*) AS totalAdjustments,
           SUM(CASE WHEN actionType = 'manual_override' THEN 1 ELSE 0 END) AS overrideCount,
           SUM(CASE WHEN actionType = 'advance_next' THEN 1 ELSE 0 END) AS advanceCount
         FROM duty_adjustment_logs
         WHERE tenantId = ?
           AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [item.id]
      );
      const stats = (statsRows as any[])[0] || {};
      const totalAdjustments = Number(stats.totalAdjustments || 0);
      const overrideCount = Number(stats.overrideCount || 0);
      const advanceCount = Number(stats.advanceCount || 0);

      const [overrideDateRows] = await pool.query(
        `SELECT DISTINCT effectiveDate
         FROM duty_adjustment_logs
         WHERE tenantId = ?
           AND actionType = 'manual_override'
           AND effectiveDate IS NOT NULL
           AND effectiveDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         ORDER BY effectiveDate DESC`,
        [item.id]
      );

      const overrideDates = new Set((overrideDateRows as any[]).map((row) => {
        const date = new Date(row.effectiveDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }));

      let consecutiveOverrideDays = 0;
      const cursor = new Date();
      while (true) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        const day = String(cursor.getDate()).padStart(2, '0');
        const key = `${year}-${month}-${day}`;
        if (overrideDates.has(key)) {
          consecutiveOverrideDays += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }

      const hasGap = config.dutyUserIds.length === 0;
      const rosterCount = config.dutyUserIds.length;
      const stabilityScore = Math.max(
        0,
        100
          - (hasGap ? 40 : 0)
          - (rosterCount < 2 ? 20 : 0)
          - overrideCount * 8
          - advanceCount * 5
          - consecutiveOverrideDays * 12
      );

      return {
        tenantId: item.id,
        tenantName: item.tenantName,
        rosterCount,
        hasGap,
        totalAdjustments,
        overrideCount,
        advanceCount,
        consecutiveOverrideDays,
        stabilityScore
      };
    }));

    ranking.sort((a, b) => a.stabilityScore - b.stabilityScore);
    res.json({ success: true, data: ranking });
  } catch (error) {
    console.error('获取值班稳定度排行错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};
