import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface CaseProgress {
  id: string;
  caseId: string;
  content: string;
  type: 'register' | 'accept' | 'mediate' | 'close';
  creatorId: string;
  createdAt: Date;
}

interface CaseProgressWithRelations extends CaseProgress {
  creatorName?: string;
}

class CaseProgressRepository extends BaseRepository<CaseProgress> {
  constructor() {
    super('case_progress');
  }

  async findByCaseId(caseId: string): Promise<CaseProgress[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE caseId = ? ORDER BY createdAt ASC`,
      [caseId]
    );
    return rows as CaseProgress[];
  }

  async findByCaseIdWithRelations(caseId: string): Promise<CaseProgressWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT cp.*, u.name as creatorName 
       FROM ${this.tableName} cp 
       LEFT JOIN users u ON cp.creatorId = u.id 
       WHERE cp.caseId = ? 
       ORDER BY cp.createdAt ASC`,
      [caseId]
    );
    return rows as CaseProgressWithRelations[];
  }

  async findByType(type: string): Promise<CaseProgress[]> {
    return await this.findByField('type', type);
  }

  async createProgress(caseId: string, content: string, type: string, creatorId: string): Promise<CaseProgress> {
    return await this.create({
      caseId,
      content,
      type: type as any,
      creatorId
    } as any);
  }
}

export default new CaseProgressRepository();
export { CaseProgress, CaseProgressWithRelations };
