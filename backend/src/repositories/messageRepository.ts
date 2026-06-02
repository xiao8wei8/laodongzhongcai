import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type?: string;
  caseId?: string;
  isRead?: boolean;
  readAt?: Date;
  createdAt: Date;
}

interface MessageWithRelations extends Message {
  senderName?: string;
  receiverName?: string;
  caseNumber?: string;
}

class MessageRepository extends BaseRepository<Message> {
  constructor() {
    super('messages');
  }

  async findBySender(senderId: string): Promise<Message[]> {
    return await this.findByField('senderId', senderId);
  }

  async findByReceiver(receiverId: string): Promise<Message[]> {
    return await this.findByField('receiverId', receiverId);
  }

  async findByReceiverPaginated(receiverId: string, page: number = 1, limit: number = 20, type?: string): Promise<{ messages: MessageWithRelations[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE m.receiverId = ?';
    const params: any[] = [receiverId];
    
    if (type) {
      whereClause += ' AND m.type = ?';
      params.push(type);
    }
    
    const [rows] = await pool.query(
      `SELECT m.*, 
              s.name as senderName, 
              r.name as receiverName,
              c.caseNumber
       FROM ${this.tableName} m 
       LEFT JOIN users s ON m.senderId = s.id 
       LEFT JOIN users r ON m.receiverId = r.id
       LEFT JOIN cases c ON m.caseId = c.id
       ${whereClause}
       ORDER BY m.createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} m ${whereClause}`,
      params
    );
    
    return {
      messages: rows as MessageWithRelations[],
      total: (countResult as any)[0].total
    };
  }

  async findUnreadMessages(receiverId: string): Promise<Message[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE receiverId = ? AND isRead = false ORDER BY createdAt DESC`,
      [receiverId]
    );
    return rows as Message[];
  }

  async countUnreadMessages(receiverId: string): Promise<number> {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM ${this.tableName} WHERE receiverId = ? AND isRead = false`,
      [receiverId]
    );
    return (rows as any)[0].count;
  }

  async markAsRead(messageId: string, receiverId: string): Promise<Message | null> {
    const [result] = await pool.query(
      `UPDATE ${this.tableName} SET isRead = true, readAt = NOW() WHERE id = ? AND receiverId = ?`,
      [messageId, receiverId]
    );
    return await this.findById(messageId);
  }

  async markAllAsRead(receiverId: string): Promise<boolean> {
    const [result] = await pool.query(
      `UPDATE ${this.tableName} SET isRead = true, readAt = NOW() WHERE receiverId = ? AND isRead = false`,
      [receiverId]
    );
    return (result as any).affectedRows > 0;
  }

  async deleteMessage(messageId: string, receiverId: string): Promise<boolean> {
    const [result] = await pool.query(
      `DELETE FROM ${this.tableName} WHERE id = ? AND receiverId = ?`,
      [messageId, receiverId]
    );
    return (result as any).affectedRows > 0;
  }

  async findConversation(userId1: string, userId2: string): Promise<MessageWithRelations[]> {
    const [rows] = await pool.query(
      `SELECT m.*, 
              s.name as senderName, 
              r.name as receiverName 
       FROM ${this.tableName} m 
       LEFT JOIN users s ON m.senderId = s.id 
       LEFT JOIN users r ON m.receiverId = r.id 
       WHERE (m.senderId = ? AND m.receiverId = ?) 
          OR (m.senderId = ? AND m.receiverId = ?) 
       ORDER BY m.createdAt ASC`,
      [userId1, userId2, userId2, userId1]
    );
    return rows as MessageWithRelations[];
  }

  async findConversationsList(userId: string): Promise<any[]> {
    const [rows] = await pool.query(
      `SELECT DISTINCT
        CASE 
          WHEN m.senderId = ? THEN m.receiverId 
          ELSE m.senderId 
        END as otherUserId,
        u.name as otherUserName,
        m.content as lastMessage,
        m.createdAt as lastMessageTime,
        (SELECT COUNT(*) FROM messages WHERE receiverId = ? AND senderId = CASE WHEN m.senderId = ? THEN m.receiverId ELSE m.senderId END AND isRead = false) as unreadCount
       FROM messages m
       LEFT JOIN users u ON (CASE WHEN m.senderId = ? THEN m.receiverId ELSE m.senderId END) = u.id
       WHERE m.senderId = ? OR m.receiverId = ?
       ORDER BY m.createdAt DESC`,
      [userId, userId, userId, userId, userId, userId]
    );
    return rows as any[];
  }
}

export default new MessageRepository();
export { Message, MessageWithRelations };
