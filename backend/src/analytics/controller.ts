import express from 'express';
import mongoose from 'mongoose';

// 分析事件模型
interface AnalyticsEvent {
  event: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  userId?: string;
  sessionId: string;
  page: string;
  referrer: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  performance?: {
    loadTime: number;
    domContentLoaded: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
  error?: {
    message: string;
    stack: string;
    url: string;
    line: number;
    column: number;
  };
  createdAt: Date;
}

// 创建分析事件集合
const AnalyticsEventModel = mongoose.model<AnalyticsEvent>('AnalyticsEvent', new mongoose.Schema({
  event: String,
  category: String,
  action: String,
  label: String,
  value: Number,
  timestamp: Number,
  userId: String,
  sessionId: String,
  page: String,
  referrer: String,
  userAgent: String,
  screenWidth: Number,
  screenHeight: Number,
  performance: {
    loadTime: Number,
    domContentLoaded: Number,
    firstPaint: Number,
    firstContentfulPaint: Number
  },
  error: {
    message: String,
    stack: String,
    url: String,
    line: Number,
    column: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}));

// 接收埋点数据
export const trackEvents = [
  async (req: express.Request, res: express.Response) => {
    try {
      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({ success: false, message: 'Events must be an array' });
      }
      
      // 保存事件到数据库
      const savedEvents = await AnalyticsEventModel.insertMany(events);
      
      res.json({ success: true, message: 'Events tracked successfully', count: savedEvents.length });
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
      
      const query: any = {};
      
      if (startDate) {
        query.timestamp = { $gte: new Date(startDate as string).getTime() };
      }
      
      if (endDate) {
        query.timestamp = { 
          ...query.timestamp, 
          $lte: new Date(endDate as string).getTime() 
        };
      }
      
      if (event) {
        query.event = event;
      }
      
      if (category) {
        query.category = category;
      }
      
      if (page) {
        query.page = page;
      }
      
      const events = await AnalyticsEventModel.find(query)
        .sort({ timestamp: -1 })
        .limit(1000);
      
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
      const pageStats = await AnalyticsEventModel.aggregate([
        { $match: { event: 'page_view' } },
        { $group: { 
          _id: '$page', 
          count: { $sum: 1 },
          averageLoadTime: { $avg: '$performance.loadTime' }
        } },
        { $sort: { count: -1 } }
      ]);
      
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
      const errorStats = await AnalyticsEventModel.aggregate([
        { $match: { event: 'error' } },
        { $group: { 
          _id: '$error.message', 
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' }
        } },
        { $sort: { count: -1 } }
      ]);
      
      res.json({ success: true, data: errorStats });
    } catch (error) {
      console.error('Get error stats error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
];
