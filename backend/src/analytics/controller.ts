import express from 'express';
import analyticsEventRepository from '../repositories/analyticsEventRepository';
import operationLogRepository from '../repositories/operationLogRepository';

const resolveDateRange = (date?: string) => {
  const target = date ? new Date(date) : new Date();
  if (Number.isNaN(target.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: today, end: tomorrow };
  }
  target.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setDate(end.getDate() + 1);
  return { start: target, end };
};

// 接收埋点数据
export const trackEvents = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({ success: false, message: 'Events must be an array' });
      }
      
      // 保存事件到数据库
      const count = await analyticsEventRepository.trackEvents(events);
      
      res.json({ success: true, message: 'Events tracked successfully', count });
    } catch (error) {
      console.error('Track events error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];

// 获取分析数据
export const getAnalyticsData = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { startDate, endDate, event, category, page } = req.query;
      
      let start: Date | undefined;
      let end: Date | undefined;
      
      if (startDate) {
        start = new Date(startDate as string);
      }
      
      if (endDate) {
        end = new Date(endDate as string);
      }
      
      const events = await analyticsEventRepository.findByDateRange(
        start,
        end,
        event as string,
        category as string,
        page as string
      );
      
      // 统计数据
      const performanceEvents = events.filter(e => e.performance?.loadTime);
      const stats = {
        totalEvents: events.length,
        pageViews: events.filter(e => e.event === 'page_view').length,
        clicks: events.filter(e => e.event === 'click').length,
        errors: events.filter(e => e.event === 'error').length,
        averageLoadTime: performanceEvents.length > 0 
          ? performanceEvents.reduce((sum, e) => sum + (e.performance?.loadTime || 0), 0) / performanceEvents.length 
          : 0
      };
      
      res.json({ success: true, data: events, stats });
    } catch (error) {
      console.error('Get analytics data error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];

// 获取页面访问统计
export const getPageStats = [
  async (req: express.Request, res: express.Response) => {
    try {
      const pageStats = await analyticsEventRepository.getPageStats();
      
      res.json({ success: true, data: pageStats });
    } catch (error) {
      console.error('Get page stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];

// 获取错误统计
export const getErrorStats = [
  async (req: express.Request, res: express.Response) => {
    try {
      const errorStats = await analyticsEventRepository.getErrorStats();
      
      res.json({ success: true, data: errorStats });
    } catch (error) {
      console.error('Get error stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];

export const getAccessUsers = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { date, keyword, clientType } = req.query;
      const { start, end } = resolveDateRange(date as string | undefined);
      const events = await analyticsEventRepository.findByDateRange(start, end);
      const accessEvents = events.filter((event: any) =>
        ['login_success', 'page_view', 'heartbeat', 'logout'].includes(event.eventType || event.event)
      );

      const filteredEvents = accessEvents.filter((event: any) => {
        const normalizedClientType = String(clientType || '').trim();
        if (normalizedClientType && String(event.clientType || '') !== normalizedClientType) {
          return false;
        }
        const normalizedKeyword = String(keyword || '').trim().toLowerCase();
        if (!normalizedKeyword) return true;
        return [
          event.username,
          event.role,
          event.page,
          event.clientType,
          event.ip
        ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword));
      });

      const userMap = new Map<string, any>();
      filteredEvents.forEach((event: any) => {
        const key = String(event.userId || event.sessionId || event.username || 'anonymous');
        const prev = userMap.get(key) || {
          key,
          userId: event.userId || null,
          username: event.username || '匿名用户',
          role: event.role || '-',
          tenantId: event.tenantId || null,
          clientType: event.clientType || '-',
          loginAt: event.event === 'login_success' ? event.createdAt : null,
          lastActiveAt: event.createdAt,
          visitCount: 0,
          pageViewCount: 0,
          ip: event.ip || ''
        };

        prev.visitCount += 1;
        if (event.event === 'page_view') prev.pageViewCount += 1;
        if (!prev.loginAt && event.event === 'login_success') prev.loginAt = event.createdAt;
        if (new Date(event.createdAt).getTime() > new Date(prev.lastActiveAt).getTime()) {
          prev.lastActiveAt = event.createdAt;
          prev.ip = event.ip || prev.ip;
        }

        userMap.set(key, prev);
      });

      const users = Array.from(userMap.values()).sort(
        (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
      );

      const sourceSummary = users.reduce((acc: any, item: any) => {
        const key = item.clientType || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        data: {
          summary: {
            totalUsers: users.length,
            loginCount: filteredEvents.filter((event: any) => event.event === 'login_success').length,
            pageViewCount: filteredEvents.filter((event: any) => event.event === 'page_view').length,
            heartbeatCount: filteredEvents.filter((event: any) => event.event === 'heartbeat').length,
            pcAdminUsers: sourceSummary.pc_admin || 0,
            miniProgramUsers: sourceSummary.mini_program || 0
          },
          users,
          logs: filteredEvents
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 200)
        }
      });
    } catch (error) {
      console.error('Get access users error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];

export const getOperationLogs = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { keyword, module, action, result, date } = req.query;
      const { start, end } = resolveDateRange(date as string | undefined);
      const logs = await operationLogRepository.findPaged({
        keyword: keyword as string | undefined,
        module: module as string | undefined,
        action: action as string | undefined,
        result: result as string | undefined,
        startDate: start.toISOString().slice(0, 19).replace('T', ' '),
        endDate: end.toISOString().slice(0, 19).replace('T', ' '),
        limit: 200
      });
      const summary = await operationLogRepository.getTodaySummary();

      res.json({
        success: true,
        data: {
          summary,
          logs
        }
      });
    } catch (error) {
      console.error('Get operation logs error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];
