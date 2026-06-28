#!/usr/bin/env ts-node
/**
 * 数据库初始化脚本
 * 功能：创建数据库、表结构和初始数据
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 数据库配置
const dbConfig = {
  host: process.env.MYSQL_HOST || '152.136.175.14',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'newuser',
  password: process.env.MYSQL_PASSWORD || 'StrongPassword123!',
  database: process.env.MYSQL_DATABASE || 'laodongzhongcai',
  multipleStatements: true
};

async function initDatabase() {
  console.log('🚀 开始数据库初始化...\n');

  let connection;
  try {
    // 1. 连接到MySQL服务器（不指定数据库）
    console.log('📡 连接到MySQL服务器...');
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true
    });
    console.log('✅ MySQL连接成功！\n');

    // 2. 创建数据库（如果不存在）
    console.log('🗄️  创建数据库...');
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ 数据库 ${dbConfig.database} 准备就绪！\n`);

    // 3. 选择数据库
    // 注意：部分 MySQL 兼容实现（或特定配置）不支持在 prepared statement 协议下执行 USE，
    // 因此这里使用 query 而非 execute。
    await connection.query(`USE \`${dbConfig.database}\``);

    // 4. 执行表结构创建脚本
    console.log('📋  创建表结构...');
    const createTablesSql = fs.readFileSync(
      path.join(__dirname, 'create_tables.sql'),
      'utf-8'
    );
    await connection.query(createTablesSql);
    console.log('✅ 所有表创建成功！\n');

    // 4.5. 补全微信 openid 字段（兼容旧数据库）
    console.log('🔧  检查并补全微信登录字段...');
    try {
      await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_mp_openid VARCHAR(255) DEFAULT NULL');
      await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_web_openid VARCHAR(255) DEFAULT NULL');
      await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT NULL');
      await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatarUrl VARCHAR(500) DEFAULT NULL');
      await connection.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS applicantPhone VARCHAR(50) DEFAULT NULL');
      await connection.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS respondentPhone VARCHAR(50) DEFAULT NULL');
      await connection.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS applicantDisplayName VARCHAR(100) DEFAULT NULL');
      await connection.query('ALTER TABLE cases ADD COLUMN IF NOT EXISTS respondentDisplayName VARCHAR(100) DEFAULT NULL');
      await connection.query('DROP TRIGGER IF EXISTS trg_cases_snapshot_before_insert');
      await connection.query(`
        CREATE TRIGGER trg_cases_snapshot_before_insert
        BEFORE INSERT ON cases
        FOR EACH ROW
        BEGIN
          IF (NEW.applicantDisplayName IS NULL OR NEW.applicantDisplayName = '') THEN
            SET NEW.applicantDisplayName = (SELECT name FROM users WHERE id = NEW.applicantId LIMIT 1);
          END IF;
          IF (NEW.respondentDisplayName IS NULL OR NEW.respondentDisplayName = '') THEN
            SET NEW.respondentDisplayName = (SELECT name FROM users WHERE id = NEW.respondentId LIMIT 1);
          END IF;
          IF (NEW.applicantPhone IS NULL OR NEW.applicantPhone = '') THEN
            SET NEW.applicantPhone = (SELECT phone FROM users WHERE id = NEW.applicantId LIMIT 1);
          END IF;
          IF (NEW.respondentPhone IS NULL OR NEW.respondentPhone = '') THEN
            SET NEW.respondentPhone = (SELECT phone FROM users WHERE id = NEW.respondentId LIMIT 1);
          END IF;
        END
      `);
      await connection.query('DROP TRIGGER IF EXISTS trg_cases_snapshot_before_update');
      await connection.query(`
        CREATE TRIGGER trg_cases_snapshot_before_update
        BEFORE UPDATE ON cases
        FOR EACH ROW
        BEGIN
          IF (NEW.applicantDisplayName IS NULL OR NEW.applicantDisplayName = '') THEN
            SET NEW.applicantDisplayName = COALESCE((SELECT name FROM users WHERE id = NEW.applicantId LIMIT 1), OLD.applicantDisplayName);
          END IF;
          IF (NEW.respondentDisplayName IS NULL OR NEW.respondentDisplayName = '') THEN
            SET NEW.respondentDisplayName = COALESCE((SELECT name FROM users WHERE id = NEW.respondentId LIMIT 1), OLD.respondentDisplayName);
          END IF;
          IF (NEW.applicantPhone IS NULL OR NEW.applicantPhone = '') THEN
            SET NEW.applicantPhone = COALESCE((SELECT phone FROM users WHERE id = NEW.applicantId LIMIT 1), OLD.applicantPhone);
          END IF;
          IF (NEW.respondentPhone IS NULL OR NEW.respondentPhone = '') THEN
            SET NEW.respondentPhone = COALESCE((SELECT phone FROM users WHERE id = NEW.respondentId LIMIT 1), OLD.respondentPhone);
          END IF;
        END
      `);
      await connection.query('CREATE INDEX IF NOT EXISTS idx_users_wechat_mp_openid ON users (wechat_mp_openid)');
      await connection.query('CREATE INDEX IF NOT EXISTS idx_users_wechat_web_openid ON users (wechat_web_openid)');
      console.log('✅ 微信 openid 字段准备就绪！\n');
    } catch (e) {
      console.log('ℹ️  微信字段检查/补全提示（可能已存在）：', (e as any).message, '\n');
    }

    // 5. 检查是否已有初始数据
    const [existingUsers] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const userCount = (existingUsers as any)[0].count;

    if (userCount === 0) {
      console.log('🌱  创建初始数据...');
      await createInitialData(connection);
      console.log('✅ 初始数据创建成功！\n');
    } else {
      console.log('ℹ️  数据库中已有数据，跳过初始数据创建。\n');
    }

    console.log('🎉 数据库初始化完成！');
    console.log('\n📝 默认账户信息：');
    console.log('   - 管理员：admin / admin123');
    console.log('   - 调解员：mediator / mediator123');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function createInitialData(connection: mysql.Connection) {
  // 1. 创建默认管理员账户
  const adminId = uuidv4();
  const adminPassword = await bcrypt.hash('admin123', 10);
  await connection.execute(
    `INSERT INTO users (id, username, password, name, position, role, isOnDuty, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [adminId, 'admin', adminPassword, '系统管理员', '系统管理员', 'admin', false]
  );

  // 2. 创建默认调解员账户
  const mediatorId = uuidv4();
  const mediatorPassword = await bcrypt.hash('mediator123', 10);
  await connection.execute(
    `INSERT INTO users (id, username, password, name, position, role, isOnDuty, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [mediatorId, 'mediator', mediatorPassword, '张调解员', '调解员', 'mediator', true]
  );

  // 3. 创建示例个人用户
  const personalId = uuidv4();
  const personalPassword = await bcrypt.hash('123456', 10);
  await connection.execute(
    `INSERT INTO users (id, username, password, name, phone, email, role, identity, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [personalId, 'user1', personalPassword, '张三', '13800138000', 'zhangsan@example.com', 'personal', 'applicant']
  );

  // 4. 创建示例企业用户
  const companyId = uuidv4();
  const companyPassword = await bcrypt.hash('123456', 10);
  await connection.execute(
    `INSERT INTO users (id, username, password, name, phone, email, role, identity, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [companyId, 'company1', companyPassword, '某某公司', '13900139000', 'company@example.com', 'company', 'respondent']
  );

  // 5. 创建示例案件
  const caseId = uuidv4();
  const caseNumber = `LA${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}001`;
  await connection.execute(
    `INSERT INTO cases (id, caseNumber, applicantId, respondentId, disputeType, caseAmount, requestItems, factsReasons, status, mediatorId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      caseId,
      caseNumber,
      personalId,
      companyId,
      '工资拖欠',
      50000,
      '1. 要求支付拖欠的工资3个月共计50000元；2. 要求支付经济补偿金',
      '申请人于2023年1月入职被申请人公司，担任销售经理一职。自2023年10月起，被申请人开始拖欠工资，至今已拖欠3个月工资。申请人多次催要未果，特申请仲裁。',
      'pending',
      mediatorId
    ]
  );

  // 6. 创建案件进度记录
  const progressId = uuidv4();
  await connection.execute(
    `INSERT INTO case_progress (id, caseId, content, type, creatorId, createdAt)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [progressId, caseId, '案件已申请，等待调解员分配', 'register', adminId]
  );

  // 7. 创建示例通知
  const notificationId = uuidv4();
  await connection.execute(
    `INSERT INTO notifications (id, userId, title, content, type, isRead, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [notificationId, mediatorId, '新案件分配', '您有一个新的案件需要处理，请及时查看。', 'system', false]
  );

  // 8. 创建示例系统设置
  const settings = [
    { key: 'basic.siteName', value: '劳动争议调解平台', desc: '站点名称' },
    { key: 'basic.siteDescription', value: '专业的劳动争议调解服务平台', desc: '站点描述' },
    { key: 'basic.workStartTime', value: '09:00', desc: '工作开始时间' },
    { key: 'basic.workEndTime', value: '18:00', desc: '工作结束时间' },
    { key: 'security.passwordMinLength', value: '8', desc: '密码最小长度' },
    { key: 'notification.enableEmail', value: 'true', desc: '启用邮件通知' },
    { key: 'notification.enableSms', value: 'false', desc: '启用短信通知' }
  ];

  for (const setting of settings) {
    const settingId = uuidv4();
    await connection.execute(
      `INSERT INTO system_settings (id, settingKey, settingValue, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [settingId, setting.key, setting.value, setting.desc]
    );
  }

  console.log('✅ 初始数据创建完成');
}

// 执行初始化
initDatabase();
