import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import pool from './config/mysql';
import bcrypt from 'bcryptjs';

// 导入路由
import authRoutes from './auth/routes';
import caseRoutes from './case/routes';
import visitorRoutes from './visitor/routes';
import applicationRoutes from './application/routes';
import broadcastRoutes from './broadcast/routes';
import evidenceRoutes from './evidence/routes';
import notificationRoutes from './notification/routes';
import userRoutes from './user/routes';
import dashboardRoutes from './dashboard/routes';
import serviceRoutes from './services/routes';
import systemSettingsRoutes from './systemSettings/routes';
import messageRoutes from './message/routes';
import analyticsRoutes from './analytics/routes';
import backupRoutes from './backup/routes';
import feedbackRoutes from './feedback/routes';
import tenantRoutes from './tenant/routes';
import { ensureTenantDefaultAdmins, isShanghaiTenant } from './utils/tenantAdmin';
import backupSchedulerService from './backup/service';

// 导入提醒服务
import reminderService from './services/ReminderService';

// 配置环境变量
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: envFile });

const app = express();
const PORT = process.env.PORT || 5003;

const ensureUserColumn = async (columnName: string, definitionSql: string) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = ?`,
    [columnName]
  );

  if ((rows as any[])[0]?.count === 0) {
    await pool.query(`ALTER TABLE users ADD COLUMN ${definitionSql}`);
  }
};

const ensureCaseColumn = async (columnName: string, definitionSql: string) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'cases'
       AND COLUMN_NAME = ?`,
    [columnName]
  );

  if ((rows as any[])[0]?.count === 0) {
    await pool.query(`ALTER TABLE cases ADD COLUMN ${definitionSql}`);
  }
};

const ensureTableColumn = async (tableName: string, columnName: string, definitionSql: string) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  if ((rows as any[])[0]?.count === 0) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
  }
};

const ensureTenantsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id CHAR(36) PRIMARY KEY COMMENT '租户ID (UUID)',
      tenantCode VARCHAR(100) DEFAULT NULL COMMENT '租户编码',
      tenantName VARCHAR(255) NOT NULL COMMENT '租户名称',
      districtName VARCHAR(100) DEFAULT NULL COMMENT '区名称',
      streetName VARCHAR(100) DEFAULT NULL COMMENT '街道名称',
      status ENUM('active', 'disabled') NOT NULL DEFAULT 'active' COMMENT '状态',
      contactName VARCHAR(100) DEFAULT NULL COMMENT '联系人',
      contactPhone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_tenant_name (tenantName)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='街道租户表'
  `);
};

const ensureUserRoleEnum = async () => {
  await pool.query(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('superadmin', 'tenant_admin', 'mediator', 'personal', 'company', 'admin')
    NOT NULL
    COMMENT '角色：超级管理员/街道管理员/调解员/个人/企业/兼容旧admin'
  `);
};

const parseTenantName = (fullStreet: string) => {
  const tenantName = String(fullStreet || '').trim();
  if (!tenantName) return null;
  const districtMatch = tenantName.match(/^(.+?区)/);
  const districtName = districtMatch ? districtMatch[1] : '';
  const streetName = districtName ? tenantName.replace(districtName, '') : tenantName;
  const tenantCode = tenantName
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '')
    .slice(0, 32) || null;
  return { tenantName, districtName, streetName, tenantCode };
};

const PRESET_TENANT_STREETS = [
  '静安区天目西路街道',
  '黄浦区半淞园路街道',
  '徐汇区徐家汇街道',
  '长宁区江苏路街道',
  '普陀区长风新村街道',
  '虹口区嘉兴路街道',
  '杨浦区五角场街道',
  '浦东新区花木街道',
  '闵行区古美路街道',
  '宝山区友谊路街道'
];

const ensurePresetTenantSeeds = async () => {
  for (const tenantStreet of PRESET_TENANT_STREETS) {
    const parsed = parseTenantName(tenantStreet);
    if (!parsed) continue;
    await pool.query(
      `INSERT INTO tenants (id, tenantCode, tenantName, districtName, streetName, status)
       SELECT UUID(), ?, ?, ?, ?, 'active'
       FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE tenantName = ?)`,
      [parsed.tenantCode, parsed.tenantName, parsed.districtName, parsed.streetName, parsed.tenantName]
    );
  }
};

const ensureTenantSeeds = async () => {
  const [rows] = await pool.query(
    `SELECT DISTINCT street
     FROM users
     WHERE street IS NOT NULL AND TRIM(street) <> ''`
  );

  for (const row of rows as any[]) {
    const parsed = parseTenantName(row.street);
    if (!parsed || !isShanghaiTenant(parsed)) continue;
    await pool.query(
      `INSERT INTO tenants (id, tenantCode, tenantName, districtName, streetName, status)
       SELECT UUID(), ?, ?, ?, ?, 'active'
       FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE tenantName = ?)`,
      [parsed.tenantCode, parsed.tenantName, parsed.districtName, parsed.streetName, parsed.tenantName]
    );
  }
};

const ensureOnlyShanghaiTenantsActive = async () => {
  const [rows] = await pool.query(
    `SELECT id, tenantName, districtName
     FROM tenants`
  );

  for (const tenant of rows as any[]) {
    if (!isShanghaiTenant(tenant)) {
      await pool.query(`UPDATE tenants SET status = 'disabled' WHERE id = ?`, [tenant.id]);
    }
  }
};

const migrateTenantModel = async () => {
  await pool.query(
    `UPDATE users u
     LEFT JOIN tenants t ON u.street = t.tenantName
     SET u.tenantId = t.id
     WHERE u.tenantId IS NULL
       AND u.street IS NOT NULL
       AND TRIM(u.street) <> ''`
  );

  await pool.query(`UPDATE users SET role = 'superadmin' WHERE role = 'admin' AND isSuperAdmin = 1`);
  await pool.query(`UPDATE users SET role = 'tenant_admin' WHERE role = 'admin' AND (isSuperAdmin = 0 OR isSuperAdmin IS NULL)`);

  await pool.query(
    `UPDATE cases c
     LEFT JOIN users a ON c.applicantId = a.id
     LEFT JOIN users m ON c.mediatorId = m.id
     SET c.tenantId = COALESCE(a.tenantId, m.tenantId)
     WHERE c.tenantId IS NULL`
  );

  await pool.query(
    `UPDATE visitor_records v
     LEFT JOIN users m ON v.mediatorId = m.id
     SET v.tenantId = m.tenantId
     WHERE v.tenantId IS NULL`
  );

  await pool.query(
    `UPDATE feedbacks f
     LEFT JOIN users u ON f.userId = u.id
     SET f.tenantId = u.tenantId
     WHERE f.tenantId IS NULL`
  );

  await pool.query(
    `UPDATE broadcasts b
     LEFT JOIN users u ON b.creatorId = u.id
     SET b.tenantId = u.tenantId
     WHERE b.tenantId IS NULL`
  );
};

const ensureDutyAdjustmentLogsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS duty_adjustment_logs (
      id CHAR(36) PRIMARY KEY,
      tenantId CHAR(36) NOT NULL,
      actionType VARCHAR(50) NOT NULL,
      originalUserId CHAR(36) DEFAULT NULL,
      targetUserId CHAR(36) DEFAULT NULL,
      effectiveDate DATE DEFAULT NULL,
      reason VARCHAR(500) DEFAULT NULL,
      createdBy CHAR(36) DEFAULT NULL,
      createdByName VARCHAR(100) DEFAULT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_duty_logs_tenant_created (tenantId, createdAt DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

const ensureFeedbackTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id CHAR(36) PRIMARY KEY COMMENT '反馈ID (UUID)',
      userId CHAR(36) NOT NULL COMMENT '提交用户ID',
      source ENUM('miniapp', 'admin_web') NOT NULL DEFAULT 'miniapp' COMMENT '反馈来源',
      type ENUM('bug', 'suggestion', 'complaint', 'other') NOT NULL DEFAULT 'other' COMMENT '反馈类型',
      title VARCHAR(255) NOT NULL COMMENT '反馈标题',
      content TEXT NOT NULL COMMENT '反馈内容',
      contactName VARCHAR(100) DEFAULT NULL COMMENT '联系人姓名',
      contactPhone VARCHAR(50) DEFAULT NULL COMMENT '联系人手机号',
      screenshots JSON DEFAULT NULL COMMENT '截图列表',
      status ENUM('pending', 'processing', 'resolved', 'closed') NOT NULL DEFAULT 'pending' COMMENT '处理状态',
      replyContent TEXT DEFAULT NULL COMMENT '处理回复',
      handledBy CHAR(36) DEFAULT NULL COMMENT '处理人ID',
      handledAt DATETIME DEFAULT NULL COMMENT '处理时间',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_feedback_user (userId),
      INDEX idx_feedback_status (status),
      INDEX idx_feedback_source (source),
      INDEX idx_feedback_created_at (createdAt DESC),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (handledBy) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户反馈表'
  `);
};

const ensureOperationLogsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id CHAR(36) PRIMARY KEY,
      userId CHAR(36) DEFAULT NULL,
      username VARCHAR(100) DEFAULT NULL,
      role VARCHAR(50) DEFAULT NULL,
      tenantId CHAR(36) DEFAULT NULL,
      module VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      targetType VARCHAR(50) DEFAULT NULL,
      targetId VARCHAR(100) DEFAULT NULL,
      targetDisplay VARCHAR(255) DEFAULT NULL,
      result ENUM('success', 'failed') NOT NULL DEFAULT 'success',
      errorMessage VARCHAR(500) DEFAULT NULL,
      ip VARCHAR(100) DEFAULT NULL,
      userAgent VARCHAR(500) DEFAULT NULL,
      detail TEXT DEFAULT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_operation_logs_created (createdAt DESC),
      INDEX idx_operation_logs_user (userId),
      INDEX idx_operation_logs_module (module),
      INDEX idx_operation_logs_result (result)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表'
  `);
};

const ensureSuperAdminSeed = async () => {
  await pool.query(`UPDATE users SET isSuperAdmin = 1, role = 'superadmin' WHERE username = 'admin'`);

  const [rows] = await pool.query(
    `SELECT id FROM users WHERE role = 'superadmin' LIMIT 1`
  );

  if (!(rows as any[])[0]) {
    await pool.query(
      `UPDATE users
       SET isSuperAdmin = 1, role = 'superadmin'
       WHERE role IN ('admin', 'tenant_admin', 'superadmin')
       ORDER BY createdAt ASC
       LIMIT 1`
    );
  }
};

const ensureTenantAdminSeedAccounts = async () => {
  await ensureTenantDefaultAdmins(pool);
};

const migratePhoneConsultationsToCases = async () => {
  const defaultPasswordHash = await bcrypt.hash('123456', 10);
  const [rows] = await pool.query(
    `SELECT vr.*
     FROM visitor_records vr
     LEFT JOIN cases c ON c.caseNumber = vr.registerNumber
     WHERE c.id IS NULL
       AND (vr.visitType = 'phone' OR vr.disputeType = '咨询')
     ORDER BY vr.createdAt ASC`
  );

  for (const record of rows as any[]) {
    let applicantId = '';
    if (record.phone) {
      const [userRows] = await pool.query(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [record.phone]);
      const existingUser = (userRows as any[])[0];
      if (existingUser?.id) {
        applicantId = existingUser.id;
      }
    }

    if (!applicantId) {
      const generatedUsername = `consult_${String(record.phone || Date.now()).replace(/\D/g, '').slice(-11) || Date.now()}`;
      const [idRows] = await pool.query(`SELECT UUID() AS id`);
      applicantId = (idRows as any[])[0]?.id;
      await pool.query(
        `INSERT INTO users (id, username, password, name, role, phone, tenantId, street, position, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'personal', ?, ?, ?, '咨询用户', NOW(), NOW())`,
        [
          applicantId,
          `${generatedUsername}_${String(record.id || '').slice(0, 6)}`,
          defaultPasswordHash,
          record.visitorName || '咨询用户',
          record.phone || null,
          record.tenantId || null,
          record.street || null
        ]
      );
    }

    let receiverId = record.mediatorId || '';
    let receiverName = '';
    let receiverPhone = '';
    if (receiverId) {
      const [receiverRows] = await pool.query(`SELECT id, name, phone, officePhone FROM users WHERE id = ? LIMIT 1`, [receiverId]);
      const receiver = (receiverRows as any[])[0];
      receiverName = receiver?.name || '';
      receiverPhone = receiver?.phone || receiver?.officePhone || '';
    }

    if (!receiverId && record.tenantId) {
      const [tenantAdminRows] = await pool.query(
        `SELECT id, name, phone, officePhone
         FROM users
         WHERE tenantId = ? AND role = 'tenant_admin'
         ORDER BY createdAt ASC
         LIMIT 1`,
        [record.tenantId]
      );
      const tenantAdmin = (tenantAdminRows as any[])[0];
      if (tenantAdmin) {
        receiverId = tenantAdmin.id;
        receiverName = tenantAdmin.name || '';
        receiverPhone = tenantAdmin.phone || tenantAdmin.officePhone || '';
      }
    }

    if (!receiverId) {
      const [superAdminRows] = await pool.query(
        `SELECT id, name, phone, officePhone
         FROM users
         WHERE role = 'superadmin' OR isSuperAdmin = 1
         ORDER BY createdAt ASC
         LIMIT 1`
      );
      const superAdmin = (superAdminRows as any[])[0];
      if (superAdmin) {
        receiverId = superAdmin.id;
        receiverName = superAdmin.name || '';
        receiverPhone = superAdmin.phone || superAdmin.officePhone || '';
      }
    }

    if (!receiverId) continue;

    await pool.query(
      `INSERT INTO cases (
        id, caseNumber, applicantId, respondentId, applicantDisplayName, respondentDisplayName,
        applicantPhone, respondentPhone, disputeType, caseAmount, requestItems, factsReasons,
        tenantId, mediatorId, status, createdAt, updatedAt
      ) VALUES (
        UUID(), ?, ?, ?, ?, ?, ?, ?, '咨询', 0, ?, ?, ?, ?, ?, ?, ?
      )`,
      [
        record.registerNumber,
        applicantId,
        receiverId,
        record.visitorName || '咨询用户',
        receiverName || '街道咨询受理台',
        record.phone || '',
        receiverPhone || '',
        record.reason || '',
        record.reason || '',
        record.tenantId || null,
        receiverId,
        record.status || 'pending',
        record.createdAt || new Date(),
        record.updatedAt || record.createdAt || new Date()
      ]
    );

    await pool.query(
      `INSERT INTO case_progress (id, caseId, content, type, creatorId, createdAt)
       SELECT UUID(), c.id, '历史咨询迁移完成', 'register', ?, ?
       FROM cases c
       WHERE c.caseNumber = ?`,
      [applicantId, record.createdAt || new Date(), record.registerNumber]
    );
  }
};

const ensureCaseSnapshotTriggers = async () => {
  await pool.query('DROP TRIGGER IF EXISTS trg_cases_snapshot_before_insert');
  await pool.query(`
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

  await pool.query('DROP TRIGGER IF EXISTS trg_cases_snapshot_before_update');
  await pool.query(`
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
};

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/laodongzhongcai', express.static('public'));

// 前端静态资源（使用已构建的 frontend/dist，挂载到与前端 basename 一致的路径）
// 这样无需启动 Vite dev server 也能访问前端页面
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use('/laodongzhongcai', express.static(frontendDistPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/laodongzhongcai/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Swagger API文档
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});
app.use('/laodongzhongcai/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/laodongzhongcai/api/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

// 测试数据库连接
app.get('/api/test/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', mysql: 'connected', data: rows });
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.status(500).json({ status: 'error', message: '数据库连接失败' });
  }
});
app.get('/laodongzhongcai/api/test/db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ status: 'ok', mysql: 'connected', data: rows });
  } catch (error) {
    console.error('数据库测试失败:', error);
    res.status(500).json({ status: 'error', message: '数据库连接失败' });
  }
});

// 路由配置
// 说明：Nginx 会把 /laodongzhongcai/api/* 重写为 /* 后转发到本服务
// 所以同时提供 3 组前缀，保证无论哪种路径都能命中：
//   - 无前缀（Nginx rewrite 后：/auth/login → 后端 /auth/login）
//   - /api（本地开发：/api/auth/login）
//   - /laodongzhongcai/api（直连生产服务器：/laodongzhongcai/api/auth/login）
const API_BASE_PATHS = ['', '/api', '/laodongzhongcai/api'];
for (const base of API_BASE_PATHS) {
  app.use(`${base}/auth`, authRoutes);
  app.use(`${base}/case`, caseRoutes);
  app.use(`${base}/visitor`, visitorRoutes);
  app.use(`${base}/application`, applicationRoutes);
  app.use(`${base}/broadcast`, broadcastRoutes);
  app.use(`${base}/evidence`, evidenceRoutes);
  app.use(`${base}/notification`, notificationRoutes);
  app.use(`${base}/user`, userRoutes);
  app.use(`${base}/dashboard`, dashboardRoutes);
  app.use(`${base}/services`, serviceRoutes);
  app.use(`${base}/system/settings`, systemSettingsRoutes);
  app.use(`${base}/message`, messageRoutes);
  app.use(`${base}/feedback`, feedbackRoutes);
  app.use(`${base}/tenant`, tenantRoutes);
  app.use(`${base}/analytics`, analyticsRoutes);
  app.use(`${base}/backup`, backupRoutes);
}

// SPA 路由回退（必须放在 API 路由之后；并且排除 /laodongzhongcai/api/*）
app.get('/laodongzhongcai/*', (req, res, next) => {
  if (req.path.startsWith('/laodongzhongcai/api')) return next();
  if (req.path.startsWith('/laodongzhongcai/assets/')) {
    return res.status(404).type('text/plain').send('Asset not found');
  }
  if (/\.[A-Za-z0-9]+$/.test(req.path)) {
    return res.status(404).type('text/plain').send('File not found');
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: '服务器内部错误' });
});

// 数据库连接 - MySQL
const initDatabase = async () => {
  try {
    // 测试连接
    await pool.query('SELECT 1');
    await ensureUserColumn('nickname', 'nickname VARCHAR(100) DEFAULT NULL COMMENT \'微信昵称/展示昵称\'');
    await ensureUserColumn('avatarUrl', 'avatarUrl VARCHAR(500) DEFAULT NULL COMMENT \'头像地址\'');
    await ensureUserColumn('isSuperAdmin', 'isSuperAdmin BOOLEAN DEFAULT FALSE COMMENT \'是否超级管理员\'');
    await ensureUserColumn('tenantId', 'tenantId CHAR(36) DEFAULT NULL COMMENT \'所属街道租户ID\'');
    await ensureUserRoleEnum();
    await ensureCaseColumn('applicantDisplayName', 'applicantDisplayName VARCHAR(100) DEFAULT NULL COMMENT \'申请人姓名快照\'');
    await ensureCaseColumn('respondentDisplayName', 'respondentDisplayName VARCHAR(100) DEFAULT NULL COMMENT \'被申请人姓名快照\'');
    await ensureCaseColumn('applicantPhone', 'applicantPhone VARCHAR(50) DEFAULT NULL COMMENT \'申请人联系电话快照\'');
    await ensureCaseColumn('respondentPhone', 'respondentPhone VARCHAR(50) DEFAULT NULL COMMENT \'被申请人联系电话快照\'');
    await ensureCaseColumn('tenantId', 'tenantId CHAR(36) DEFAULT NULL COMMENT \'所属街道租户ID\'');
    await ensureTableColumn('visitor_records', 'tenantId', 'tenantId CHAR(36) DEFAULT NULL COMMENT \'所属街道租户ID\'');
    await ensureFeedbackTable();
    await ensureOperationLogsTable();
    await ensureDutyAdjustmentLogsTable();
    await ensureTableColumn('feedbacks', 'tenantId', 'tenantId CHAR(36) DEFAULT NULL COMMENT \'所属街道租户ID\'');
    await ensureTableColumn('broadcasts', 'tenantId', 'tenantId CHAR(36) DEFAULT NULL COMMENT \'所属街道租户ID\'');
    await ensureTenantsTable();
    await ensureTableColumn('tenants', 'dutyUserIds', 'dutyUserIds JSON DEFAULT NULL COMMENT \'值班调解员ID列表\'');
    await ensureTableColumn('tenants', 'currentDutyUserId', 'currentDutyUserId CHAR(36) DEFAULT NULL COMMENT \'当前值班调解员ID\'');
    await ensureTableColumn('tenants', 'dutyRotationStartDate', 'dutyRotationStartDate DATE DEFAULT NULL COMMENT \'值班轮转起始日期\'');
    await ensureTableColumn('tenants', 'dutyOverrideUserId', 'dutyOverrideUserId CHAR(36) DEFAULT NULL COMMENT \'当日临时代理值班调解员ID\'');
    await ensureTableColumn('tenants', 'dutyOverrideDate', 'dutyOverrideDate DATE DEFAULT NULL COMMENT \'当日临时代理生效日期\'');
    await ensureTableColumn('tenants', 'allowAdminAsMediator', 'allowAdminAsMediator BOOLEAN NOT NULL DEFAULT TRUE COMMENT \'无调解员时允许街道管理员兜底\'');
    await ensurePresetTenantSeeds();
    await ensureTenantSeeds();
    await ensureOnlyShanghaiTenantsActive();
    await ensureSuperAdminSeed();
    await ensureTenantAdminSeedAccounts();
    await migrateTenantModel();
    await migratePhoneConsultationsToCases();
    await ensureCaseSnapshotTriggers();
    console.log('MySQL连接成功');
  } catch (error) {
    // 开发/演示场景下允许继续启动，避免因为数据库不可达导致整个服务无法运行
    console.error('MySQL连接失败（将继续启动服务，部分接口可能不可用）:', error);
  }
};

// 初始化数据库
initDatabase();

// 创建HTTP服务器
const server = http.createServer(app);

// 配置Socket.io
// 注意：前端在生产环境使用子目录部署（/laodongzhongcai），socket.io path 也需要一致
const io = new Server(server, {
  path: '/laodongzhongcai/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io事件处理
io.on('connection', (socket) => {
  console.log('新的Socket连接:', socket.id);
  
  // 加入用户房间（用于定向消息）
  socket.on('joinUserRoom', (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id}加入用户房间 ${userId}`);
  });
  
  // 加入房间
  socket.on('joinRoom', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id}加入房间 ${room}`);
  });
  
  // 发送广播消息
  socket.on('broadcastMessage', (message) => {
    io.emit('newBroadcast', message);
  });
  
  // 发送案件更新
  socket.on('caseUpdate', (caseId) => {
    io.emit('caseUpdated', caseId);
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('Socket断开连接:', socket.id);
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  // 启动提醒服务
  reminderService.start();
  backupSchedulerService.start();
});

export default app;
export { io };
