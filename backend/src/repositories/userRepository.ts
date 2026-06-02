import BaseRepository from './baseRepository';
import pool from '../config/mysql';

interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  position?: string;
  officePhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  street?: string;
  department?: string;
  role: 'mediator' | 'admin' | 'personal' | 'company';
  identity?: 'applicant' | 'respondent';
  caseAmount?: number;
  idCard?: string;
  isOnDuty?: boolean;
  lastOnDutyDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

class UserRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.findOneByField('username', username);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return await this.findOneByField('phone', phone);
  }

  async findAllMediators(): Promise<User[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE role = 'mediator' ORDER BY name`
    );
    return rows as User[];
  }

  async findOnDutyMediators(): Promise<User[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE role = 'mediator' AND isOnDuty = true ORDER BY name`
    );
    return rows as User[];
  }

  async findByRole(role: string): Promise<User[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE role = ? ORDER BY name`,
      [role]
    );
    return rows as User[];
  }

  async updateDutyStatus(userId: string, isOnDuty: boolean, lastOnDutyDate?: Date): Promise<User | null> {
    const data: any = { isOnDuty };
    if (lastOnDutyDate) {
      data.lastOnDutyDate = lastOnDutyDate;
    }
    return await this.update(userId, data);
  }

  async searchUsers(query: string): Promise<User[]> {
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE name LIKE ? OR username LIKE ? ORDER BY name`,
      [`%${query}%`, `%${query}%`]
    );
    return rows as User[];
  }

  async paginateUsers(page: number = 1, limit: number = 10, role?: string): Promise<{ users: User[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (role) {
      whereClause = 'WHERE role = ?';
      params.push(role);
    }

    // 获取分页数据
    const [rows] = await pool.query(
      `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`,
      params
    );

    return {
      users: rows as User[],
      total: (countResult as any)[0].total
    };
  }
}

export default new UserRepository();
export { User };
