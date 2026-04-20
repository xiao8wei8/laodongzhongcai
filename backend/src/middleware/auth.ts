import express from 'express';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id: string;
  username: string;
  role: string;
}

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// 认证中间件
export const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as UserPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '无效的认证令牌' });
  }
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
