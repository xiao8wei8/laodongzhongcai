import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface SystemSetting {
  id: string;
  settingKey: string;
  settingValue?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

class SystemSettingsRepository extends BaseRepository<SystemSetting> {
  constructor() {
    super('system_settings');
  }

  async findByKey(settingKey: string): Promise<SystemSetting | null> {
    return await this.findOneByField('settingKey', settingKey);
  }

  async getValue(settingKey: string): Promise<string | null> {
    const setting = await this.findByKey(settingKey);
    return setting?.settingValue || null;
  }

  async setValue(settingKey: string, value: string): Promise<SystemSetting | null> {
    const existing = await this.findByKey(settingKey);
    
    if (existing) {
      return await this.update(existing.id, {
        settingValue: value
      } as any) as SystemSetting;
    } else {
      return await this.create({
        settingKey,
        settingValue: value
      } as any);
    }
  }

  async getMultipleValues(keys: string[]): Promise<Record<string, string | null>> {
    const placeholders = keys.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT settingKey, settingValue FROM ${this.tableName} WHERE settingKey IN (${placeholders})`,
      keys
    );
    
    const result: Record<string, string | null> = {};
    for (const key of keys) {
      result[key] = null;
    }
    
    (rows as any[]).forEach(row => {
      result[row.settingKey] = row.settingValue;
    });
    
    return result;
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const [rows] = await pool.query(
      `SELECT settingKey, settingValue FROM ${this.tableName}`
    );
    
    const result: Record<string, string> = {};
    (rows as any[]).forEach(row => {
      result[row.settingKey] = row.settingValue || '';
    });
    
    return result;
  }
}

export default new SystemSettingsRepository();
export { SystemSetting };
