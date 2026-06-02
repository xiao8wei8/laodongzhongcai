import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import pool from '../config/mysql';

async function initDatabase() {
  console.log('🚀 开始初始化 MySQL 数据库...');

  try {
    // 1. 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'create_tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // 2. 分割 SQL 语句（按分号分割）
    const sqlStatements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // 3. 执行每个 SQL 语句
    const connection = await pool.getConnection();
    
    try {
      for (const sql of sqlStatements) {
        await connection.query(sql);
      }
      console.log('✅ 所有表创建成功！');
    } finally {
      connection.release();
    }

    // 4. 插入默认系统设置
    await insertDefaultSettings();

    console.log('🎉 数据库初始化完成！');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

async function insertDefaultSettings() {
  const connection = await pool.getConnection();
  try {
    // 检查是否已有数据
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM system_settings');
    const count = (rows as any)[0].count;

    if (count > 0) {
      console.log('ℹ️ 系统设置数据已存在，跳过插入');
      return;
    }

    // 插入默认设置
    const defaultSettings = [
      { 
        key: 'mediator_duty_rotation', 
        value: 'false', 
        description: '是否启用调解员值班轮询' 
      },
      { 
        key: 'case_auto_assign', 
        value: 'false', 
        description: '是否启用案件自动分配' 
      },
      { 
        key: 'auto_reminder_enabled', 
        value: 'true', 
        description: '是否启用自动提醒' 
      },
      { 
        key: 'reminder_advance_minutes', 
        value: '30', 
        description: '提醒提前时间（分钟）' 
      },
    ];

    for (const setting of defaultSettings) {
      await connection.query(
        'INSERT INTO system_settings (id, settingKey, settingValue, description) VALUES (UUID(), ?, ?, ?)',
        [setting.key, setting.value, setting.description]
      );
    }

    console.log('✅ 默认系统设置插入成功！');
  } finally {
    connection.release();
  }
}

// 直接执行
if (require.main === module) {
  initDatabase();
}

export default initDatabase;
