import pool from '../config/mysql';

export interface DutyAssignee {
  id: string;
  username?: string;
  name: string;
  role: string;
  phone?: string | null;
  officePhone?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  source: 'rotation' | 'manual_override' | 'legacy_on_duty' | 'tenant_admin_fallback';
}

interface TenantDutyConfigRecord {
  id: string;
  tenantName: string;
  dutyUserIds?: string | null;
  currentDutyUserId?: string | null;
  dutyRotationStartDate?: string | null;
  dutyOverrideUserId?: string | null;
  dutyOverrideDate?: string | null;
  allowAdminAsMediator?: number | boolean | null;
}

interface UserCandidate {
  id: string;
  username?: string;
  name: string;
  role: string;
  phone?: string | null;
  officePhone?: string | null;
  tenantId?: string | null;
  tenantName?: string | null;
  isOnDuty?: number | boolean | null;
}

const safeJsonArray = (value?: string[] | string | null): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch (_error) {
    return [];
  }
};

const normalizeDate = (value?: string | null | Date) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return fallback.toISOString().slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDiffDays = (fromDate: string, targetDate: string) => {
  const from = new Date(`${fromDate}T00:00:00`);
  const target = new Date(`${targetDate}T00:00:00`);
  return Math.floor((target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};

const buildDutyRoster = (mediators: UserCandidate[], dutyUserIds: string[]) => {
  const mediatorMap = new Map(mediators.map((item) => [item.id, item]));
  return dutyUserIds
    .map((userId) => mediatorMap.get(userId))
    .filter(Boolean) as UserCandidate[];
};

export const getTenantDutyConfig = async (tenantId: string) => {
  const [tenantRows] = await pool.query(
    `SELECT id, tenantName, dutyUserIds, currentDutyUserId, dutyRotationStartDate, dutyOverrideUserId, dutyOverrideDate, allowAdminAsMediator
     FROM tenants
     WHERE id = ?
     LIMIT 1`,
    [tenantId]
  );
  const tenant = (tenantRows as TenantDutyConfigRecord[])[0];

  if (!tenant) {
    throw new Error('街道不存在');
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.name, u.role, u.phone, u.officePhone, u.tenantId, t.tenantName, u.isOnDuty
     FROM users u
     LEFT JOIN tenants t ON t.id = u.tenantId
     WHERE u.tenantId = ?
       AND u.role IN ('mediator', 'tenant_admin')
     ORDER BY FIELD(u.role, 'mediator', 'tenant_admin'), u.name ASC, u.createdAt ASC`,
    [tenantId]
  );

  const candidates = rows as UserCandidate[];
  const mediators = candidates.filter((item) => item.role === 'mediator');
  const admins = candidates.filter((item) => item.role === 'tenant_admin');

  return {
    tenantId: tenant.id,
    tenantName: tenant.tenantName,
    dutyUserIds: safeJsonArray(tenant.dutyUserIds),
    currentDutyUserId: tenant.currentDutyUserId || null,
    dutyRotationStartDate: tenant.dutyRotationStartDate ? normalizeDate(tenant.dutyRotationStartDate) : null,
    dutyOverrideUserId: tenant.dutyOverrideUserId || null,
    dutyOverrideDate: tenant.dutyOverrideDate ? normalizeDate(tenant.dutyOverrideDate) : null,
    allowAdminAsMediator: Boolean(tenant.allowAdminAsMediator ?? 1),
    mediators,
    admins
  };
};

export const resolveDutyMediatorFromConfig = (
  config: Awaited<ReturnType<typeof getTenantDutyConfig>>,
  targetDateInput?: string
): DutyAssignee | null => {
  const targetDate = normalizeDate(targetDateInput);
  const mediatorMap = new Map(config.mediators.map((item) => [item.id, item]));
  const dutyRoster = buildDutyRoster(config.mediators, config.dutyUserIds);

  if (
    config.dutyOverrideUserId &&
    config.dutyOverrideDate === targetDate &&
    mediatorMap.has(config.dutyOverrideUserId)
  ) {
    const current = mediatorMap.get(config.dutyOverrideUserId)!;
    return {
      ...current,
      source: 'manual_override'
    };
  }

  if (dutyRoster.length > 0) {
    const startDate = config.dutyRotationStartDate || normalizeDate();
    const anchorIndex = Math.max(0, dutyRoster.findIndex((item) => item.id === config.currentDutyUserId));
    const diffDays = Math.max(0, getDiffDays(startDate, targetDate));
    const rosterIndex = (anchorIndex + diffDays) % dutyRoster.length;
    const current = dutyRoster[rosterIndex];
    return {
      ...current,
      source: 'rotation'
    };
  }

  const legacyOnDuty = config.mediators.find((item) => Boolean(item.isOnDuty));
  if (legacyOnDuty) {
    return {
      ...legacyOnDuty,
      source: 'legacy_on_duty'
    };
  }

  if (config.allowAdminAsMediator && config.admins.length > 0) {
    const admin = config.admins[0];
    return {
      ...admin,
      source: 'tenant_admin_fallback'
    };
  }

  return null;
};

export const resolveDutyMediator = async (tenantId: string, targetDateInput?: string): Promise<DutyAssignee | null> => {
  const config = await getTenantDutyConfig(tenantId);
  return resolveDutyMediatorFromConfig(config, targetDateInput);
};

export const buildDutyPreview = (
  config: Awaited<ReturnType<typeof getTenantDutyConfig>>,
  days: number = 7,
  startDateInput?: string
) => {
  const startDate = normalizeDate(startDateInput);
  const previews = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(`${startDate}T00:00:00`);
    date.setDate(date.getDate() + index);
    const normalized = normalizeDate(date);
    const assignee = resolveDutyMediatorFromConfig(config, normalized);
    previews.push({
      date: normalized,
      assignee,
      isToday: normalized === normalizeDate(),
      isOverride: Boolean(config.dutyOverrideUserId && config.dutyOverrideDate === normalized)
    });
  }
  return previews;
};
