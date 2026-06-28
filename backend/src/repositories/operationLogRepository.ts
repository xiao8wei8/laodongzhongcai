import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface OperationLog {
  id: string;
  userId?: string | null;
  username?: string | null;
  role?: string | null;
  tenantId?: string | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetDisplay?: string | null;
  result: 'success' | 'failed';
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  createdAt: Date;
}

class OperationLogRepository extends BaseRepository<OperationLog> {
  constructor() {
    super('operation_logs');
  }

  async findPaged(filters: {
    keyword?: string;
    module?: string;
    action?: string;
    result?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}) {
    const clauses: string[] = ['1=1'];
    const params: any[] = [];

    if (filters.keyword) {
      clauses.push('(username LIKE ? OR targetDisplay LIKE ? OR detail LIKE ?)');
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`, `%${filters.keyword}%`);
    }
    if (filters.module) {
      clauses.push('module = ?');
      params.push(filters.module);
    }
    if (filters.action) {
      clauses.push('action = ?');
      params.push(filters.action);
    }
    if (filters.result) {
      clauses.push('result = ?');
      params.push(filters.result);
    }
    if (filters.startDate) {
      clauses.push('createdAt >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      clauses.push('createdAt <= ?');
      params.push(filters.endDate);
    }

    const limit = Number(filters.limit || 100);

    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName}
       WHERE ${clauses.join(' AND ')}
       ORDER BY createdAt DESC
       LIMIT ?`,
      [...params, limit]
    );

    return rows as OperationLog[];
  }

  async getTodaySummary() {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as successCount,
         SUM(CASE WHEN result = 'failed' THEN 1 ELSE 0 END) as failedCount
       FROM ${this.tableName}
       WHERE DATE(createdAt) = CURDATE()`
    );

    return (rows as any[])[0] || { total: 0, successCount: 0, failedCount: 0 };
  }
}

export default new OperationLogRepository();
export type { OperationLog };
