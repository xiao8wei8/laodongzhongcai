import pool from '../config/mysql';

export abstract class BaseRepository<T> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  // 辅助方法：构建 INSERT SQL
  protected buildInsertSql(data: Partial<T>): { sql: string; values: any[] } {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    return { sql, values };
  }

  // 辅助方法：构建 UPDATE SQL
  protected buildUpdateSql(id: string, data: Partial<T>): { sql: string; values: any[] } {
    const keys = Object.keys(data);
    const values = [...Object.values(data), id];
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    return { sql, values };
  }

  // 通用查询方法
  async findById(id: string): Promise<T | null> {
    const [rows] = await pool.query(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    const results = rows as T[];
    return results[0] || null;
  }

  async findAll(): Promise<T[]> {
    const [rows] = await pool.query(`SELECT * FROM ${this.tableName}`);
    return rows as T[];
  }

  async findByField(field: string, value: any): Promise<T[]> {
    const [rows] = await pool.query(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`, [value]);
    return rows as T[];
  }

  async findOneByField(field: string, value: any): Promise<T | null> {
    const results = await this.findByField(field, value);
    return results[0] || null;
  }

  async create(data: Partial<T>): Promise<T> {
    const generatedId = this.generateId();
    const insertData = { id: generatedId, ...data } as any;
    
    const { sql, values } = this.buildInsertSql(insertData);
    await pool.query(sql, values);
    
    // 注意：调用方可能显式传入 data.id（例如迁移脚本/控制器里使用 uuidv4），
    // 插入时应以最终落库的 insertData.id 为准；否则会出现“插入成功但查询返回 null”。
    return await this.findById(insertData.id) as T;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const { sql, values } = this.buildUpdateSql(id, data);
    await pool.query(sql, values);
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    return (result as any).affectedRows > 0;
  }

  async count(): Promise<number> {
    const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${this.tableName}`);
    return (rows as any)[0].count;
  }

  // 生成 UUID
  protected generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export default BaseRepository;
