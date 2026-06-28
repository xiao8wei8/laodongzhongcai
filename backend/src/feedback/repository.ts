import pool from '../config/mysql';

export interface Feedback {
  id: string;
  userId: string;
  tenantId?: string | null;
  source: 'miniapp' | 'admin_web';
  type: 'bug' | 'suggestion' | 'complaint' | 'other';
  title: string;
  content: string;
  contactName?: string;
  contactPhone?: string;
  screenshots?: string[];
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  replyContent?: string;
  handledBy?: string;
  handledAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

class FeedbackRepository {
  async create(data: Feedback) {
    await pool.query(
      `INSERT INTO feedbacks (
        id, userId, tenantId, source, type, title, content, contactName, contactPhone, screenshots,
        status, replyContent, handledBy, handledAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.userId,
        data.tenantId || null,
        data.source,
        data.type,
        data.title,
        data.content,
        data.contactName || null,
        data.contactPhone || null,
        data.screenshots ? JSON.stringify(data.screenshots) : null,
        data.status,
        data.replyContent || null,
        data.handledBy || null,
        data.handledAt || null,
        data.createdAt,
        data.updatedAt || data.createdAt
      ]
    );

    return this.findById(data.id);
  }

  async findById(id: string) {
    const [rows] = await pool.query(
      `SELECT f.*, u.name as userName, u.role as userRole, h.name as handledByName
       FROM feedbacks f
       LEFT JOIN users u ON f.userId = u.id
       LEFT JOIN users h ON f.handledBy = h.id
       WHERE f.id = ?
       LIMIT 1`,
      [id]
    );
    return this.normalizeOne((rows as any[])[0] || null);
  }

  async findMine(userId: string) {
    const [rows] = await pool.query(
      `SELECT f.*, u.name as userName, u.role as userRole, h.name as handledByName
       FROM feedbacks f
       LEFT JOIN users u ON f.userId = u.id
       LEFT JOIN users h ON f.handledBy = h.id
       WHERE f.userId = ?
       ORDER BY f.createdAt DESC`,
      [userId]
    );
    return this.normalizeRows(rows as any[]);
  }

  async findAll(filters: { status?: string; source?: string; type?: string; keyword?: string; tenantId?: string | null }) {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      whereClause += ' AND f.status = ?';
      params.push(filters.status);
    }
    if (filters.source) {
      whereClause += ' AND f.source = ?';
      params.push(filters.source);
    }
    if (filters.type) {
      whereClause += ' AND f.type = ?';
      params.push(filters.type);
    }
    if (filters.keyword) {
      whereClause += ' AND (f.title LIKE ? OR f.content LIKE ? OR u.name LIKE ?)';
      const q = `%${filters.keyword}%`;
      params.push(q, q, q);
    }
    if (filters.tenantId) {
      whereClause += ' AND f.tenantId = ?';
      params.push(filters.tenantId);
    }

    const [rows] = await pool.query(
      `SELECT f.*, u.name as userName, u.role as userRole, h.name as handledByName
       FROM feedbacks f
       LEFT JOIN users u ON f.userId = u.id
       LEFT JOIN users h ON f.handledBy = h.id
       ${whereClause}
       ORDER BY
         FIELD(f.status, 'pending', 'processing', 'resolved', 'closed'),
         f.createdAt DESC`,
      params
    );
    return this.normalizeRows(rows as any[]);
  }

  async updateStatus(id: string, data: { status: string; replyContent?: string; handledBy: string }) {
    await pool.query(
      `UPDATE feedbacks
       SET status = ?, replyContent = ?, handledBy = ?, handledAt = NOW()
       WHERE id = ?`,
      [data.status, data.replyContent || null, data.handledBy, id]
    );

    return this.findById(id);
  }

  private normalizeRows(rows: any[]) {
    return rows.map(row => this.normalizeOne(row));
  }

  private normalizeOne(row: any) {
    if (!row) return null;
    return {
      ...row,
      screenshots: row.screenshots
        ? (typeof row.screenshots === 'string' ? JSON.parse(row.screenshots) : row.screenshots)
        : []
    };
  }
}

export default new FeedbackRepository();
