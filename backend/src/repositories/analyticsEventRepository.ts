import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface AnalyticsEvent {
  id: string;
  eventType: string;
  eventData?: any;
  userId?: string;
  createdAt: Date;
}

interface AnalyticsEventWithData extends AnalyticsEvent {
  event?: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  timestamp?: number;
  sessionId?: string;
  page?: string;
  referrer?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  performance?: any;
  error?: any;
}

class AnalyticsEventRepository extends BaseRepository<AnalyticsEvent> {
  constructor() {
    super('analytics_events');
  }

  async findByEventType(eventType: string): Promise<AnalyticsEvent[]> {
    return await this.findByField('eventType', eventType);
  }

  async findByUser(userId: string): Promise<AnalyticsEvent[]> {
    return await this.findByField('userId', userId);
  }

  async findByDateRange(startDate?: Date, endDate?: Date, event?: string, category?: string, page?: string): Promise<AnalyticsEventWithData[]> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (startDate) {
      whereClause += ' AND createdAt >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += ' AND createdAt <= ?';
      params.push(endDate);
    }
    
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY createdAt DESC LIMIT 1000`,
      params
    );
    
    // 将 eventData JSON 解析为对象属性
    const events = (rows as any[]).map(row => {
      const eventData = row.eventData ? JSON.parse(row.eventData) : {};
      return {
        ...row,
        ...eventData
      };
    });
    
    // 应用额外的过滤条件
    return events.filter(event => {
      if (event && event.event !== event) return false;
      if (category && event.category !== category) return false;
      if (page && event.page !== page) return false;
      return true;
    });
  }

  async countByEventType(eventType: string): Promise<number> {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE eventType = ?`,
      [eventType]
    );
    return (rows as any)[0].count;
  }

  async getEventStatistics(startDate: Date, endDate: Date): Promise<any> {
    const [rows] = await pool.query(
      `SELECT eventType, COUNT(*) as count 
       FROM ${this.tableName} 
       WHERE createdAt >= ? AND createdAt <= ? 
       GROUP BY eventType 
       ORDER BY count DESC`,
      [startDate, endDate]
    );
    return rows;
  }

  async getDailyStatistics(startDate: Date, endDate: Date): Promise<any> {
    const [rows] = await pool.query(
      `SELECT DATE(createdAt) as date, COUNT(*) as count 
       FROM ${this.tableName} 
       WHERE createdAt >= ? AND createdAt <= ? 
       GROUP BY DATE(createdAt) 
       ORDER BY date ASC`,
      [startDate, endDate]
    );
    return rows;
  }

  async getPageStats(): Promise<any[]> {
    const events = await this.findByEventType('page_view');
    const pageMap = new Map<string, { count: number; loadTimes: number[] }>();
    
    events.forEach(event => {
      const eventData = event.eventData ? JSON.parse(event.eventData as any) : {};
      const page = eventData.page || 'unknown';
      
      if (!pageMap.has(page)) {
        pageMap.set(page, { count: 0, loadTimes: [] });
      }
      
      const pageStats = pageMap.get(page)!;
      pageStats.count++;
      
      if (eventData.performance?.loadTime) {
        pageStats.loadTimes.push(eventData.performance.loadTime);
      }
    });
    
    return Array.from(pageMap.entries()).map(([page, stats]) => ({
      _id: page,
      count: stats.count,
      averageLoadTime: stats.loadTimes.length > 0 
        ? stats.loadTimes.reduce((sum, time) => sum + time, 0) / stats.loadTimes.length 
        : 0
    })).sort((a, b) => b.count - a.count);
  }

  async getErrorStats(): Promise<any[]> {
    const events = await this.findByEventType('error');
    const errorMap = new Map<string, { count: number; lastOccurred: number }>();
    
    events.forEach(event => {
      const eventData = event.eventData ? JSON.parse(event.eventData as any) : {};
      const message = eventData.error?.message || 'unknown';
      const timestamp = eventData.timestamp || event.createdAt.getTime();
      
      if (!errorMap.has(message)) {
        errorMap.set(message, { count: 0, lastOccurred: 0 });
      }
      
      const errorStats = errorMap.get(message)!;
      errorStats.count++;
      if (timestamp > errorStats.lastOccurred) {
        errorStats.lastOccurred = timestamp;
      }
    });
    
    return Array.from(errorMap.entries()).map(([message, stats]) => ({
      _id: message,
      count: stats.count,
      lastOccurred: stats.lastOccurred
    })).sort((a, b) => b.count - a.count);
  }

  async trackEvent(eventType: string, eventData: any, userId?: string): Promise<AnalyticsEvent> {
    return await this.create({
      id: (eventData as any)?.id || undefined,
      eventType,
      eventData: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
      userId,
      createdAt: new Date()
    } as any);
  }

  async trackEvents(events: any[]): Promise<number> {
    let count = 0;
    for (const eventData of events) {
      await this.trackEvent(eventData.event || 'unknown', eventData, eventData.userId);
      count++;
    }
    return count;
  }

  async deleteOldEvents(days: number = 90): Promise<boolean> {
    const [result] = await pool.query(
      `DELETE FROM ${this.tableName} WHERE createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [days]
    );
    return (result as any).affectedRows > 0;
  }
}

export default new AnalyticsEventRepository();
export { AnalyticsEvent, AnalyticsEventWithData };
