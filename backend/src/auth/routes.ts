/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 认证相关接口
 */

import express from 'express';
import { login, register, getMe, refreshToken, getUsers, updateUser, deleteUser, verifyRegisterToken } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 用户登录
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username: 
 *                 type: string
 *                 description: 用户名
 *               password: 
 *                 type: string
 *                 description: 密码
 *               role: 
 *                 type: string
 *                 description: 用户角色
 *                 enum: [admin, mediator, applicant, respondent]
 *     responses:
 *       200: 
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: 
 *                   type: string
 *                   description: JWT令牌
 *                 userInfo: 
 *                   type: object
 *                   properties:
 *                     id: 
 *                       type: string
 *                       description: 用户ID
 *                     username: 
 *                       type: string
 *                       description: 用户名
 *                     name: 
 *                       type: string
 *                       description: 姓名
 *                     role: 
 *                       type: string
 *                       description: 角色
 *       401: 
 *         description: 用户名或密码错误
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: 用户注册
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - name
 *               - role
 *             properties:
 *               username: 
 *                 type: string
 *                 description: 用户名
 *               password: 
 *                 type: string
 *                 description: 密码
 *               name: 
 *                 type: string
 *                 description: 姓名
 *               position: 
 *                 type: string
 *                 description: 职位
 *               officePhone: 
 *                 type: string
 *                 description: 办公电话
 *               phone: 
 *                 type: string
 *                 description: 手机号
 *               email: 
 *                 type: string
 *                 description: 邮箱
 *               role: 
 *                 type: string
 *                 description: 用户角色
 *                 enum: [admin, mediator, applicant, respondent]
 *               address: 
 *                 type: string
 *                 description: 地址
 *               idCard: 
 *                 type: string
 *                 description: 身份证号
 *               identity: 
 *                 type: string
 *                 description: 身份
 *               caseAmount: 
 *                 type: number
 *                 description: 案件金额
 *               street: 
 *                 type: string
 *                 description: 街道
 *               department: 
 *                 type: string
 *                 description: 部门
 *     responses:
 *       201: 
 *         description: 注册成功
 *       400: 
 *         description: 用户名或邮箱已存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: 获取当前用户信息
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       404: 
 *         description: 用户不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/me', getMe);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: 刷新令牌
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: 刷新成功
 *       401: 
 *         description: 未认证
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: 用户登出
 *     tags: [Auth]
 *     responses:
 *       200: 
 *         description: 登出成功
 */
router.post('/logout', (req, res) => {
  // 前端处理登出，清除本地存储的token
  res.json({ success: true, message: '登出成功' });
});

/**
 * @swagger
 * /auth/verify-token:
 *   post:
 *     summary: 验证注册链接token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token: 
 *                 type: string
 *                 description: 注册链接token
 *     responses:
 *       200: 
 *         description: 验证成功
 *       400: 
 *         description: 缺少token参数
 *       401: 
 *         description: 链接已过期或无效
 *       404: 
 *         description: 到访记录不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/verify-token', verifyRegisterToken);

/**
 * @swagger
 * /auth/users:
 *   get:
 *     summary: 获取用户列表（仅管理员）
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: 按角色筛选
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *       - in: query
 *         name: street
 *         schema:
 *           type: string
 *         description: 按街道筛选
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: 按部门筛选
 *     responses:
 *       200: 
 *         description: 获取成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/users', auth, roleAuth(['admin']), getUsers);

/**
 * @swagger
 * /auth/users/{id}:
 *   put:
 *     summary: 更新用户信息（仅管理员）
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: 
 *                 type: string
 *                 description: 姓名
 *               position: 
 *                 type: string
 *                 description: 职位
 *               officePhone: 
 *                 type: string
 *                 description: 办公电话
 *               phone: 
 *                 type: string
 *                 description: 手机号
 *               email: 
 *                 type: string
 *                 description: 邮箱
 *               role: 
 *                 type: string
 *                 description: 用户角色
 *               address: 
 *                 type: string
 *                 description: 地址
 *               idCard: 
 *                 type: string
 *                 description: 身份证号
 *               street: 
 *                 type: string
 *                 description: 街道
 *               department: 
 *                 type: string
 *                 description: 部门
 *     responses:
 *       200: 
 *         description: 更新成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 用户不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/users/:id', auth, roleAuth(['admin']), updateUser);

/**
 * @swagger
 * /auth/users/{id}:
 *   delete:
 *     summary: 删除用户（仅管理员）
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
 *     responses:
 *       200: 
 *         description: 删除成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       404: 
 *         description: 用户不存在
 *       500: 
 *         description: 服务器内部错误
 */
router.delete('/users/:id', auth, roleAuth(['admin']), deleteUser);

export default router;
