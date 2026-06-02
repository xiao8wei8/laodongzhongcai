import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Evidence {
  id: string;
  caseId: string;
  name: string;
  type: string;
  path: string;
  size?: number;
  uploaderId: string;
  recognitionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  recognizedContent?: string;
  recognizedKeyInfo?: any;
  recognitionTime?: Date;
  createdAt: Date;
}

interface EvidenceWithRelations extends Evidence {
  uploaderName?: string;
}

class EvidenceRepository extends BaseRepository<Evidence> {
  constructor() {
    super('evidences');
  }

  async findByCaseId(caseId: string): Promise<Evidence[]> {
    return await this.findByField('caseId', caseId);
  }

  async findByCaseIdWithRelations(caseId: string): Promise<EvidenceWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT e.*, u.name as uploaderName 
       FROM ${this.tableName} e 
       LEFT JOIN users u ON e.uploaderId = u.id 
       WHERE e.caseId = ? 
       ORDER BY e.createdAt DESC`,
      [caseId]
    );
    return rows as EvidenceWithRelations[];
  }

  async findByUploader(uploaderId: string): Promise<Evidence[]> {
    return await this.findByField('uploaderId', uploaderId);
  }

  async countByCaseId(caseId: string): Promise<number> {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE caseId = ?`,
      [caseId]
    );
    return (rows as any)[0].count;
  }

  async updateRecognitionStatus(id: string, status: string, content?: string, keyInfo?: any): Promise<Evidence | null> {
    const updateData: any = {
      recognitionStatus: status,
      recognitionTime: new Date()
    };
    if (content) updateData.recognizedContent = content;
    if (keyInfo) updateData.recognizedKeyInfo = typeof keyInfo === 'string' ? keyInfo : JSON.stringify(keyInfo);
    return await this.update(id, updateData);
  }
}

export default new EvidenceRepository();
export { Evidence, EvidenceWithRelations };
