import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Broadcast {
  id: string;
  title: string;
  content: string;
  type: string;
  urgency: string;
  status: 'pending' | 'approved' | 'rejected';
  creatorId: string;
  approverId?: string;
  approvalTime?: Date;
  rejectionReason?: string;
  attachments?: any;
  readBy?: any;
  expireAt?: Date;
  createdAt: Date;
}

interface BroadcastWithRelations extends Broadcast {
  creatorName?: string;
  approverName?: string;
}

class BroadcastRepository extends BaseRepository<Broadcast> {
  constructor() {
    super('broadcasts');
  }

  async findByCreator(creatorId: string): Promise<Broadcast[]> {
    return await this.findByField('creatorId', creatorId);
  }

  async findByType(type: string): Promise<Broadcast[]> {
    return await this.findByField('type', type);
  }

  async findByUrgency(urgency: string): Promise<Broadcast[]> {
    return await this.findByField('urgency', urgency);
  }

  async findByStatus(status: string): Promise<Broadcast[]> {
    return await this.findByField('status', status);
  }

  async findActiveBroadcasts(): Promise<Broadcast[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} 
       WHERE status = 'approved' AND (expireAt IS NULL OR expireAt > NOW()) 
       ORDER BY createdAt DESC`
    );
    return rows as Broadcast[];
  }

  async findActiveBroadcastsWithRelations(): Promise<BroadcastWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT b.*, u.name as creatorName, a.name as approverName 
       FROM ${this.tableName} b 
       LEFT JOIN users u ON b.creatorId = u.id 
       LEFT JOIN users a ON b.approverId = a.id 
       WHERE b.status = 'approved' AND (b.expireAt IS NULL OR b.expireAt > NOW()) 
       ORDER BY b.createdAt DESC`
    );
    return rows as BroadcastWithRelations[];
  }

  async findAllWithRelations(): Promise<BroadcastWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT b.*, u.name as creatorName, a.name as approverName 
       FROM ${this.tableName} b 
       LEFT JOIN users u ON b.creatorId = u.id 
       LEFT JOIN users a ON b.approverId = a.id 
       ORDER BY b.createdAt DESC`
    );
    return rows as BroadcastWithRelations[];
  }

  async paginateBroadcasts(page: number = 1, limit: number = 10, type?: string, urgency?: string, status?: string): Promise<{ broadcasts: BroadcastWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    const conditions: string[] = [];
    if (type) {
      conditions.push('b.type = ?');
      params.push(type);
    }
    if (urgency) {
      conditions.push('b.urgency = ?');
      params.push(urgency);
    }
    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const [rows] = await pool.query(
      `SELECT b.*, u.name as creatorName, a.name as approverName 
       FROM ${this.tableName} b 
       LEFT JOIN users u ON b.creatorId = u.id 
       LEFT JOIN users a ON b.approverId = a.id 
       ${whereClause}
       ORDER BY b.createdAt DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} b ${whereClause}`,
      params
    );

    return {
      broadcasts: rows as BroadcastWithRelations[],
      total: (countResult as any)[0].total
    };
  }

  async markAsRead(broadcastId: string, userId: string): Promise<void> {
    const broadcast = await this.findById(broadcastId);
    if (!broadcast) return;

    let readBy = [];
    if (broadcast.readBy) {
      try {
        readBy = typeof broadcast.readBy === 'string' ? JSON.parse(broadcast.readBy) : broadcast.readBy;
      } catch {
        readBy = [];
      }
    }

    // 检查是否已读
    const alreadyRead = readBy.some((item: any) => item.userId === userId);
    if (alreadyRead) return;

    readBy.push({ userId, readAt: new Date() });
    await this.update(broadcastId, { readBy: JSON.stringify(readBy) } as any);
  }

  async isReadByUser(broadcastId: string, userId: string): Promise<boolean> {
    const broadcast = await this.findById(broadcastId);
    if (!broadcast || !broadcast.readBy) return false;

    let readBy = [];
    try {
      readBy = typeof broadcast.readBy === 'string' ? JSON.parse(broadcast.readBy) : broadcast.readBy;
    } catch {
      return false;
    }

    return readBy.some((item: any) => item.userId === userId);
  }
}

export default new BroadcastRepository();
export { Broadcast, BroadcastWithRelations };
