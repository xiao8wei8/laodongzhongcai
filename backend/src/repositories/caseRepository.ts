import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Case {
  id: string;
  caseNumber: string;
  applicantId: string;
  respondentId: string;
  disputeType: string;
  caseAmount?: number;
  requestItems: string;
  factsReasons: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  mediatorId?: string;
  closeTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CaseWithRelations extends Case {
  applicantName?: string;
  respondentName?: string;
  mediatorName?: string;
}

class CaseRepository extends BaseRepository<Case> {
  constructor() {
    super('cases');
  }

  async findByCaseNumber(caseNumber: string): Promise<Case | null> {
    return await this.findOneByField('caseNumber', caseNumber);
  }

  async findByMediator(mediatorId: string): Promise<Case[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE mediatorId = ? ORDER BY createdAt DESC`,
      [mediatorId]
    );
    return rows as Case[];
  }

  async findByStatus(status: string): Promise<Case[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE status = ? ORDER BY createdAt DESC`,
      [status]
    );
    return rows as Case[];
  }

  async findWithRelations(caseId: string): Promise<CaseWithRelations | null> {
    const [rows] = await pool.query(
      `SELECT 
        c.*,
        a.name as applicantName, a.username as applicantUsername,
        r.name as respondentName, r.username as respondentUsername,
        m.name as mediatorName, m.username as mediatorUsername
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      WHERE c.id = ?`,
      [caseId]
    );
    const results = rows as any[];
    return results[0] || null;
  }

  async findAllWithRelations(status?: string, mediatorId?: string): Promise<CaseWithRelations[]> {
    let whereClause = '';
    const params: any[] = [];

    if (status && mediatorId) {
      whereClause = 'WHERE c.status = ? AND c.mediatorId = ?';
      params.push(status, mediatorId);
    } else if (status) {
      whereClause = 'WHERE c.status = ?';
      params.push(status);
    } else if (mediatorId) {
      whereClause = 'WHERE c.mediatorId = ?';
      params.push(mediatorId);
    }

    const [rows] = await pool.query(
      `SELECT 
        c.*,
        a.name as applicantName,
        r.name as respondentName,
        m.name as mediatorName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      ${whereClause}
      ORDER BY c.createdAt DESC`,
      params
    );
    return rows as CaseWithRelations[];
  }

  async assignMediator(caseId: string, mediatorId: string): Promise<Case | null> {
    return await this.update(caseId, {
      mediatorId,
      status: 'processing'
    });
  }

  async closeCase(caseId: string, closeTime: Date = new Date()): Promise<Case | null> {
    return await this.update(caseId, {
      status: 'completed',
      closeTime
    });
  }

  async searchCases(query: string): Promise<CaseWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT 
        c.*,
        a.name as applicantName,
        r.name as respondentName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      WHERE c.caseNumber LIKE ? OR a.name LIKE ? OR r.name LIKE ?
      ORDER BY c.createdAt DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    return rows as CaseWithRelations[];
  }

  async paginateCases(page: number = 1, limit: number = 10, status?: string): Promise<{ cases: CaseWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE c.status = ?';
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT 
        c.*,
        a.name as applicantName,
        r.name as respondentName,
        m.name as mediatorName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      ${whereClause}
      ORDER BY c.createdAt DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} c ${whereClause}`,
      params
    );

    return {
      cases: rows as CaseWithRelations[],
      total: (countResult as any)[0].total
    };
  }

  async getStatistics(userId?: string, role?: string): Promise<any> {
    let whereClause = '';
    const params: any[] = [];

    if (role === 'personal' || role === 'company') {
      if (userId) {
        whereClause = 'WHERE applicantId = ? OR respondentId = ?';
        params.push(userId, userId);
      }
    } else if (role === 'mediator') {
      if (userId) {
        whereClause = 'WHERE mediatorId = ?';
        params.push(userId);
      }
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

  async getTrendData(userId?: string, role?: string): Promise<any[]> {
    let whereClause = '';
    const params: any[] = [];

    if (role === 'personal' || role === 'company') {
      if (userId) {
        whereClause = 'WHERE applicantId = ? OR respondentId = ?';
        params.push(userId, userId);
      }
    } else if (role === 'mediator') {
      if (userId) {
        whereClause = 'WHERE mediatorId = ?';
        params.push(userId);
      }
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

  async getTypeDistribution(userId?: string, role?: string): Promise<any[]> {
    let whereClause = '';
    const params: any[] = [];

    if (role === 'personal' || role === 'company') {
      if (userId) {
        whereClause = 'WHERE applicantId = ? OR respondentId = ?';
        params.push(userId, userId);
      }
    } else if (role === 'mediator') {
      if (userId) {
        whereClause = 'WHERE mediatorId = ?';
        params.push(userId);
      }
    }

    const [result] = await pool.query(`
      SELECT 
        disputeType as name,
        COUNT(*) as value
      FROM ${this.tableName}
      ${whereClause}
      GROUP BY disputeType
      ORDER BY value DESC
    `, params);
    
    const data = result as any[];
    return data.map(item => ({
      name: item.name || '其他',
      value: item.value
    }));
  }

  async getPendingAndProcessing(userId?: string, role?: string): Promise<CaseWithRelations[]> {
    let whereClause = 'WHERE status IN (?, ?)';
    const params: any[] = ['pending', 'processing'];

    if (role === 'personal' || role === 'company') {
      if (userId) {
        whereClause = 'WHERE (applicantId = ? OR respondentId = ?) AND status IN (?, ?)';
        params.unshift(userId, userId);
      }
    } else if (role === 'mediator') {
      if (userId) {
        whereClause = 'WHERE mediatorId = ? AND status IN (?, ?)';
        params.unshift(userId);
      }
    }

    const [rows] = await pool.query(
      `SELECT 
        c.*,
        a.name as applicantName,
        r.name as respondentName,
        m.name as mediatorName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      ${whereClause}
      ORDER BY c.createdAt DESC
      LIMIT 10`,
      params
    );
    return rows as CaseWithRelations[];
  }

  async getOverdueCases(mediatorId: string, days: number = 10): Promise<Case[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} 
       WHERE mediatorId = ? 
       AND (status = 'pending' OR status = 'processing')
       AND createdAt < ?
       ORDER BY createdAt ASC`,
      [mediatorId, cutoffDate]
    );
    return rows as Case[];
  }
}

export default new CaseRepository();
export { Case, CaseWithRelations };
