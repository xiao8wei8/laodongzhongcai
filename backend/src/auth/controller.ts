import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../config/mysql';
import { userRepository, visitorRecordRepository } from '../repositories';
import { auth } from '../middleware/auth';

// 密码验证辅助函数
const verifyPassword = async (enteredPassword: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(enteredPassword, hashedPassword);
};

// 登录
export const login = async (req: express.Request, res: express.Response) => {
  const { username, password, role } = req.body;
  
  console.log('登录请求:', { username, password, role });
  
  try {
    // 查找用户 - 使用自定义查询
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND role = ?',
      [username, role]
    );
    const users = rows as any[];
    const user = users[0];
    
    if (!user) {
      console.log('用户不存在:', { username, role });
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('找到用户:', user.username);
    
    // 验证密码
    console.log('验证密码...');
    const isMatch = await verifyPassword(password, user.password);
    
    if (!isMatch) {
      console.log('密码错误');
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('密码验证成功');
    
    // 生成JWT令牌
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 } // 24小时，使用数字格式避免类型错误
    );
    
    // 返回用户信息和令牌
    const userInfo = {
      id: user.id,
      username: user.username,
      name: user.name,
      position: user.position,
      officePhone: user.officePhone,
      phone: user.phone,
      email: user.email,
      role: user.role,
      address: user.address,
      idCard: user.idCard,
      street: user.street,
      department: user.department
    };
    
    console.log('登录成功，返回用户信息和令牌');
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
  const { username, password, name, position, officePhone, phone, email, role, address, idCard, identity, caseAmount, street, department } = req.body;
  
  try {
    // 检查用户名是否已存在
    const existingUser = await userRepository.findByUsername(username);
    
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }
    
    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const [emailRows] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      if ((emailRows as any[]).length > 0) {
        return res.status(400).json({ message: '邮箱已被使用' });
      }
    }
    
    // 处理邮箱字段，确保唯一性
    let userEmail = email;
    if (!email || email.trim() === '') {
      // 为没有提供邮箱的用户生成唯一邮箱，避免唯一索引冲突
      userEmail = `${username}_${Date.now()}@example.com`;
    }
    
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
      street,
      department
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

// 获取当前用户信息
export const getMe = [auth, async (req: express.Request, res: express.Response) => {
  try {
    const user = await userRepository.findById(req.user!.id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 移除密码字段
    const { password, ...userInfo } = user;
    
    res.json({ userInfo });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
}];

// 刷新令牌
export const refreshToken = [auth, async (req: express.Request, res: express.Response) => {
  try {
    // 生成新的JWT令牌
    const token = jwt.sign(
      { id: req.user?.id, username: req.user?.username, role: req.user?.role },
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
    const { role, search, street, department } = req.query;
    
    let whereClause = '1=1';
    const params: any[] = [];
    
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
    
    if (search) {
      whereClause += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR username LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const [rows] = await pool.query(
      `SELECT id, username, name, position, officePhone, phone, email, role, address, idCard, street, department, identity, caseAmount, isOnDuty, lastOnDutyDate, createdAt, updatedAt FROM users WHERE ${whereClause}`,
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
  const { name, position, officePhone, phone, email, role, address, idCard, street, department } = req.body;
  
  try {
    const user = await userRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 更新用户信息
    const updatedUser = await userRepository.update(id, {
      name: name || user.name,
      position: position || user.position,
      officePhone: officePhone || user.officePhone,
      phone: phone || user.phone,
      email: email || user.email,
      role: role || user.role,
      address: address || user.address,
      idCard: idCard || user.idCard,
      street: street || user.street,
      department: department || user.department
    });
    
    res.json({ message: '用户更新成功', user: updatedUser });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
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