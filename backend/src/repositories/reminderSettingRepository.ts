import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface ReminderSetting {
  id: string;
  userId: string;
  type: string;
  enabled?: boolean;
  advanceTime?: number;
  createdAt: Date;
  updatedAt: Date;
}

class ReminderSettingRepository extends BaseRepository<ReminderSetting> {
  constructor() {
    super('reminder_settings');
  }

  async findByUser(userId: string): Promise<ReminderSetting[]> {
    return await this.findByField('userId', userId);
  }

  async findEnabledReminders(userId: string): Promise<ReminderSetting[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE userId = ? AND enabled = true`,
      [userId]
    );
    return rows as ReminderSetting[];
  }

  async findByUserAndType(userId: string, type: string): Promise<ReminderSetting | null> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE userId = ? AND type = ?`,
      [userId, type]
    );
    const results = rows as ReminderSetting[];
    return results[0] || null;
  }

  async upsert(userId: string, type: string, enabled: boolean, advanceTime: number): Promise<ReminderSetting> {
    const existing = await this.findByUserAndType(userId, type);
    
    if (existing) {
      return await this.update(existing.id, {
        enabled,
        advanceTime
      } as any) as ReminderSetting;
    } else {
      return await this.create({
        userId,
        type,
        enabled,
        advanceTime
      } as any);
    }
  }

  async createDefaultSettings(userId: string): Promise<void> {
    const defaultSettings = [
      { type: 'in_app', enabled: true, advanceTime: 15 }
    ];

    for (const setting of defaultSettings) {
      const existing = await this.findByUserAndType(userId, setting.type);
      if (!existing) {
        await this.create({
          userId,
          type: setting.type,
          enabled: setting.enabled,
          advanceTime: setting.advanceTime
        } as any);
      }
    }
  }
}

export default new ReminderSettingRepository();
export { ReminderSetting };
