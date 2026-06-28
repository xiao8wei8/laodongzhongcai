import express from 'express';
import pool from '../config/mysql';
import { auth, roleAuth } from '../middleware/auth';
import { buildDutyPreview, getTenantDutyConfig, resolveDutyMediator, resolveDutyMediatorFromConfig } from '../utils/dutyMediator';
import { createDefaultTenantAdmin, isShanghaiTenant, sortTenantsWithShanghaiPriority } from '../utils/tenantAdmin';

const router = express.Router();

const buildDutyResponse = (
  config: Awaited<ReturnType<typeof getTenantDutyConfig>>,
  previewDays: number = 7,
  previewStartDate?: string
) => {
  const currentDutyAssignee = resolveDutyMediatorFromConfig(config);
  return {
    ...config,
    currentDutyAssignee,
    dutyPreview: buildDutyPreview(config, previewDays, previewStartDate)
  };
};

const writeDutyAdjustmentLog = async (payload: {
  tenantId: string;
  actionType: 'rotation_update' | 'manual_override' | 'manual_override_clear' | 'advance_next';
  originalUserId?: string | null;
  targetUserId?: string | null;
  effectiveDate?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
}) => {
  await pool.query(
    `INSERT INTO duty_adjustment_logs (
      id, tenantId, actionType, originalUserId, targetUserId, effectiveDate, reason, createdBy, createdByName, createdAt
    ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      payload.tenantId,
      payload.actionType,
      payload.originalUserId || null,
      payload.targetUserId || null,
      payload.effectiveDate || null,
      payload.reason || null,
      payload.createdBy || null,
      payload.createdByName || null
    ]
  );
};

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, tenantCode, tenantName, districtName, streetName
       FROM tenants
       WHERE status = 'active'
       ORDER BY tenantName ASC`
    );
    res.json({ tenants: sortTenantsWithShanghaiPriority(rows as any[]) });
  } catch (error) {
    console.error('获取街道租户列表失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

router.get('/manage', auth, roleAuth(['superadmin']), async (req, res) => {
  try {
    const { keyword = '', status } = req.query;
    const normalizedStatus = status === undefined || status === null || String(status).trim() === ''
      ? 'active'
      : String(status).trim();
    let whereClause = '1=1';
    const params: any[] = [];

    if (normalizedStatus && normalizedStatus !== 'all') {
      whereClause += ' AND t.status = ?';
      params.push(normalizedStatus);
    }
    if (keyword) {
      whereClause += ' AND (t.tenantName LIKE ? OR t.districtName LIKE ? OR t.streetName LIKE ? OR t.contactName LIKE ? OR t.contactPhone LIKE ?)';
      const q = `%${String(keyword).trim()}%`;
      params.push(q, q, q, q, q);
    }

    const [rows] = await pool.query(
      `SELECT
         t.*,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id) AS userCount,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id AND u.role IN ('superadmin', 'tenant_admin', 'mediator')) AS staffUserCount,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id AND u.role IN ('personal', 'company')) AS externalUserCount,
         (SELECT COUNT(*) FROM cases c WHERE c.tenantId = t.id) AS caseCount,
         (SELECT COUNT(*) FROM visitor_records vr WHERE vr.tenantId = t.id) AS visitorRecordCount,
         (
           (SELECT COUNT(*) FROM cases c WHERE c.tenantId = t.id) +
           (
             SELECT COUNT(*)
             FROM visitor_records vr
             WHERE vr.tenantId = t.id
               AND NOT EXISTS (
                 SELECT 1
                 FROM cases c2
                 WHERE c2.tenantId = t.id
                   AND (c2.disputeType = '咨询' OR c2.caseNumber LIKE 'CONSULT%')
                   AND c2.caseNumber = vr.registerNumber
               )
           )
         ) AS queryCaseCount,
         (SELECT COUNT(*) FROM feedbacks f WHERE f.tenantId = t.id) AS feedbackCount
       FROM tenants t
       WHERE ${whereClause}
       ORDER BY t.createdAt DESC`,
      params
    );
    res.json({ tenants: sortTenantsWithShanghaiPriority(rows as any[]) });
  } catch (error) {
    console.error('获取街道租户管理列表失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

router.get('/duty-config', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const requestedTenantId = String(req.query.tenantId || '').trim();
    const previewDays = Number(req.query.previewDays || 7);
    const previewStartDate = req.query.previewStartDate ? String(req.query.previewStartDate) : undefined;
    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : requestedTenantId;

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const config = await getTenantDutyConfig(tenantId);
    res.json(buildDutyResponse(config, Number.isFinite(previewDays) ? previewDays : 7, previewStartDate));
  } catch (error: any) {
    console.error('获取值班调解员配置失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.get('/my-duty', auth, roleAuth(['mediator']), async (req, res) => {
  try {
    const tenantId = String(req.user?.tenantId || '').trim();
    if (!tenantId) {
      return res.status(400).json({ message: '当前账号未绑定所属街道' });
    }

    const config = await getTenantDutyConfig(tenantId);
    const currentDutyAssignee = resolveDutyMediatorFromConfig(config);
    const myMediator = config.mediators.find((item) => item.id === req.user?.id) || null;
    const dutyRoster = config.dutyUserIds
      .map((userId) => config.mediators.find((item) => item.id === userId))
      .filter(Boolean)
      .map((item: any, index) => ({
        id: item.id,
        name: item.name,
        phone: item.phone || item.officePhone || '',
        order: index + 1,
        isCurrentDuty: item.id === currentDutyAssignee?.id
      }));
    const dutyPreview = buildDutyPreview(config, 30);

    res.json({
      tenantId: config.tenantId,
      tenantName: config.tenantName,
      allowAdminAsMediator: config.allowAdminAsMediator,
      dutyRotationStartDate: config.dutyRotationStartDate,
      dutyOverrideUserId: config.dutyOverrideUserId,
      dutyOverrideDate: config.dutyOverrideDate,
      currentDutyAssignee,
      myDuty: {
        id: myMediator?.id || req.user?.id,
        name: myMediator?.name || req.user?.name || req.user?.username,
        phone: myMediator?.phone || myMediator?.officePhone || req.user?.phone || '',
        isInDutyRoster: config.dutyUserIds.includes(String(req.user?.id || '')),
        isCurrentDuty: currentDutyAssignee?.id === req.user?.id,
        rosterOrder: dutyRoster.findIndex((item: any) => item.id === req.user?.id) + 1 || null
      },
      dutyRoster,
      dutyPreview
    });
  } catch (error: any) {
    console.error('获取调解员值班信息失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.get('/duty-logs', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const requestedTenantId = String(req.query.tenantId || '').trim();
    const actionType = String(req.query.actionType || '').trim();
    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : requestedTenantId;

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const whereClauses = ['tenantId = ?'];
    const params: any[] = [tenantId];
    if (actionType && actionType !== 'all') {
      whereClauses.push('actionType = ?');
      params.push(actionType);
    }

    const [rows] = await pool.query(
      `SELECT id, tenantId, actionType, originalUserId, targetUserId, effectiveDate, reason, createdBy, createdByName, createdAt
       FROM duty_adjustment_logs
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY createdAt DESC
       LIMIT 20`,
      params
    );
    res.json({ logs: rows });
  } catch (error: any) {
    console.error('获取值班调整记录失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.get('/duty-stats', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const requestedTenantId = String(req.query.tenantId || '').trim();
    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : requestedTenantId;

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const [countRows] = await pool.query(
      `SELECT
         COUNT(*) AS totalAdjustments,
         SUM(CASE WHEN actionType = 'manual_override' THEN 1 ELSE 0 END) AS overrideCount,
         SUM(CASE WHEN actionType = 'advance_next' THEN 1 ELSE 0 END) AS advanceCount,
         SUM(CASE WHEN actionType = 'rotation_update' THEN 1 ELSE 0 END) AS rotationUpdateCount,
         COUNT(DISTINCT DATE(createdAt)) AS activeDays
       FROM duty_adjustment_logs
       WHERE tenantId = ?
         AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [tenantId]
    );

    const [overrideRows] = await pool.query(
      `SELECT DISTINCT effectiveDate
       FROM duty_adjustment_logs
       WHERE tenantId = ?
         AND actionType = 'manual_override'
         AND effectiveDate IS NOT NULL
         AND effectiveDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY effectiveDate DESC`,
      [tenantId]
    );

    const dates = (overrideRows as any[])
      .map((item) => item.effectiveDate ? new Date(item.effectiveDate) : null)
      .filter(Boolean)
      .map((date: any) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });

    let consecutiveOverrideDays = 0;
    let cursor = new Date();
    while (true) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      const day = String(cursor.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      if (dates.includes(key)) {
        consecutiveOverrideDays += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    const [frequentRows] = await pool.query(
      `SELECT l.targetUserId, u.name, COUNT(*) AS overrideTimes
       FROM duty_adjustment_logs l
       LEFT JOIN users u ON BINARY u.id = BINARY l.targetUserId
       WHERE l.tenantId = ?
         AND l.actionType = 'manual_override'
         AND l.createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND l.targetUserId IS NOT NULL
       GROUP BY l.targetUserId, u.name
       ORDER BY overrideTimes DESC
       LIMIT 1`,
      [tenantId]
    );

    const summary = (countRows as any[])[0] || {};
    const topOverride = (frequentRows as any[])[0] || null;

    res.json({
      totalAdjustments: Number(summary.totalAdjustments || 0),
      overrideCount: Number(summary.overrideCount || 0),
      advanceCount: Number(summary.advanceCount || 0),
      rotationUpdateCount: Number(summary.rotationUpdateCount || 0),
      activeDays: Number(summary.activeDays || 0),
      consecutiveOverrideDays,
      topOverrideMediator: topOverride ? {
        id: topOverride.targetUserId,
        name: topOverride.name || '未命名调解员',
        overrideTimes: Number(topOverride.overrideTimes || 0)
      } : null
    });
  } catch (error: any) {
    console.error('获取值班统计失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.put('/duty-config', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const {
      tenantId: bodyTenantId,
      dutyUserIds = [],
      currentDutyUserId = null,
      dutyRotationStartDate = null,
      allowAdminAsMediator = true,
      reason = null
    } = req.body || {};

    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : String(bodyTenantId || '').trim();

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const normalizedDutyUserIds = Array.from(new Set(
      (Array.isArray(dutyUserIds) ? dutyUserIds : []).filter((item) => typeof item === 'string' && item.trim())
    ));

    const previousConfig = await getTenantDutyConfig(tenantId);
    const [tenantRows] = await pool.query('SELECT id FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
    if (!(tenantRows as any[])[0]) {
      return res.status(404).json({ message: '街道不存在' });
    }

    if (normalizedDutyUserIds.length > 0) {
      const [validMediatorRows] = await pool.query(
        `SELECT id
         FROM users
         WHERE tenantId = ?
           AND role = 'mediator'
           AND id IN (${normalizedDutyUserIds.map(() => '?').join(',')})`,
        [tenantId, ...normalizedDutyUserIds]
      );
      const validMediatorIds = new Set((validMediatorRows as any[]).map((item) => item.id));
      if (validMediatorIds.size !== normalizedDutyUserIds.length) {
        return res.status(400).json({ message: '值班列表中存在非本街道调解员账号' });
      }
    }

    const normalizedCurrentDutyUserId =
      currentDutyUserId && normalizedDutyUserIds.includes(String(currentDutyUserId))
        ? String(currentDutyUserId)
        : (normalizedDutyUserIds[0] || null);
    const normalizedRotationStartDate = dutyRotationStartDate
      ? String(dutyRotationStartDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE tenants
       SET dutyUserIds = ?, currentDutyUserId = ?, dutyRotationStartDate = ?, allowAdminAsMediator = ?
       WHERE id = ?`,
      [
        JSON.stringify(normalizedDutyUserIds),
        normalizedCurrentDutyUserId,
        normalizedRotationStartDate,
        allowAdminAsMediator ? 1 : 0,
        tenantId
      ]
    );

    await writeDutyAdjustmentLog({
      tenantId,
      actionType: 'rotation_update',
      originalUserId: previousConfig.currentDutyUserId,
      targetUserId: normalizedCurrentDutyUserId,
      effectiveDate: normalizedRotationStartDate,
      reason: reason ? String(reason) : '更新值班名单或轮值顺序',
      createdBy: req.user?.id || null,
      createdByName: req.user?.name || req.user?.username || null
    });

    const config = await getTenantDutyConfig(tenantId);
    res.json({
      message: '值班调解员配置已更新',
      ...buildDutyResponse(config)
    });
  } catch (error: any) {
    console.error('更新值班调解员配置失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.put('/duty-override', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const {
      tenantId: bodyTenantId,
      overrideUserId = null,
      overrideDate = null,
      reason = null
    } = req.body || {};

    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : String(bodyTenantId || '').trim();

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const previousConfig = await getTenantDutyConfig(tenantId);
    let normalizedOverrideUserId: string | null = overrideUserId ? String(overrideUserId) : null;
    const normalizedOverrideDate = overrideDate ? String(overrideDate).slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (normalizedOverrideUserId) {
      const [rows] = await pool.query(
        `SELECT id
         FROM users
         WHERE id = ?
           AND tenantId = ?
           AND role = 'mediator'
         LIMIT 1`,
        [normalizedOverrideUserId, tenantId]
      );
      if (!(rows as any[])[0]) {
        return res.status(400).json({ message: '临时代理必须是本街道调解员' });
      }
    }

    await pool.query(
      `UPDATE tenants
       SET dutyOverrideUserId = ?, dutyOverrideDate = ?
       WHERE id = ?`,
      [normalizedOverrideUserId, normalizedOverrideUserId ? normalizedOverrideDate : null, tenantId]
    );

    await writeDutyAdjustmentLog({
      tenantId,
      actionType: normalizedOverrideUserId ? 'manual_override' : 'manual_override_clear',
      originalUserId: previousConfig.currentDutyUserId,
      targetUserId: normalizedOverrideUserId,
      effectiveDate: normalizedOverrideUserId ? normalizedOverrideDate : null,
      reason: reason ? String(reason) : (normalizedOverrideUserId ? '设置今日临时代理' : '清除今日临时代理'),
      createdBy: req.user?.id || null,
      createdByName: req.user?.name || req.user?.username || null
    });

    const config = await getTenantDutyConfig(tenantId);
    res.json({
      message: normalizedOverrideUserId ? '今日临时代理已设置' : '今日临时代理已清除',
      ...buildDutyResponse(config)
    });
  } catch (error: any) {
    console.error('更新值班临时代理失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.post('/duty-advance', auth, roleAuth(['superadmin', 'tenant_admin']), async (req, res) => {
  try {
    const { tenantId: bodyTenantId, reason = null } = req.body || {};
    const tenantId = req.user?.role === 'tenant_admin'
      ? (req.user?.tenantId || '')
      : String(bodyTenantId || '').trim();

    if (!tenantId) {
      return res.status(400).json({ message: '缺少街道参数' });
    }

    const config = await getTenantDutyConfig(tenantId);
    if (config.dutyUserIds.length < 2) {
      return res.status(400).json({ message: '至少需要 2 名值班调解员才能顺延到下一位' });
    }

    const currentIndex = Math.max(0, config.dutyUserIds.findIndex((item) => item === config.currentDutyUserId));
    const nextUserId = config.dutyUserIds[(currentIndex + 1) % config.dutyUserIds.length];
    const today = new Date().toISOString().slice(0, 10);

    await pool.query(
      `UPDATE tenants
       SET currentDutyUserId = ?, dutyRotationStartDate = ?, dutyOverrideUserId = NULL, dutyOverrideDate = NULL
       WHERE id = ?`,
      [nextUserId, today, tenantId]
    );

    await writeDutyAdjustmentLog({
      tenantId,
      actionType: 'advance_next',
      originalUserId: config.currentDutyUserId,
      targetUserId: nextUserId,
      effectiveDate: today,
      reason: reason ? String(reason) : '管理员一键顺延到下一位',
      createdBy: req.user?.id || null,
      createdByName: req.user?.name || req.user?.username || null
    });

    const nextConfig = await getTenantDutyConfig(tenantId);
    res.json({
      message: '已顺延到下一位值班调解员',
      ...buildDutyResponse(nextConfig)
    });
  } catch (error: any) {
    console.error('顺延到下一位值班调解员失败:', error);
    res.status(500).json({ message: error?.message || '服务器内部错误' });
  }
});

router.get('/:id', auth, roleAuth(['superadmin']), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         t.*,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id) AS userCount,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id AND u.role IN ('superadmin', 'tenant_admin', 'mediator')) AS staffUserCount,
         (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id AND u.role IN ('personal', 'company')) AS externalUserCount,
         (SELECT COUNT(*) FROM cases c WHERE c.tenantId = t.id) AS caseCount,
         (SELECT COUNT(*) FROM visitor_records vr WHERE vr.tenantId = t.id) AS visitorRecordCount,
         (
           (SELECT COUNT(*) FROM cases c WHERE c.tenantId = t.id) +
           (
             SELECT COUNT(*)
             FROM visitor_records vr
             WHERE vr.tenantId = t.id
               AND NOT EXISTS (
                 SELECT 1
                 FROM cases c2
                 WHERE c2.tenantId = t.id
                   AND (c2.disputeType = '咨询' OR c2.caseNumber LIKE 'CONSULT%')
                   AND c2.caseNumber = vr.registerNumber
               )
           )
         ) AS queryCaseCount,
         (SELECT COUNT(*) FROM feedbacks f WHERE f.tenantId = t.id) AS feedbackCount
       FROM tenants t
       WHERE t.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    const tenant = (rows as any[])[0];
    if (!tenant) {
      return res.status(404).json({ message: '街道不存在' });
    }
    res.json({ tenant });
  } catch (error) {
    console.error('获取街道详情失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

router.post('/', auth, roleAuth(['superadmin']), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      tenantName,
      districtName,
      streetName,
      tenantCode,
      contactName,
      contactPhone,
      status = 'active'
    } = req.body || {};

    if (!String(tenantName || '').trim()) {
      return res.status(400).json({ message: '请输入街道名称' });
    }

    const normalizedTenantName = String(tenantName).trim();
    const normalizedDistrictName = districtName ? String(districtName).trim() : null;
    const normalizedStreetName = streetName ? String(streetName).trim() : null;

    if (!isShanghaiTenant({ tenantName: normalizedTenantName, districtName: normalizedDistrictName })) {
      return res.status(400).json({ message: '当前系统仅保留上海街道，请输入上海街道名称' });
    }

    const [existsRows] = await connection.query(
      'SELECT id FROM tenants WHERE tenantName = ? LIMIT 1',
      [normalizedTenantName]
    );
    if ((existsRows as any[])[0]) {
      return res.status(400).json({ message: '街道名称已存在' });
    }

    const [idRows] = await connection.query('SELECT UUID() AS id');
    const tenantId = (idRows as any[])[0]?.id;

    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO tenants (id, tenantCode, tenantName, districtName, streetName, status, contactName, contactPhone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        tenantCode ? String(tenantCode).trim() : null,
        normalizedTenantName,
        normalizedDistrictName,
        normalizedStreetName,
        status === 'disabled' ? 'disabled' : 'active',
        contactName ? String(contactName).trim() : null,
        contactPhone ? String(contactPhone).trim() : null
      ]
    );

    const adminAccount = await createDefaultTenantAdmin(connection, {
      id: tenantId,
      tenantName: normalizedTenantName,
      tenantCode: tenantCode ? String(tenantCode).trim() : null,
      streetName: normalizedStreetName,
      contactName: contactName ? String(contactName).trim() : null,
      contactPhone: contactPhone ? String(contactPhone).trim() : null
    });

    await connection.commit();
    res.status(201).json({
      message: '街道创建成功，已自动生成默认管理员',
      tenant: { id: tenantId, tenantName: normalizedTenantName },
      adminAccount
    });
  } catch (error) {
    await connection.rollback();
    console.error('创建街道失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  } finally {
    connection.release();
  }
});

router.put('/:id', auth, roleAuth(['superadmin']), async (req, res) => {
  try {
    const {
      tenantName,
      districtName,
      streetName,
      tenantCode,
      contactName,
      contactPhone,
      status
    } = req.body || {};

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ? LIMIT 1', [req.params.id]);
    const current = (rows as any[])[0];
    if (!current) {
      return res.status(404).json({ message: '街道不存在' });
    }

    const nextTenantName = String(tenantName || current.tenantName).trim();
    const nextDistrictName = districtName !== undefined
      ? (districtName ? String(districtName).trim() : null)
      : current.districtName;
    const nextStreetName = streetName !== undefined
      ? (streetName ? String(streetName).trim() : null)
      : current.streetName;

    if (!nextTenantName) {
      return res.status(400).json({ message: '请输入街道名称' });
    }

    if (!isShanghaiTenant({ tenantName: nextTenantName, districtName: nextDistrictName })) {
      return res.status(400).json({ message: '当前系统仅保留上海街道，请输入上海街道名称' });
    }

    const [existsRows] = await pool.query(
      'SELECT id FROM tenants WHERE tenantName = ? AND id <> ? LIMIT 1',
      [nextTenantName, req.params.id]
    );
    if ((existsRows as any[])[0]) {
      return res.status(400).json({ message: '街道名称已存在' });
    }

    await pool.query(
      `UPDATE tenants
       SET tenantCode = ?, tenantName = ?, districtName = ?, streetName = ?, status = ?, contactName = ?, contactPhone = ?
       WHERE id = ?`,
      [
        tenantCode !== undefined ? (tenantCode ? String(tenantCode).trim() : null) : current.tenantCode,
        nextTenantName,
        nextDistrictName,
        nextStreetName,
        status === 'disabled' ? 'disabled' : status === 'active' ? 'active' : current.status,
        contactName !== undefined ? (contactName ? String(contactName).trim() : null) : current.contactName,
        contactPhone !== undefined ? (contactPhone ? String(contactPhone).trim() : null) : current.contactPhone,
        req.params.id
      ]
    );

    if (current.tenantName !== nextTenantName) {
      await pool.query('UPDATE users SET street = ? WHERE tenantId = ?', [nextTenantName, req.params.id]);
    }

    res.json({ message: '街道更新成功' });
  } catch (error) {
    console.error('更新街道失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

router.delete('/:id', auth, roleAuth(['superadmin']), async (req, res) => {
  try {
    const tenantId = req.params.id;
    const [refs] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE tenantId = ?) AS userCount,
         (SELECT COUNT(*) FROM cases WHERE tenantId = ?) AS caseCount,
         (SELECT COUNT(*) FROM visitor_records WHERE tenantId = ?) AS visitorCount,
         (SELECT COUNT(*) FROM feedbacks WHERE tenantId = ?) AS feedbackCount,
         (SELECT COUNT(*) FROM broadcasts WHERE tenantId = ?) AS broadcastCount`,
      [tenantId, tenantId, tenantId, tenantId, tenantId]
    );
    const ref = (refs as any[])[0];
    const totalRefs = Number(ref.userCount || 0) + Number(ref.caseCount || 0) + Number(ref.visitorCount || 0) + Number(ref.feedbackCount || 0) + Number(ref.broadcastCount || 0);
    if (totalRefs > 0) {
      return res.status(400).json({ message: '该街道存在关联数据，不能直接删除' });
    }

    const [result] = await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
    if (!(result as any).affectedRows) {
      return res.status(404).json({ message: '街道不存在' });
    }
    res.json({ message: '街道删除成功' });
  } catch (error) {
    console.error('删除街道失败:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

export default router;
