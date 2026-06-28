import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Schedule {
  id: string;
  caseId?: string;
  title: string;
  description?: string;
  category?: string;
  date: Date;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ScheduleWithRelations extends Schedule {
  creatorName?: string;
  caseNumber?: string;
  tenantId?: string | null;
  visitorTenantId?: string | null;
  mediatorId?: string | null;
  visitorMediatorId?: string | null;
  applicantId?: string | null;
  respondentId?: string | null;
  visitorName?: string | null;
  visitorPhone?: string | null;
}

interface ScheduleQueryUser {
  id: string;
  role: string;
  tenantId?: string | null;
  name?: string;
  nickname?: string | null;
  username?: string;
  phone?: string;
}

class ScheduleRepository extends BaseRepository<Schedule> {
  constructor() {
    super('schedules');
  }

  async findByCaseId(caseId: string): Promise<Schedule[]> {
    return await this.findByField('caseId', caseId);
  }

  async findByCreator(creatorId: string): Promise<Schedule[]> {
    return await this.findByField('creatorId', creatorId);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Schedule[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      [startDate, endDate]
    );
    return rows as Schedule[];
  }

  async findByCreatorWithRelations(creatorId: string): Promise<ScheduleWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT s.*, u.name as creatorName, c.caseNumber 
       FROM ${this.tableName} s 
       LEFT JOIN users u ON s.creatorId = u.id 
       LEFT JOIN cases c ON s.caseId = c.id 
       WHERE s.creatorId = ? 
       ORDER BY s.date ASC`,
      [creatorId]
    );
    return rows as ScheduleWithRelations[];
  }

  async findUpcomingSchedules(creatorId: string, days: number = 7): Promise<ScheduleWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT s.*, u.name as creatorName, c.caseNumber 
       FROM ${this.tableName} s 
       LEFT JOIN users u ON s.creatorId = u.id 
       LEFT JOIN cases c ON s.caseId = c.id 
       WHERE s.creatorId = ? AND s.date >= NOW() AND s.date <= DATE_ADD(NOW(), INTERVAL ? DAY) 
       ORDER BY s.date ASC`,
      [creatorId, days]
    );
    return rows as ScheduleWithRelations[];
  }

  async findByDate(date: Date): Promise<ScheduleWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT s.*, u.name as creatorName, c.caseNumber 
       FROM ${this.tableName} s 
       LEFT JOIN users u ON s.creatorId = u.id 
       LEFT JOIN cases c ON s.caseId = c.id 
       WHERE DATE(s.date) = DATE(?) 
       ORDER BY s.date ASC`,
      [date]
    );
    return rows as ScheduleWithRelations[];
  }

  async findVisibleSchedules(currentUser: ScheduleQueryUser): Promise<ScheduleWithRelations[]> {
    const params: any[] = [];
    const clauses: string[] = [];

    if (currentUser.role === 'tenant_admin' && currentUser.tenantId) {
      clauses.push('(c.tenantId = ? OR vr.tenantId = ?)');
      params.push(currentUser.tenantId, currentUser.tenantId);
    } else if (currentUser.role === 'mediator') {
      clauses.push('(c.mediatorId = ? OR vr.mediatorId = ?)');
      params.push(currentUser.id, currentUser.id);
    } else if (currentUser.role === 'personal' || currentUser.role === 'company') {
      clauses.push('((c.applicantId = ? OR c.respondentId = ?) OR (vr.visitorName = ? OR vr.phone = ?))');
      params.push(
        currentUser.id,
        currentUser.id,
        String(currentUser.name || currentUser.nickname || currentUser.username || '').trim(),
        String(currentUser.phone || '').trim()
      );
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT
         s.*,
         u.name as creatorName,
         COALESCE(c.caseNumber, vr.registerNumber) as caseNumber,
         c.tenantId,
         vr.tenantId as visitorTenantId,
         c.mediatorId,
         vr.mediatorId as visitorMediatorId,
         c.applicantId,
         c.respondentId,
         vr.visitorName,
         vr.phone as visitorPhone
       FROM ${this.tableName} s
       LEFT JOIN users u ON s.creatorId = u.id
       LEFT JOIN cases c ON s.caseId = c.id
       LEFT JOIN visitor_records vr ON s.caseId = vr.id
       ${whereClause}
       ORDER BY s.date ASC`,
      params
    );

    return rows as ScheduleWithRelations[];
  }

  async deleteByCaseId(caseId: string): Promise<boolean> {
    const [result] = await pool.query(
      `DELETE FROM ${this.tableName} WHERE caseId = ?`,
      [caseId]
    );
    return (result as any).affectedRows > 0;
  }
}

export default new ScheduleRepository();
export { Schedule, ScheduleWithRelations };
