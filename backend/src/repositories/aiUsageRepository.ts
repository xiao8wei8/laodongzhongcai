import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface AiUsage {
  id: string;
  userId?: string;
  caseId?: string;
  serviceType: string;
  requestData?: any;
  responseData?: any;
  tokensUsed?: number;
  cost?: number;
  createdAt: Date;
}

class AiUsageRepository extends BaseRepository<AiUsage> {
  constructor() {
    super('ai_usages');
  }

  async findByUser(userId: string): Promise<AiUsage[]> {
    return await this.findByField('userId', userId);
  }

  async findByCase(caseId: string): Promise<AiUsage[]> {
    return await this.findByField('caseId', caseId);
  }

  async findByServiceType(serviceType: string): Promise<AiUsage[]> {
    return await this.findByField('serviceType', serviceType);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AiUsage[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE createdAt >= ? AND createdAt <= ? ORDER BY createdAt DESC`,
      [startDate, endDate]
    );
    return rows as AiUsage[];
  }

  async getUsageStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    let query = `SELECT 
      COUNT(*) as totalRequests,
      SUM(tokensUsed) as totalTokens,
      SUM(cost) as totalCost,
      AVG(tokensUsed) as avgTokens,
      AVG(cost) as avgCost
    FROM ${this.tableName}`;
    
    const params: any[] = [];
    
    if (startDate && endDate) {
      query += ` WHERE createdAt >= ? AND createdAt <= ?`;
      params.push(startDate, endDate);
    }
    
    const [rows] = await pool.query(query, params);
    return (rows as any[])[0];
  }

  async getUsageByServiceType(startDate?: Date, endDate?: Date): Promise<any> {
    let query = `SELECT 
      serviceType,
      COUNT(*) as count,
      SUM(tokensUsed) as totalTokens,
      SUM(cost) as totalCost
    FROM ${this.tableName}`;
    
    const params: any[] = [];
    
    if (startDate && endDate) {
      query += ` WHERE createdAt >= ? AND createdAt <= ?`;
      params.push(startDate, endDate);
    }
    
    query += ` GROUP BY serviceType ORDER BY count DESC`;
    
    const [rows] = await pool.query(query, params);
    return rows;
  }

  async getUsageByUser(startDate?: Date, endDate?: Date): Promise<any> {
    let query = `SELECT 
      userId,
      COUNT(*) as count,
      SUM(tokensUsed) as totalTokens,
      SUM(cost) as totalCost
    FROM ${this.tableName}`;
    
    const params: any[] = [];
    
    if (startDate && endDate) {
      query += ` WHERE createdAt >= ? AND createdAt <= ?`;
      params.push(startDate, endDate);
    }
    
    query += ` GROUP BY userId ORDER BY count DESC`;
    
    const [rows] = await pool.query(query, params);
    return rows;
  }

  async recordUsage(
    serviceType: string, 
    requestData: any, 
    responseData: any, 
    tokensUsed: number, 
    cost: number,
    userId?: string,
    caseId?: string
  ): Promise<AiUsage> {
    return await this.create({
      userId,
      caseId,
      serviceType,
      requestData: JSON.stringify(requestData),
      responseData: JSON.stringify(responseData),
      tokensUsed,
      cost
    } as any);
  }
}

export default new AiUsageRepository();
export { AiUsage };
