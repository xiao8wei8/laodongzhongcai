import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface VisitorRecord {
  id: string;
  registerNumber: string;
  visitorName: string;
  phone: string;
  street?: string | null;
  visitType: 'visit' | 'phone';
  disputeType?: string;
  reason: string;
  mediatorId?: string;
  tenantId?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

interface VisitorRecordWithRelations extends VisitorRecord {
  mediatorName?: string;
  mediatorPhone?: string;
}

class VisitorRecordRepository extends BaseRepository<VisitorRecord> {
  constructor() {
    super('visitor_records');
  }

  async findByRegisterNumber(registerNumber: string): Promise<VisitorRecord | null> {
    return await this.findOneByField('registerNumber', registerNumber);
  }

  async findByPhone(phone: string): Promise<VisitorRecord[]> {
    return await this.findByField('phone', phone);
  }

  async findByMediator(mediatorId: string): Promise<VisitorRecord[]> {
    return await this.findByField('mediatorId', mediatorId);
  }

  async findByStatus(status: string): Promise<VisitorRecord[]> {
    return await this.findByField('status', status);
  }

  async findWithRelations(id: string): Promise<VisitorRecordWithRelations | null> {
    const [rows] = await pool.query(
      `SELECT vr.*, u.name as mediatorName, COALESCE(u.phone, u.officePhone) as mediatorPhone
       FROM ${this.tableName} vr 
       LEFT JOIN users u ON vr.mediatorId = u.id 
       WHERE vr.id = ?`,
      [id]
    );
    const results = rows as any[];
    return results[0] || null;
  }

  async findAllWithRelations(tenantId?: string | null): Promise<VisitorRecordWithRelations[]> {
    const whereClause = tenantId ? 'WHERE vr.tenantId = ?' : '';
    const [rows] = await pool.query(
      `SELECT vr.*, u.name as mediatorName, COALESCE(u.phone, u.officePhone) as mediatorPhone
       FROM ${this.tableName} vr 
       LEFT JOIN users u ON vr.mediatorId = u.id 
       ${whereClause}
       ORDER BY vr.createdAt DESC`
      ,
      tenantId ? [tenantId] : []
    );
    return rows as VisitorRecordWithRelations[];
  }

  async searchRecords(query: string, tenantId?: string | null): Promise<VisitorRecordWithRelations[]> {
    const whereClause = tenantId
      ? 'WHERE (vr.visitorName LIKE ? OR vr.phone LIKE ? OR vr.registerNumber LIKE ?) AND vr.tenantId = ?'
      : 'WHERE vr.visitorName LIKE ? OR vr.phone LIKE ? OR vr.registerNumber LIKE ?';
    const [rows] = await pool.query(
      `SELECT vr.*, u.name as mediatorName, COALESCE(u.phone, u.officePhone) as mediatorPhone
       FROM ${this.tableName} vr 
       LEFT JOIN users u ON vr.mediatorId = u.id 
       ${whereClause}
       ORDER BY vr.createdAt DESC`,
      tenantId ? [`%${query}%`, `%${query}%`, `%${query}%`, tenantId] : [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    return rows as VisitorRecordWithRelations[];
  }

  async paginateRecords(page: number = 1, limit: number = 10, status?: string, tenantId?: string | null): Promise<{ records: VisitorRecordWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE vr.status = ?';
      params.push(status);
    }
    if (tenantId) {
      whereClause += whereClause ? ' AND vr.tenantId = ?' : 'WHERE vr.tenantId = ?';
      params.push(tenantId);
    }

    const [rows] = await pool.query(
      `SELECT vr.*, u.name as mediatorName, COALESCE(u.phone, u.officePhone) as mediatorPhone
       FROM ${this.tableName} vr 
       LEFT JOIN users u ON vr.mediatorId = u.id 
       ${whereClause}
       ORDER BY vr.createdAt DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} vr ${whereClause}`,
      params
    );

    return {
      records: rows as VisitorRecordWithRelations[],
      total: (countResult as any)[0].total
    };
  }

  async getStatistics(mediatorId?: string, tenantId?: string | null): Promise<any> {
    let whereClause = '';
    const params: any[] = [];

    if (mediatorId) {
      whereClause = 'WHERE mediatorId = ?';
      params.push(mediatorId);
    } else if (tenantId) {
      whereClause = 'WHERE tenantId = ?';
      params.push(tenantId);
    }

    const [result] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM ${this.tableName}
      ${whereClause}
    `, params);
    return (result as any)[0];
  }

  async getTodayCount(mediatorId?: string, tenantId?: string | null): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let whereClause = 'WHERE createdAt >= ? AND createdAt < ?';
    const params: any[] = [today, tomorrow];

    if (mediatorId) {
      whereClause = 'WHERE mediatorId = ? AND createdAt >= ? AND createdAt < ?';
      params.unshift(mediatorId);
    } else if (tenantId) {
      whereClause = 'WHERE tenantId = ? AND createdAt >= ? AND createdAt < ?';
      params.unshift(tenantId);
    }

    const [result] = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
      params
    );
    return (result as any)[0].count;
  }

  async getTrendData(mediatorId?: string, tenantId?: string | null): Promise<any[]> {
    let whereClause = '';
    const params: any[] = [];

    if (mediatorId) {
      whereClause = 'WHERE mediatorId = ?';
      params.push(mediatorId);
    } else if (tenantId) {
      whereClause = 'WHERE tenantId = ?';
      params.push(tenantId);
    }

    const now = new Date();
    const trendData = [];

    // 生成过去12个月的数据
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
      
      const monthParams = [...params, monthDate, nextMonth];
      const [result] = await pool.query(`
        SELECT COUNT(*) as count FROM ${this.tableName}
        ${whereClause ? whereClause + ' AND' : 'WHERE'} createdAt >= ? AND createdAt < ?
      `, monthParams);
      
      const count = (result as any)[0].count;
      const monthName = `${monthDate.getMonth() + 1}月`;
      trendData.push({ month: monthName, count });
    }

    return trendData;
  }

  async getPendingAndProcessing(mediatorId?: string, tenantId?: string | null): Promise<VisitorRecordWithRelations[]> {
    let whereClause = 'WHERE status IN (?, ?)';
    const params: any[] = ['pending', 'processing'];

    if (mediatorId) {
      whereClause = 'WHERE vr.mediatorId = ? AND vr.status IN (?, ?)';
      params.unshift(mediatorId);
    } else if (tenantId) {
      whereClause = 'WHERE vr.tenantId = ? AND vr.status IN (?, ?)';
      params.unshift(tenantId);
    }

    const [rows] = await pool.query(
      `SELECT vr.*, u.name as mediatorName 
       FROM ${this.tableName} vr 
       LEFT JOIN users u ON vr.mediatorId = u.id 
       ${whereClause}
       ORDER BY vr.createdAt DESC
       LIMIT 10`,
      params
    );
    return rows as VisitorRecordWithRelations[];
  }

  async getOverdueRecords(userId: string, days: number = 10, tenantId?: string | null): Promise<VisitorRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} 
       WHERE ${tenantId ? 'tenantId = ?' : 'mediatorId = ?'}
       AND createdAt < ?
       ORDER BY createdAt ASC`,
      [tenantId || userId, cutoffDate]
    );
    return rows as VisitorRecord[];
  }
}

export default new VisitorRecordRepository();
export { VisitorRecord, VisitorRecordWithRelations };
