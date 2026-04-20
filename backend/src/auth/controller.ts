import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import VisitorRecord from '../models/VisitorRecord';
import { auth } from '../middleware/auth';

// 登录
export const login = async (req: express.Request, res: express.Response) => {
  const { username, password, role } = req.body;
  
  console.log('登录请求:', { username, password, role });
  
  try {
    // 查找用户
    console.log('查找用户:', { username, role });
    const user = await User.findOne({ username, role });
    
    if (!user) {
      console.log('用户不存在:', { username, role });
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('找到用户:', user.username);
    
    // 验证密码
    console.log('验证密码...');
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      console.log('密码错误');
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    console.log('密码验证成功');
    
    // 生成JWT令牌
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 } // 24小时，使用数字格式避免类型错误
    );
    
    // 返回用户信息和令牌
    const userInfo = {
      id: user._id,
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
    const existingUser = await User.findOne({ username });
    
    if (existingUser) {
      return res.status(400).json({ message: '用户名已存在' });
    }
    
    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: '邮箱已被使用' });
      }
    }
    
    // 处理邮箱字段，确保唯一性
    let userEmail = email;
    if (!email || email.trim() === '') {
      // 为没有提供邮箱的用户生成唯一邮箱，避免唯一索引冲突
      userEmail = `${username}_${Date.now()}@example.com`;
    }
    
    // 创建用户数据对象
    const userData = {
      username,
      password,
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
    const user = new User(userData);
    
    await user.save();
    
    res.status(201).json({ message: '注册成功', userId: user._id });
  } catch (error: any) {
    console.error('注册错误:', error);
    
    // 处理Mongoose验证错误
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({ message: errorMessages.join(', ') });
    }
    
    // 处理其他错误
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 获取当前用户信息
export const getMe = [auth, async (req: express.Request, res: express.Response) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json({ userInfo: user });
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
    const query: any = {};
    
    if (role) {
      query.role = role;
    }
    
    if (street) {
      query.street = street;
    }
    
    if (department) {
      query.department = department;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query).select('-password');
    res.json({ users });
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
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 更新用户信息
    user.name = name || user.name;
    user.position = position || user.position;
    user.officePhone = officePhone || user.officePhone;
    user.phone = phone || user.phone;
    user.email = email || user.email;
    user.role = role || user.role;
    user.address = address || user.address;
    user.idCard = idCard || user.idCard;
    user.street = street || user.street;
    user.department = department || user.department;
    
    await user.save();
    
    res.json({ message: '用户更新成功', user: user });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
};

// 删除用户（仅管理员）
export const deleteUser = async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  
  try {
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    await user.deleteOne();
    
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
    const record = await VisitorRecord.findById(decoded.recordId);
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