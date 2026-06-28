import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pool from '../config/mysql';
import { userRepository, visitorRecordRepository } from '../repositories';
import analyticsEventRepository from '../repositories/analyticsEventRepository';
import { auth } from '../middleware/auth';
import wechatService, { webCodeToUser } from '../services/wechatService';
import smsService from '../services/smsService';
import wechatConfig from '../config/wechat';
import { getRequestIp, writeOperationLog } from '../utils/audit';

// 密码验证辅助函数
const verifyPassword = async (enteredPassword: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(enteredPassword, hashedPassword);
};

const getRequestOrigin = (req?: express.Request) => {
  if (!req) return '';
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host') || '';
  return host ? `${protocol}://${host}` : '';
};

const normalizeAvatarUrl = (avatarUrl?: string | null, req?: express.Request) => {
  const raw = String(avatarUrl || '').trim();
  if (!raw) return '';

  const uploadPathMatch = raw.match(/(\/laodongzhongcai\/uploads\/avatars\/[^?#]+)/);
  const origin = getRequestOrigin(req);

  if (uploadPathMatch && origin) {
    return `${origin}${uploadPathMatch[1]}`;
  }

  if (raw.startsWith('/laodongzhongcai/uploads/avatars/') && origin) {
    return `${origin}${raw}`;
  }

  return raw;
};

const buildUserInfo = (user: any, req?: express.Request) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  nickname: user.nickname || '',
  avatarUrl: normalizeAvatarUrl(user.avatarUrl || '', req),
  position: user.position,
  officePhone: user.officePhone,
  phone: user.phone,
  role: user.role,
  isSuperAdmin: !!user.isSuperAdmin,
  tenantId: user.tenantId || null,
  tenantName: user.tenantName || null,
  districtName: user.districtName || null,
  streetName: user.streetName || null,
  address: user.address,
  idCard: user.idCard,
  street: user.street,
  department: user.department
});

const isSuperAdminRole = (role?: string) => role === 'superadmin';
const isTenantAdminRole = (role?: string) => role === 'tenant_admin';
const isBackofficeRole = (role?: string) => ['superadmin', 'tenant_admin', 'mediator'].includes(role || '');

const getAssignableRoles = (currentUser?: Express.Request['user']) => {
  if (!currentUser) return ['personal', 'company'];
  if (isSuperAdminRole(currentUser.role)) return ['superadmin', 'tenant_admin', 'mediator', 'personal', 'company'];
  if (isTenantAdminRole(currentUser.role)) return ['tenant_admin', 'mediator'];
  return ['personal', 'company'];
};

const canManageTargetUser = (currentUser: Express.Request['user'] | undefined, targetUser: any) => {
  if (!currentUser) return false;
  if (isSuperAdminRole(currentUser.role)) return true;
  if (!isTenantAdminRole(currentUser.role)) return false;
  return !!currentUser.tenantId && currentUser.tenantId === targetUser.tenantId;
};

const getTenantById = async (tenantId?: string | null) => {
  if (!tenantId) return null;
  const [rows] = await pool.query(
    `SELECT id, tenantName, districtName, streetName
     FROM tenants
     WHERE id = ? AND status = 'active'
     LIMIT 1`,
    [tenantId]
  );
  return (rows as any[])[0] || null;
};

const assertSingleTenantAdminLimit = async (tenantId?: string | null, excludeUserId?: string | null) => {
  if (!tenantId) return;
  const params: any[] = [tenantId];
  let sql = `SELECT COUNT(*) AS count FROM users WHERE tenantId = ? AND role = 'tenant_admin'`;
  if (excludeUserId) {
    sql += ' AND id <> ?';
    params.push(excludeUserId);
  }
  const [rows] = await pool.query(sql, params);
  const count = Number((rows as any[])[0]?.count || 0);
  if (count >= 1) {
    throw new Error('当前街道已存在街道管理员，只允许保留 1 个');
  }
};

const avatarDir = path.resolve(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.png';
    cb(null, `avatar_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
  }
});

const avatarUpload = multer({ storage: avatarStorage });

const phoneVerificationStore = new Map<string, {
  userId: string;
  phone: string;
  code: string;
  expireAt: number;
}>();

const generateSmsCode = () => String(Math.floor(100000 + Math.random() * 900000));
const isRealConfigValue = (value?: string) => !!value && !String(value).startsWith('your_');

// 登录
export const login = async (req: express.Request, res: express.Response) => {
  const { username, password, role, tenantId } = req.body;
  
  console.log('登录请求:', { username, password, role });
  
  try {
    const roleFilters = role === 'admin'
      ? ['superadmin', 'tenant_admin']
      : [role];
    const placeholders = roleFilters.map(() => '?').join(', ');
    const [rows] = await pool.query(
      `SELECT u.*, t.tenantName, t.districtName, t.streetName
       FROM users u
       LEFT JOIN tenants t ON u.tenantId = t.id
       WHERE u.username = ? AND u.role IN (${placeholders})`,
      [username, ...roleFilters]
    );
    const users = rows as any[];
    let user = users[0];
    
    if (!user) {
      console.log('用户不存在:', { username, role });
      await analyticsEventRepository.trackEvent('login_failed', {
        event: 'login_failed',
        username,
        role,
        clientType: 'pc_admin',
        ip: getRequestIp(req),
        userAgent: req.headers['user-agent'] || '',
        page: '/login',
        timestamp: Date.now()
      });
      await writeOperationLog({
        req,
        username,
        role,
        module: 'auth',
        action: 'login',
        targetType: 'user',
        targetDisplay: username,
        result: 'failed',
        errorMessage: '用户名不存在'
      });
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('找到用户:', user.username);
    
    // 验证密码
    console.log('验证密码...');
    const isMatch = await verifyPassword(password, user.password);
    
    if (!isMatch) {
      console.log('密码错误');
      await analyticsEventRepository.trackEvent('login_failed', {
        event: 'login_failed',
        username: user.username,
        role: user.role,
        tenantId: user.tenantId || null,
        clientType: 'pc_admin',
        ip: getRequestIp(req),
        userAgent: req.headers['user-agent'] || '',
        page: '/login',
        timestamp: Date.now()
      }, user.id);
      await writeOperationLog({
        req,
        userId: user.id,
        username: user.username,
        role: user.role,
        tenantId: user.tenantId || null,
        module: 'auth',
        action: 'login',
        targetType: 'user',
        targetId: user.id,
        targetDisplay: user.username,
        result: 'failed',
        errorMessage: '密码错误'
      });
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('密码验证成功');

    if (['personal', 'company'].includes(user.role)) {
      if (!tenantId) {
        return res.status(400).json({ message: '登录时请选择所属街道' });
      }
      const tenant = await getTenantById(tenantId);
      if (!tenant) {
        return res.status(400).json({ message: '所选街道不存在或已停用' });
      }
      if (user.tenantId !== tenant.id || user.street !== tenant.tenantName) {
        await pool.query(
          'UPDATE users SET tenantId = ?, street = ? WHERE id = ?',
          [tenant.id, tenant.tenantName, user.id]
        );
        const [updatedRows] = await pool.query(
          `SELECT u.*, t.tenantName, t.districtName, t.streetName
           FROM users u
           LEFT JOIN tenants t ON u.tenantId = t.id
           WHERE u.id = ?
           LIMIT 1`,
          [user.id]
        );
        user = (updatedRows as any[])[0];
      }
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, isSuperAdmin: !!user.isSuperAdmin, tenantId: user.tenantId || null },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 } // 24小时，使用数字格式避免类型错误
    );
    
    // 返回用户信息和令牌
    const userInfo = buildUserInfo(user, req);
    
    console.log('登录成功，返回用户信息和令牌');
    await analyticsEventRepository.trackEvent('login_success', {
      event: 'login_success',
      username: user.username,
      role: user.role,
      tenantId: user.tenantId || null,
      clientType: 'pc_admin',
      ip: getRequestIp(req),
      userAgent: req.headers['user-agent'] || '',
      page: '/login',
      timestamp: Date.now()
    }, user.id);
    await writeOperationLog({
      req,
      userId: user.id,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId || null,
      module: 'auth',
      action: 'login',
      targetType: 'user',
      targetId: user.id,
      targetDisplay: user.username,
      result: 'success',
      detail: '用户登录成功'
    });
    res.json({
      token,
      userInfo
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 注册
export const register = async (req: express.Request, res: express.Response) => {
  const { username, password, name, position, officePhone, phone, role, address, idCard, identity, caseAmount, street, department, tenantId } = req.body;
  
  try {
    if (!['personal', 'company'].includes(role)) {
      return res.status(403).json({ message: '公开注册仅支持个人用户和企业用户' });
    }
    if (!tenantId) {
      return res.status(400).json({ message: '请选择所属街道' });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(400).json({ message: '所选街道不存在或已停用' });
    }

    // 检查用户名是否已存在
    const existingUser = await userRepository.findByUsername(username);
    
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }
    
    const userEmail = `${username}_${Date.now()}@example.com`;
    
    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // 创建用户数据对象
    const userData = {
      username,
      password: hashedPassword,
      name,
      position,
      officePhone,
      phone,
      email: userEmail,
      role,
      address,
      idCard,
      identity,
      caseAmount,
      street: tenant.tenantName,
      department,
      tenantId: tenant.id
    };
    
    // 创建新用户
    const user = await userRepository.create(userData);
    
    res.status(201).json({ message: '注册成功', userId: user.id });
  } catch (error: any) {
    console.error('注册错误:', error);
    
    // 处理其他错误
    res.status(500).json({ message: '服务器内部错误' });
  }
};

export const createManagedUser = async (req: express.Request, res: express.Response) => {
  const { username, password, name, position, officePhone, phone, role, address, idCard, identity, caseAmount, street, department, tenantId } = req.body;

  try {
    const allowedRoles = getAssignableRoles(req.user);
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: '当前账号无权创建该角色' });
    }

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }

    let resolvedTenantId = tenantId || null;
    let resolvedStreet = street || '';
    if (isTenantAdminRole(req.user?.role)) {
      resolvedTenantId = req.user?.tenantId || null;
      resolvedStreet = req.user?.tenantName || street || '';
    }
    const selectedTenant = resolvedTenantId ? await getTenantById(resolvedTenantId) : null;
    if (resolvedTenantId && !selectedTenant) {
      return res.status(400).json({ message: '所选街道不存在或已停用' });
    }
    if (selectedTenant) {
      resolvedStreet = selectedTenant.tenantName;
    }

    if ((role === 'tenant_admin' || role === 'mediator') && !resolvedTenantId) {
      return res.status(400).json({ message: '该角色必须绑定街道租户' });
    }
    if (role === 'tenant_admin') {
      await assertSingleTenantAdminLimit(resolvedTenantId);
    }

    const userEmail = `${username}_${Date.now()}@example.com`;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await userRepository.create({
      username,
      password: hashedPassword,
      name,
      position,
      officePhone,
      phone,
      email: userEmail,
      role,
      address,
      idCard,
      identity,
      caseAmount,
      street: resolvedStreet,
      department,
      tenantId: resolvedTenantId,
      isSuperAdmin: role === 'superadmin'
    } as any);

    res.status(201).json({ message: '用户创建成功', userId: user.id });
  } catch (error) {
    console.error('后台创建用户错误:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    res.status(message.includes('只允许保留 1 个') ? 400 : 500).json({ message });
  }
};

// 获取当前用户信息
export const getMe = [auth, async (req: express.Request, res: express.Response) => {
  try {
    const user = await userRepository.findById(req.user!.id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json({
      userInfo: buildUserInfo({
        ...user,
        tenantId: req.user?.tenantId || (user as any).tenantId || null,
        tenantName: req.user?.tenantName || null,
        districtName: req.user?.districtName || null,
        streetName: req.user?.streetName || null
      }, req)
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 更新当前用户资料
export const updateProfile = [auth, async (req: express.Request, res: express.Response) => {
  try {
    const currentUser = await userRepository.findById(req.user!.id);
    if (!currentUser) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const { name, nickname, avatarUrl, phone, tenantId } = req.body;
    let nextTenantId = (currentUser as any).tenantId || null;
    let nextStreet = currentUser.street || null;
    let nextTenantInfo: any = req.user?.tenantId ? {
      tenantName: req.user?.tenantName || null,
      districtName: req.user?.districtName || null,
      streetName: req.user?.streetName || null
    } : null;

    if (tenantId !== undefined) {
      const tenant = await getTenantById(tenantId);
      if (!tenant) {
        return res.status(400).json({ message: '所选街道不存在或已停用' });
      }
      nextTenantId = tenant.id;
      nextStreet = tenant.tenantName;
      nextTenantInfo = tenant;
    }

    const updatedUser = await userRepository.update(req.user!.id, {
      name: name ?? currentUser.name,
      nickname: nickname ?? (currentUser as any).nickname ?? null,
      avatarUrl: avatarUrl ?? (currentUser as any).avatarUrl ?? null,
      phone: phone ?? currentUser.phone ?? null,
      tenantId: nextTenantId,
      street: nextStreet
    } as any);

    res.json({
      message: '资料更新成功',
      userInfo: buildUserInfo({
        ...updatedUser,
        tenantId: nextTenantId,
        tenantName: nextTenantInfo?.tenantName || null,
        districtName: nextTenantInfo?.districtName || null,
        streetName: nextTenantInfo?.streetName || null
      }, req)
    });
  } catch (error) {
    console.error('更新当前用户资料错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 上传当前用户头像
export const uploadAvatar = [
  auth,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (err) return res.status(400).json({ message: '头像上传失败' });
      next();
    });
  },
  async (req: express.Request, res: express.Response) => {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ message: '缺少头像文件' });
      }

      const avatarUrl = `${getRequestOrigin(req)}/laodongzhongcai/uploads/avatars/${file.filename}`;
      const updatedUser = await userRepository.update(req.user!.id, { avatarUrl } as any);

      res.json({
        message: '头像上传成功',
        avatarUrl: normalizeAvatarUrl(avatarUrl, req),
        userInfo: buildUserInfo(updatedUser, req)
      });
    } catch (error) {
      console.error('上传头像错误:', error);
      res.status(500).json({ message: '服务器内部错误' });
    }
  }
];

// 通过微信授权绑定手机号
export const bindWechatPhone = [auth, async (req: express.Request, res: express.Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: '缺少手机号授权 code' });
  }

  try {
    const phone = await wechatService.getUserPhoneNumber(code);
    const updatedUser = await userRepository.update(req.user!.id, { phone } as any);

    res.json({
      message: '手机号绑定成功',
      phone,
      userInfo: buildUserInfo(updatedUser, req)
    });
  } catch (error: any) {
    console.error('[wechat] 获取手机号失败:', error);
    res.status(400).json({ message: error?.message || '获取手机号失败' });
  }
}];

// 发送短信验证码（用于登录后可选绑定手机号）
export const sendSmsCode = [auth, async (req: express.Request, res: express.Response) => {
  const { phone } = req.body;
  const normalizedPhone = String(phone || '').trim();

  if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
    return res.status(400).json({ message: '请输入正确的手机号' });
  }

  try {
    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser && existingUser.id !== req.user!.id) {
      return res.status(400).json({ message: '该手机号已被其他账号绑定' });
    }

    const code = generateSmsCode();
    phoneVerificationStore.set(`${req.user!.id}:${normalizedPhone}`, {
      userId: req.user!.id,
      phone: normalizedPhone,
      code,
      expireAt: Date.now() + 5 * 60 * 1000
    });

    const isSmsConfigured = (
      isRealConfigValue(process.env.SMS_SDK_APP_ID) &&
      isRealConfigValue(process.env.TENCENT_CLOUD_SECRET_ID || process.env.SMS_SECRET_ID) &&
      isRealConfigValue(process.env.TENCENT_CLOUD_SECRET_KEY || process.env.SMS_SECRET_KEY) &&
      isRealConfigValue(process.env.SMS_TEMPLATE_VERIFICATION || process.env.SMS_TEMPLATE_ID_VERIFICATION)
    );

    if (process.env.NODE_ENV === 'development' || !isSmsConfigured) {
      console.log(`[auth] 开发环境短信验证码 ${normalizedPhone}: ${code}`);
      return res.json({
        success: true,
        message: '验证码已发送',
        debugCode: code,
        simulated: true,
        expireInSeconds: 300
      });
    }

    const success = await smsService.sendVerificationCode(normalizedPhone, code);
    if (!success) {
      phoneVerificationStore.delete(`${req.user!.id}:${normalizedPhone}`);
      return res.status(500).json({ message: '短信发送失败，请稍后再试' });
    }

    res.json({ success: true, message: '验证码已发送', expireInSeconds: 300 });
  } catch (error) {
    console.error('发送短信验证码错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 校验短信验证码并绑定手机号
export const bindPhoneBySms = [auth, async (req: express.Request, res: express.Response) => {
  const { phone, code } = req.body;
  const normalizedPhone = String(phone || '').trim();
  const normalizedCode = String(code || '').trim();

  if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
    return res.status(400).json({ message: '请输入正确的手机号' });
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    return res.status(400).json({ message: '请输入6位验证码' });
  }

  try {
    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser && existingUser.id !== req.user!.id) {
      return res.status(400).json({ message: '该手机号已被其他账号绑定' });
    }

    const verification = phoneVerificationStore.get(`${req.user!.id}:${normalizedPhone}`);
    if (!verification) {
      return res.status(400).json({ message: '请先获取验证码' });
    }

    if (verification.expireAt < Date.now()) {
      phoneVerificationStore.delete(`${req.user!.id}:${normalizedPhone}`);
      return res.status(400).json({ message: '验证码已过期，请重新获取' });
    }

    if (verification.code !== normalizedCode) {
      return res.status(400).json({ message: '验证码错误' });
    }

    phoneVerificationStore.delete(`${req.user!.id}:${normalizedPhone}`);
    const updatedUser = await userRepository.update(req.user!.id, { phone: normalizedPhone } as any);

    res.json({
      success: true,
      message: '手机号绑定成功',
      userInfo: buildUserInfo(updatedUser, req)
    });
  } catch (error) {
    console.error('短信绑定手机号错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 刷新令牌
export const refreshToken = [auth, async (req: express.Request, res: express.Response) => {
  try {
    // 生成新的JWT令牌
    const token = jwt.sign(
      {
        id: req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        isSuperAdmin: !!req.user?.isSuperAdmin,
        tenantId: req.user?.tenantId || null
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 } // 24小时，使用数字格式避免类型错误
    );
    
    res.json({ token });
  } catch (error) {
    console.error('刷新令牌错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 获取用户列表（仅管理员）
export const getUsers = async (req: express.Request, res: express.Response) => {
  try {
    const { role, search, street, department, tenantId } = req.query;
    
    let whereClause = '1=1';
    const params: any[] = [];

    if (isTenantAdminRole(req.user?.role)) {
      whereClause += ' AND tenantId = ?';
      params.push(req.user?.tenantId || '');
    }
    
    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    
    if (street) {
      whereClause += ' AND street = ?';
      params.push(street);
    }
    
    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }
    if (tenantId) {
      whereClause += ' AND tenantId = ?';
      params.push(tenantId);
    }
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR phone LIKE ? OR username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const [rows] = await pool.query(
      `SELECT
         u.id, u.username, u.name, u.position, u.officePhone, u.phone, u.role,
         u.address, u.idCard, u.street, u.department, u.identity, u.caseAmount,
         u.isOnDuty, u.lastOnDutyDate, u.createdAt, u.updatedAt, u.tenantId, u.isSuperAdmin,
         t.tenantName, t.districtName, t.streetName
       FROM users u
       LEFT JOIN tenants t ON u.tenantId = t.id
       WHERE ${whereClause.replace(/\brole\b/g, 'u.role').replace(/\bstreet\b/g, 'u.street').replace(/\bdepartment\b/g, 'u.department').replace(/\bname\b/g, 'u.name').replace(/\bphone\b/g, 'u.phone').replace(/\busername\b/g, 'u.username').replace(/\btenantId\b/g, 'u.tenantId')}`,
      params
    );
    
    res.json({ users: rows });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 更新用户信息（仅管理员）
export const updateUser = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { name, position, officePhone, phone, role, address, idCard, street, department, tenantId } = req.body;
  
  try {
    const user = await userRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (!canManageTargetUser(req.user, user)) {
      return res.status(403).json({ message: '无权操作该用户' });
    }

    if (role) {
      const allowedRoles = getAssignableRoles(req.user);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ message: '当前账号无权设置该角色' });
      }
    }

    const resolvedTenantId = isTenantAdminRole(req.user?.role)
      ? (req.user?.tenantId || null)
      : (tenantId !== undefined ? tenantId : (user as any).tenantId || null);
    const resolvedStreet = isTenantAdminRole(req.user?.role)
      ? (req.user?.tenantName || street || user.street)
      : (street || user.street);
    if ((role || user.role) === 'tenant_admin') {
      await assertSingleTenantAdminLimit(resolvedTenantId, id);
    }
    
    // 更新用户信息
    const updatedUser = await userRepository.update(id, {
      name: name || user.name,
      position: position || user.position,
      officePhone: officePhone || user.officePhone,
      phone: phone || user.phone,
      role: role || user.role,
      address: address || user.address,
      idCard: idCard || user.idCard,
      street: resolvedStreet,
      department: department || user.department,
      tenantId: resolvedTenantId,
      isSuperAdmin: (role || user.role) === 'superadmin'
    });
    
    res.json({ message: '用户更新成功', user: updatedUser });
  } catch (error) {
    console.error('更新用户错误:', error);
    const message = error instanceof Error ? error.message : '服务器内部错误';
    res.status(message.includes('只允许保留 1 个') ? 400 : 500).json({ message });
  }
};

// 删除用户（仅管理员）
export const deleteUser = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  
  try {
    const user = await userRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (!canManageTargetUser(req.user, user)) {
      return res.status(403).json({ message: '无权删除该用户' });
    }
    if ((user as any).role === 'superadmin' && !isSuperAdminRole(req.user?.role)) {
      return res.status(403).json({ message: '无权删除超级管理员' });
    }
    
    await userRepository.delete(id);
    
    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 验证注册链接token
export const verifyRegisterToken = async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: '缺少token参数' });
    }
    
    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as any;
    
    // 查找到访记录
    const record = await visitorRecordRepository.findById(decoded.recordId);
    if (!record) {
      return res.status(404).json({ message: '到访记录不存在' });
    }
    
    // 返回记录信息
    res.json({
      success: true,
      visitor: {
        visitorName: record.visitorName,
        phone: record.phone,
        disputeType: record.disputeType,
        reason: record.reason
      }
    });
  } catch (error: any) {
    console.error('验证token错误:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '链接已过期' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '链接无效' });
    }

    res.status(500).json({ message: '服务器内部错误' });
  }
};

// ============================================================
// 【小程序端】微信快捷登录
// 流程：wx.login() → code → 调用 jscode2session → openid → 登录/注册
// ============================================================
export const wechatLogin = async (req: express.Request, res: express.Response) => {
  const { code, tenantId } = req.body;

  if (!code) {
    return res.status(400).json({ message: '缺少微信登录 code' });
  }
  if (!tenantId) {
    return res.status(400).json({ message: '登录时请选择所属街道' });
  }

  try {
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(400).json({ message: '所选街道不存在或已停用' });
    }

    // 1) 调用微信官方接口：code → openid
    //    这里要求真实登录：code 必须成功换取 openid，不再默认降级为 mock 用户。
    let openid: string;
    try {
      const session = await wechatService.jscode2session(code);
      openid = session.openid;
    } catch (e: any) {
      console.error('[wechat] jscode2session 失败:', e?.message);
      return res.status(401).json({
        message: '微信登录失败，请确认小程序 AppID/AppSecret 配置一致，并重新获取登录态'
      });
    }

    // 2) 以 openid / 用户名查找现有用户
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE wechat_mp_openid = ? OR username = ? LIMIT 1',
      [openid, openid]
    );
    let user = (rows as any[])[0];

    // 3) 用户不存在时，自动创建一个新的个人用户
    if (!user) {
      const newUserId = uuidv4();
      const hashedPassword = await bcrypt.hash(uuidv4(), 10);
      const defaultRole = 'personal';

      await pool.query(
        'INSERT INTO users (id, username, name, password, role, phone, email, wechat_mp_openid, address, idCard, street, tenantId, department, identity, position, officePhone, caseAmount, isOnDuty, lastOnDutyDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newUserId, openid, '微信用户', hashedPassword, defaultRole,
          '', '', openid, null, null, tenant.tenantName, tenant.id, null, null, null, null, 0, 0, null, new Date(), new Date()
        ]
      );

      const [newRows] = await pool.query(
        `SELECT u.*, t.tenantName, t.districtName, t.streetName
         FROM users u
         LEFT JOIN tenants t ON u.tenantId = t.id
         WHERE u.id = ?`,
        [newUserId]
      );
      user = (newRows as any[])[0];
    } else {
      // 已有用户：补录 openid / 手机号
      const updates: string[] = [];
      const params: any[] = [];

      if (!user.wechat_mp_openid) {
        updates.push('wechat_mp_openid = ?');
        params.push(openid);
      }
      if (user.tenantId !== tenant.id) {
        updates.push('tenantId = ?');
        params.push(tenant.id);
      }
      if (user.street !== tenant.tenantName) {
        updates.push('street = ?');
        params.push(tenant.tenantName);
      }

      if (updates.length > 0) {
        params.push(user.id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        const [updatedRows] = await pool.query(
          `SELECT u.*, t.tenantName, t.districtName, t.streetName
           FROM users u
           LEFT JOIN tenants t ON u.tenantId = t.id
           WHERE u.id = ?`,
          [user.id]
        );
        user = (updatedRows as any[])[0];
      }
    }

    if (!user) {
      return res.status(500).json({ message: '用户创建或查询失败' });
    }

    // 4) 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, isSuperAdmin: !!user.isSuperAdmin, name: user.name, phone: user.phone, tenantId: user.tenantId || null },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 }
    );

    res.json({
      token,
      userInfo: {
        ...buildUserInfo({
          ...user,
          name: user.name || '微信用户'
        }, req)
      },
      message: '微信登录成功',
    });
  } catch (error) {
    console.error('[wechat] 小程序登录错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// ============================================================
// 【PC 管理端】获取微信扫码登录 URL
// 前端调用后拿到一个 URL，用 <iframe> 或跳转显示二维码
// ============================================================
export const getWechatWebLoginUrl = async (_req: express.Request, res: express.Response) => {
  try {
    const state = uuidv4(); // 防 CSRF
    const url = wechatService.generateWebLoginUrl(state);
    res.json({ url, state });
  } catch (e: any) {
    res.status(500).json({ message: e?.message || '生成扫码 URL 失败' });
  }
};

// ============================================================
// 【PC 管理端】微信扫码回调 → 用 code 换取 openid → 登录/注册
// 文档：https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login_Authorization_Detail.html
// 流程：用户扫码 → 微信 302 到 redirectUri?code=xxx&state=xxx → 本接口
//        → 用 code 换取 openid → 查/建用户 → 返回 HTML 页面，通过 window.opener 通知父页面 token
// ============================================================
export const wechatWebCallback = async (req: express.Request, res: express.Response) => {
  const { code, state } = req.query;
  try {
    if (!code) {
      return res.send(htmlResultPage(false, '缺少 code 参数'));
    }

    // 1) 用 code 换取 openid / 用户信息
    let wxUser: { openid: string; unionid?: string; nickname?: string; avatar?: string };
    try {
      wxUser = await webCodeToUser(String(code));
    } catch (e: any) {
      // 未配置凭证 / 网络失败时的降级模式（不推荐用于生产）
      console.warn('[wechat] web 扫码登录 code 交换失败，降级:', e?.message);
      wxUser = { openid: `wx_web_${code}` };
    }

    // 2) 根据 openid 查用户（默认登录为 mediator 角色，调解员）
    //    注意：调解员/管理员 应由平台管理员在后台先绑定 openid
    let [rows] = await pool.query(
      'SELECT * FROM users WHERE wechat_web_openid = ? OR username = ?',
      [wxUser.openid, wxUser.openid]
    );
    let user = (rows as any[])[0];

    // 3) 未注册过的扫码用户：自动创建为 personal，等待管理员提升为 mediator/admin
    if (!user) {
      const newUserId = uuidv4();
      const hashedPassword = await bcrypt.hash(uuidv4(), 10);
      await pool.query(
        'INSERT INTO users (id, username, name, password, role, phone, email, wechat_web_openid, address, idCard, street, department, identity, position, officePhone, caseAmount, isOnDuty, lastOnDutyDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newUserId, wxUser.openid, wxUser.nickname || '微信用户',
          hashedPassword, 'personal', '', '', wxUser.openid, '', '', '', '',
          '', '', 0, 0, null, new Date(), new Date()
        ]
      );
      const [newRows] = await pool.query('SELECT * FROM users WHERE id = ?', [newUserId]);
      user = (newRows as any[])[0];
    } else if (!user.wechat_web_openid) {
      await pool.query('UPDATE users SET wechat_web_openid = ?, name = ? WHERE id = ?', [
        wxUser.openid, wxUser.nickname || user.name, user.id
      ]);
    }

    if (!user) {
      return res.send(htmlResultPage(false, '用户查询失败'));
    }

    // 4) 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, isSuperAdmin: !!user.isSuperAdmin, name: user.name, phone: user.phone },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 }
    );

    // 5) 返回 HTML：调用父页面 window.opener 的 onWechatLogin(token, role)
    res.send(htmlResultPage(true, '登录成功', token, user.role));
  } catch (error) {
    console.error('[wechat] PC 扫码登录回调错误:', error);
    res.send(htmlResultPage(false, '服务器内部错误'));
  }
};

/** 返回给微信扫码浏览器的简易 HTML 页面 */
function htmlResultPage(success: boolean, message: string, token?: string, role?: string): string {
  const tokenAttr = token ? `data-token="${token}"` : '';
  const roleAttr = role ? `data-role="${role}"` : '';
  const statusText = success ? '登录成功' : message;
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"/><title>微信登录 - 劳动仲裁调解系统</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f7fa}
.card{background:#fff;padding:30px 40px;border-radius:12px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.green{color:#52c41a}.red{color:#ff4d4f}</style>
</head>
<body>
<div class="card" id="loginCard" data-success="${success}" ${tokenAttr} ${roleAttr}>
  <h2 class="${success ? 'green' : 'red'}">${statusText}</h2>
  <p>${success ? '正在跳转，请稍候...' : '请关闭页面，重新扫码'}</p>
</div>
<script>
  // 通知父窗口（扫码弹窗）或 opener
  const card = document.getElementById('loginCard');
  const t = card.getAttribute('data-token');
  const r = card.getAttribute('data-role');
  try {
    if (window.opener && window.opener.onWechatLogin) {
      window.opener.onWechatLogin(t, r);
      setTimeout(() => { try { window.close(); } catch (e) {} }, 500);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'wechatLoginSuccess', token: t, role: r }, '*');
    } else {
      // 如果直接在浏览器打开，把 token 存到 localStorage 并跳转到管理后台首页
      if (t) { localStorage.setItem('wechat_token', t); localStorage.setItem('wechat_role', r || ''); }
      setTimeout(() => { window.location.href = '/laodongzhongcai/admin'; }, 800);
    }
  } catch (e) {
    if (t) { localStorage.setItem('wechat_token', t); localStorage.setItem('wechat_role', r || ''); }
    setTimeout(() => { window.location.href = '/laodongzhongcai/admin'; }, 800);
  }
</script>
</body>
</html>`;
}

// ============================================================
// 【PC 管理端】轮询 token（当用户在另一个浏览器完成扫码，当前页面通过 state 拉取 token）
// 简易实现：把 token 放在内存 map 里，前端轮询。
// 说明：更严谨的做法可以用 Redis/DB 存储 state→token 的映射并设置过期时间。
// ============================================================
const pendingTokens = new Map<string, { token: string; role: string; createdAt: number }>();

export const pollWechatWebToken = async (req: express.Request, res: express.Response) => {
  const { state } = req.query;
  if (!state) {
    return res.status(400).json({ ready: false, message: '缺少 state' });
  }
  const entry = pendingTokens.get(String(state));
  if (entry) {
    pendingTokens.delete(String(state));
    return res.json({ ready: true, token: entry.token, role: entry.role });
  }
  res.json({ ready: false });
};
