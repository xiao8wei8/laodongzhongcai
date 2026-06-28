import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/mysql';

interface UserPayload {
  id: string;
  username: string;
  role: string;
  isSuperAdmin?: boolean;
  tenantId?: string | null;
  tenantName?: string | null;
  districtName?: string | null;
  streetName?: string | null;
  name?: string;
  nickname?: string | null;
  phone?: string;
  email?: string;
}

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const resolveUserFromToken = async (token?: string): Promise<UserPayload | null> => {
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as UserPayload;
  const [rows] = await pool.query(
    `SELECT
       u.id,
       u.username,
       u.role,
       u.name,
       u.nickname,
       u.phone,
       u.email,
       u.isSuperAdmin,
       u.tenantId,
       t.tenantName,
       t.districtName,
       t.streetName
     FROM users u
     LEFT JOIN tenants t ON u.tenantId = t.id
     WHERE u.id = ?
     LIMIT 1`,
    [decoded.id]
  );

  const currentUser = (rows as any[])[0];
  if (!currentUser) return null;

  return {
    id: currentUser.id,
    username: currentUser.username,
    role: currentUser.role,
    name: currentUser.name,
    nickname: currentUser.nickname || null,
    phone: currentUser.phone,
    email: currentUser.email,
    isSuperAdmin: !!currentUser.isSuperAdmin,
    tenantId: currentUser.tenantId || null,
    tenantName: currentUser.tenantName || null,
    districtName: currentUser.districtName || null,
    streetName: currentUser.streetName || null
  };
};

// 认证中间件
export const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key', async (error) => {
    if (error) {
      return res.status(401).json({ message: '无效的认证令牌' });
    }

    try {
      const currentUser = await resolveUserFromToken(token);
      if (!currentUser) {
        return res.status(401).json({ message: '用户不存在或已失效' });
      }

      req.user = currentUser;
      next();
    } catch (dbError) {
      console.error('认证上下文加载失败:', dbError);
      return res.status(500).json({ message: '服务器内部错误' });
    }
  });
};

export const optionalAuth = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();

  try {
    const currentUser = await resolveUserFromToken(token);
    if (currentUser) {
      req.user = currentUser;
    }
  } catch (_error) {
    req.user = undefined;
  }
  next();
};

// 角色权限中间件
export const roleAuth = (roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: '未认证' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }
    
    next();
  };
};

// 超级管理员权限中间件
export const superAdminAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: '未认证' });
  }

  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: '仅超级管理员可访问' });
    }
    next();
  } catch (error) {
    console.error('超级管理员权限校验失败:', error);
    return res.status(500).json({ message: '服务器内部错误' });
  }
};
