import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/mysql';
import { userRepository, visitorRecordRepository } from '../repositories';
import { auth } from '../middleware/auth';
import wechatService, { webCodeToUser } from '../services/wechatService';
import wechatConfig from '../config/wechat';

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

// ============================================================
// 【小程序端】微信快捷登录
// 流程：wx.login() → code → 调用 jscode2session → openid → 登录/注册
// ============================================================
export const wechatLogin = async (req: express.Request, res: express.Response) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ message: '缺少微信登录 code' });
  }

  try {
    // 1) 调用微信官方接口：code → openid
    //    若未配置凭证，使用"简化模式"（测试/演示环境可用），方便本地联调
    let openid: string;
    try {
      const session = await wechatService.jscode2session(code);
      openid = session.openid;
    } catch (e: any) {
      // 未配置 / 网络不通时，降级为简化模式（把 code 当作 openid）
      console.warn('[wechat] jscode2session 失败，降级为简化模式:', e?.message);
      openid = `wx_${code}`;
    }

    // 2) 以 openid 查找现有用户
    let [rows] = await pool.query(
      'SELECT * FROM users WHERE wechat_mp_openid = ? OR username = ?',
      [openid, openid]
    );
    let user = (rows as any[])[0];

    // 3) 用户不存在时，自动创建一个新的个人用户
    if (!user) {
      const newUserId = uuidv4();
      const hashedPassword = await bcrypt.hash(uuidv4(), 10);
      const defaultRole = 'personal';

      await pool.query(
        'INSERT INTO users (id, username, name, password, role, phone, email, wechat_mp_openid, address, idCard, street, department, identity, position, officePhone, caseAmount, isOnDuty, lastOnDutyDate, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newUserId, openid, '微信用户', hashedPassword, defaultRole,
          '', '', openid, '', '', '', '', '', '', 0, 0, null, new Date(), new Date()
        ]
      );

      const [newRows] = await pool.query('SELECT * FROM users WHERE id = ?', [newUserId]);
      user = (newRows as any[])[0];
    } else if (!user.wechat_mp_openid) {
      // 已有用户但尚未绑定小程序 openid → 补录
      await pool.query('UPDATE users SET wechat_mp_openid = ? WHERE id = ?', [openid, user.id]);
    }

    if (!user) {
      return res.status(500).json({ message: '用户创建或查询失败' });
    }

    // 4) 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, phone: user.phone, email: user.email },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: 86400 }
    );

    res.json({
      token,
      userInfo: {
        id: user.id, username: user.username, name: user.name || '微信用户',
        role: user.role, phone: user.phone, email: user.email,
        position: user.position, address: user.address, idCard: user.idCard,
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
      { id: user.id, username: user.username, role: user.role, name: user.name, phone: user.phone, email: user.email },
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