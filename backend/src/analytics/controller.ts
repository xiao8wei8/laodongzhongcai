import express from 'express';
import analyticsEventRepository from '../repositories/analyticsEventRepository';
import { v4 as uuidv4 } from 'uuid';

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
