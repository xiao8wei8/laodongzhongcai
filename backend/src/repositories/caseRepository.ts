import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Case {
  id: string;
  caseNumber: string;
  applicantId: string;
  respondentId: string;
  applicantDisplayName?: string;
  respondentDisplayName?: string;
  applicantPhone?: string;
  respondentPhone?: string;
  disputeType: string;
  caseAmount?: number;
  requestItems: string;
  factsReasons: string;
  tenantId?: string | null;
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
  mediatorPhone?: string;
  latestProgress?: string;
  latestProgressAt?: Date;
  tenantName?: string | null;
  districtName?: string | null;
  streetName?: string | null;
}

interface MediatorAnalysisSummary {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  overdue: number;
  avgClosedDays: number;
  avgFirstResponseHours: number;
  successRate: number;
  overdueRate: number;
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
        a.name as applicantName, a.username as applicantUsername, a.phone as applicantUserPhone, a.role as applicantRole,
        r.name as respondentName, r.username as respondentUsername, r.phone as respondentUserPhone, r.role as respondentRole,
        m.name as mediatorName, m.username as mediatorUsername, COALESCE(m.phone, m.officePhone) as mediatorUserPhone, m.role as mediatorRole,
        t.tenantName, t.districtName, t.streetName,
        latestProgress.content as latestProgress,
        latestProgress.createdAt as latestProgressAt,
        COALESCE(NULLIF(c.applicantDisplayName, ''), a.name) as resolvedApplicantDisplayName,
        COALESCE(NULLIF(c.respondentDisplayName, ''), r.name) as resolvedRespondentDisplayName,
        COALESCE(NULLIF(c.applicantPhone, ''), a.phone) as resolvedApplicantPhone,
        COALESCE(NULLIF(c.respondentPhone, ''), r.phone) as resolvedRespondentPhone
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      LEFT JOIN tenants t ON c.tenantId = t.id
      LEFT JOIN case_progress latestProgress ON latestProgress.id = (
        SELECT cp.id
        FROM case_progress cp
        WHERE cp.caseId = c.id
        ORDER BY cp.createdAt DESC
        LIMIT 1
      )
      WHERE c.id = ?`,
      [caseId]
    );
    const results = rows as any[];
    return results[0] || null;
  }

  async findAllWithRelations(status?: string, mediatorId?: string, tenantId?: string | null): Promise<CaseWithRelations[]> {
    let whereClause = '';
    const params: any[] = [];

    const clauses: string[] = [];
    if (status) {
      clauses.push('c.status = ?');
      params.push(status);
    }
    if (mediatorId) {
      clauses.push('c.mediatorId = ?');
      params.push(mediatorId);
    }
    if (tenantId) {
      clauses.push('c.tenantId = ?');
      params.push(tenantId);
    }
    whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT 
        c.*,
        COALESCE(NULLIF(c.applicantDisplayName, ''), a.name) as applicantName,
        COALESCE(NULLIF(c.applicantPhone, ''), a.phone) as applicantPhone,
        COALESCE(NULLIF(c.respondentDisplayName, ''), r.name) as respondentName,
        COALESCE(NULLIF(c.respondentPhone, ''), r.phone) as respondentPhone,
        m.name as mediatorName,
        COALESCE(m.phone, m.officePhone) as mediatorPhone,
        latestProgress.content as latestProgress,
        latestProgress.createdAt as latestProgressAt,
        t.tenantName, t.districtName, t.streetName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      LEFT JOIN tenants t ON c.tenantId = t.id
      LEFT JOIN case_progress latestProgress ON latestProgress.id = (
        SELECT cp.id
        FROM case_progress cp
        WHERE cp.caseId = c.id
        ORDER BY cp.createdAt DESC
        LIMIT 1
      )
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
        COALESCE(NULLIF(c.applicantDisplayName, ''), a.name) as applicantName,
        COALESCE(NULLIF(c.respondentDisplayName, ''), r.name) as respondentName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      WHERE c.caseNumber LIKE ? OR a.name LIKE ? OR r.name LIKE ?
      ORDER BY c.createdAt DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    return rows as CaseWithRelations[];
  }

  async paginateCases(page: number = 1, limit: number = 10, status?: string, tenantId?: string | null): Promise<{ cases: CaseWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE c.status = ?';
      params.push(status);
    }
    if (tenantId) {
      whereClause += whereClause ? ' AND c.tenantId = ?' : 'WHERE c.tenantId = ?';
      params.push(tenantId);
    }

    const [rows] = await pool.query(
      `SELECT 
        c.*,
        COALESCE(NULLIF(c.applicantDisplayName, ''), a.name) as applicantName,
        COALESCE(NULLIF(c.applicantPhone, ''), a.phone) as applicantPhone,
        COALESCE(NULLIF(c.respondentDisplayName, ''), r.name) as respondentName,
        COALESCE(NULLIF(c.respondentPhone, ''), r.phone) as respondentPhone,
        m.name as mediatorName,
        COALESCE(m.phone, m.officePhone) as mediatorPhone,
        latestProgress.content as latestProgress,
        latestProgress.createdAt as latestProgressAt,
        t.tenantName, t.districtName, t.streetName
      FROM ${this.tableName} c
      LEFT JOIN users a ON c.applicantId = a.id
      LEFT JOIN users r ON c.respondentId = r.id
      LEFT JOIN users m ON c.mediatorId = m.id
      LEFT JOIN tenants t ON c.tenantId = t.id
      LEFT JOIN case_progress latestProgress ON latestProgress.id = (
        SELECT cp.id
        FROM case_progress cp
        WHERE cp.caseId = c.id
        ORDER BY cp.createdAt DESC
        LIMIT 1
      )
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

  async getStatistics(userId?: string, role?: string, tenantId?: string | null): Promise<any> {
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
    } else if (role === 'tenant_admin' && tenantId) {
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

  async getTrendData(userId?: string, role?: string, tenantId?: string | null): Promise<any[]> {
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
    } else if (role === 'tenant_admin' && tenantId) {
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

  async getTypeDistribution(userId?: string, role?: string, tenantId?: string | null): Promise<any[]> {
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
    } else if (role === 'tenant_admin' && tenantId) {
      whereClause = 'WHERE tenantId = ?';
      params.push(tenantId);
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

  async getPendingAndProcessing(userId?: string, role?: string, tenantId?: string | null): Promise<CaseWithRelations[]> {
    let whereClause = 'WHERE status IN (?, ?)';
    const params: any[] = ['pending', 'processing'];

    if (role === 'personal' || role === 'company') {
      if (userId) {
        whereClause = 'WHERE (c.applicantId = ? OR c.respondentId = ?) AND c.status IN (?, ?)';
        params.unshift(userId, userId);
      }
    } else if (role === 'mediator') {
      if (userId) {
        whereClause = 'WHERE c.mediatorId = ? AND c.status IN (?, ?)';
        params.unshift(userId);
      }
    } else if (role === 'tenant_admin' && tenantId) {
      whereClause = 'WHERE c.tenantId = ? AND c.status IN (?, ?)';
      params.unshift(tenantId);
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

  async getOverdueCases(userId: string, days: number = 10, role?: string, tenantId?: string | null): Promise<Case[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = `SELECT * FROM ${this.tableName}
       WHERE (status = 'pending' OR status = 'processing')
       AND createdAt < ?`;
    const params: any[] = [cutoffDate];

    if (role === 'tenant_admin' && tenantId) {
      query += ' AND tenantId = ?';
      params.push(tenantId);
    } else {
      query += ' AND mediatorId = ?';
      params.push(userId);
    }

    query += ' ORDER BY createdAt ASC';
    const [rows] = await pool.query(query, params);
    return rows as Case[];
  }

  async getMediatorAnalysisSummary(mediatorId: string, overdueDays: number = 10): Promise<MediatorAnalysisSummary> {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN c.status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN c.status = 'processing' THEN 1 ELSE 0 END) as processing,
         SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE
           WHEN c.status IN ('pending', 'processing') AND c.createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)
           THEN 1 ELSE 0 END) as overdue,
         AVG(CASE
           WHEN c.status = 'completed' AND c.closeTime IS NOT NULL
           THEN TIMESTAMPDIFF(HOUR, c.createdAt, c.closeTime) / 24
           ELSE NULL
         END) as avgClosedDays,
         AVG(CASE
           WHEN first_progress.firstProgressAt IS NOT NULL
           THEN TIMESTAMPDIFF(HOUR, c.createdAt, first_progress.firstProgressAt)
           ELSE NULL
         END) as avgFirstResponseHours
       FROM ${this.tableName} c
       LEFT JOIN (
         SELECT cp.caseId, MIN(cp.createdAt) as firstProgressAt
         FROM case_progress cp
         WHERE cp.type IN ('accept', 'mediate', 'close')
         GROUP BY cp.caseId
       ) first_progress ON first_progress.caseId = c.id
       WHERE c.mediatorId = ?`,
      [overdueDays, mediatorId]
    );

    const result = (rows as any[])[0] || {};
    const total = Number(result.total || 0);
    const completed = Number(result.completed || 0);
    const failed = Number(result.failed || 0);
    const closedTotal = completed + failed;
    const overdue = Number(result.overdue || 0);

    return {
      total,
      pending: Number(result.pending || 0),
      processing: Number(result.processing || 0),
      completed,
      failed,
      overdue,
      avgClosedDays: Math.round(Number(result.avgClosedDays || 0)),
      avgFirstResponseHours: Math.round(Number(result.avgFirstResponseHours || 0)),
      successRate: closedTotal ? Math.round((completed / closedTotal) * 100) : 0,
      overdueRate: total ? Math.round((overdue / total) * 100) : 0
    };
  }
}

export default new CaseRepository();
export { Case, CaseWithRelations, MediatorAnalysisSummary };
