import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '152.136.175.14',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  database: process.env.MYSQL_DATABASE || 'laodongzhongcai',
  user: process.env.MYSQL_USER || 'newuser',
  password: process.env.MYSQL_PASSWORD || 'StrongPassword123!',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(MYSQL_CONFIG);

export default pool;

export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 连接成功');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL 连接失败:', error);
    return false;
  }
}
