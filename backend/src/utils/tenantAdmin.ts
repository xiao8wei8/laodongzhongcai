import bcrypt from 'bcryptjs';

export const DEFAULT_TENANT_ADMIN_PASSWORD = '123456';

export const SHANGHAI_DISTRICTS = [
  '黄浦区',
  '徐汇区',
  '长宁区',
  '静安区',
  '普陀区',
  '虹口区',
  '杨浦区',
  '浦东新区',
  '闵行区',
  '宝山区',
  '嘉定区',
  '金山区',
  '松江区',
  '青浦区',
  '奉贤区',
  '崇明区'
];

const shanghaiDistrictSet = new Set(SHANGHAI_DISTRICTS);
const LEGACY_DEFAULT_ADMIN_REGEX = /^(admin\d+|admin_[\u4e00-\u9fa5A-Za-z0-9]+(?:_\d+)?|adminstreet\d*)$/;

export const isShanghaiTenant = (tenant: { tenantName?: string | null; districtName?: string | null } | string) => {
  const tenantName = typeof tenant === 'string' ? tenant : String(tenant.tenantName || '').trim();
  const districtName = typeof tenant === 'string' ? '' : String(tenant.districtName || '').trim();
  if (districtName && shanghaiDistrictSet.has(districtName)) return true;
  return SHANGHAI_DISTRICTS.some((district) => tenantName.startsWith(district));
};

const getShanghaiDistrictRank = (tenant: { tenantName?: string | null; districtName?: string | null }) => {
  const districtName = String(tenant.districtName || '').trim();
  if (districtName) {
    const index = SHANGHAI_DISTRICTS.indexOf(districtName);
    if (index >= 0) return index;
  }

  const tenantName = String(tenant.tenantName || '').trim();
  const matchedIndex = SHANGHAI_DISTRICTS.findIndex((district) => tenantName.startsWith(district));
  return matchedIndex >= 0 ? matchedIndex : Number.MAX_SAFE_INTEGER;
};

export const sortTenantsWithShanghaiPriority = <T extends { tenantName?: string | null; districtName?: string | null }>(tenants: T[]) => {
  return [...tenants].sort((a, b) => {
    const aIsShanghai = isShanghaiTenant(a);
    const bIsShanghai = isShanghaiTenant(b);
    if (aIsShanghai !== bIsShanghai) {
      return aIsShanghai ? -1 : 1;
    }

    if (aIsShanghai && bIsShanghai) {
      const rankDiff = getShanghaiDistrictRank(a) - getShanghaiDistrictRank(b);
      if (rankDiff !== 0) return rankDiff;
    }

    return String(a.tenantName || '').localeCompare(String(b.tenantName || ''), 'zh-Hans-CN');
  });
};

const deriveTenantShortName = (tenant: {
  tenantName: string;
  streetName?: string | null;
  tenantCode?: string | null;
}) => {
  const streetName = String(tenant.streetName || '').trim();
  const tenantName = String(tenant.tenantName || tenant.tenantCode || '').trim();
  const raw = streetName || tenantName;
  const normalizedSource = streetName
    ? raw.replace(/^(浦东新区|.+?区)/, '')
    : raw;
  const withoutSuffix = normalizedSource.replace(/(街道|镇|乡|地区|办事处)$/g, '');
  const normalized = (withoutSuffix || normalizedSource).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '');
  return normalized.slice(0, 12) || 'street';
};

export const buildTenantAdminUsernameSeed = (tenant: {
  tenantName: string;
  streetName?: string | null;
  tenantCode?: string | null;
}) => {
  return `admin${deriveTenantShortName(tenant)}`;
};

export const ensureUniqueTenantAdminUsername = async (
  connection: any,
  seed: string,
  excludeUserId?: string | null
) => {
  let username = seed;
  let suffix = 1;

  while (true) {
    const params: any[] = [username];
    let sql = 'SELECT id FROM users WHERE username = ?';
    if (excludeUserId) {
      sql += ' AND id <> ?';
      params.push(excludeUserId);
    }
    sql += ' LIMIT 1';

    const [rows] = await connection.query(sql, params);
    if (!(rows as any[])[0]) {
      return username;
    }

    username = `${seed}${suffix}`;
    suffix += 1;
  }
};

export const createDefaultTenantAdmin = async (
  connection: any,
  tenant: {
    id: string;
    tenantName: string;
    tenantCode?: string | null;
    streetName?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  }
) => {
  const usernameSeed = buildTenantAdminUsernameSeed(tenant);
  const username = await ensureUniqueTenantAdminUsername(connection, usernameSeed);
  const hashedPassword = await bcrypt.hash(DEFAULT_TENANT_ADMIN_PASSWORD, 10);
  const adminName = String(tenant.contactName || '').trim() || `${tenant.tenantName}管理员`;

  await connection.query(
    `INSERT INTO users (id, username, password, name, role, isSuperAdmin, street, tenantId, position, phone, email, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, 'tenant_admin', 0, ?, ?, '街道管理员', ?, ?, NOW(), NOW())`,
    [
      username,
      hashedPassword,
      adminName,
      tenant.tenantName,
      tenant.id,
      tenant.contactPhone ? String(tenant.contactPhone).trim() : null,
      `${username}@example.com`
    ]
  );

  return {
    username,
    password: DEFAULT_TENANT_ADMIN_PASSWORD,
    name: adminName
  };
};

export const ensureTenantDefaultAdmin = async (
  connection: any,
  tenant: {
    id: string;
    tenantName: string;
    tenantCode?: string | null;
    streetName?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  }
) => {
  const [rows] = await connection.query(
    `SELECT id, username, name
     FROM users
     WHERE tenantId = ? AND role = 'tenant_admin'
     ORDER BY createdAt ASC, username ASC`,
    [tenant.id]
  );
  const admins = rows as any[];
  const usernameSeed = buildTenantAdminUsernameSeed(tenant);

  if (admins.some((item) => item.username === usernameSeed || item.username.startsWith(`${usernameSeed}`))) {
    return null;
  }

  const legacyAdmin = admins.find((item) => LEGACY_DEFAULT_ADMIN_REGEX.test(String(item.username || '')));
  if (legacyAdmin) {
    const username = await ensureUniqueTenantAdminUsername(connection, usernameSeed, legacyAdmin.id);
    const hashedPassword = await bcrypt.hash(DEFAULT_TENANT_ADMIN_PASSWORD, 10);
    const adminName = String(legacyAdmin.name || '').trim() || `${tenant.tenantName}管理员`;

    await connection.query(
      `UPDATE users
       SET username = ?, password = ?, name = ?, role = 'tenant_admin', isSuperAdmin = 0,
           street = ?, tenantId = ?, position = COALESCE(NULLIF(position, ''), '街道管理员'),
           email = CASE WHEN email IS NULL OR email = '' OR email LIKE '%@example.com' THEN ? ELSE email END
       WHERE id = ?`,
      [username, hashedPassword, adminName, tenant.tenantName, tenant.id, `${username}@example.com`, legacyAdmin.id]
    );

    return {
      username,
      password: DEFAULT_TENANT_ADMIN_PASSWORD,
      name: adminName
    };
  }

  if (admins.length > 0) {
    return null;
  }

  return createDefaultTenantAdmin(connection, tenant);
};

export const ensureTenantDefaultAdmins = async (connection: any) => {
  const [rows] = await connection.query(
    `SELECT id, tenantName, tenantCode, streetName, contactName, contactPhone
     FROM tenants
     WHERE status = 'active'
     ORDER BY createdAt ASC, tenantName ASC`
  );

  for (const tenant of rows as any[]) {
    await ensureTenantDefaultAdmin(connection, tenant);
  }
};
