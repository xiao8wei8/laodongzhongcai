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
