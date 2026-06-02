import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: string;
  isRead?: boolean;
  readAt?: Date;
  createdAt: Date;
}

class NotificationRepository extends BaseRepository<Notification> {
  constructor() {
    super('notifications');
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return await this.findByField('userId', userId);
  }

  async findUnreadNotifications(userId: string): Promise<Notification[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE userId = ? AND isRead = false ORDER BY createdAt DESC`,
      [userId]
    );
    return rows as Notification[];
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE userId = ? AND isRead = false`,
      [userId]
    );
    return (rows as any)[0].count;
  }

  async markAsRead(notificationId: string): Promise<Notification | null> {
    const [result] = await pool.query(
      `UPDATE ${this.tableName} SET isRead = true, readAt = NOW() WHERE id = ?`,
      [notificationId]
    );
    return await this.findById(notificationId);
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const [result] = await pool.query(
      `UPDATE ${this.tableName} SET isRead = true, readAt = NOW() WHERE userId = ? AND isRead = false`,
      [userId]
    );
    return (result as any).affectedRows > 0;
  }

  async deleteOldNotifications(userId: string, days: number = 30): Promise<boolean> {
    const [result] = await pool.query(
      `DELETE FROM ${this.tableName} WHERE userId = ? AND isRead = true AND createdAt < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [userId, days]
    );
    return (result as any).affectedRows > 0;
  }

  async createNotification(userId: string, title: string, content: string, type: string): Promise<Notification> {
    return await this.create({
      userId,
      title,
      content,
      type,
      isRead: false
    } as any);
  }
}

export default new NotificationRepository();
export { Notification };
