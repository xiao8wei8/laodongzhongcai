/**
 * @swagger
 * tags:
 *   name: SystemSettings
 *   description: 系统设置相关接口
 */

import express from 'express';
import { getSystemSettings, updateSystemSettings } from './controller';
import { auth, roleAuth } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /system/settings:
 *   get:
 *     summary: 获取系统设置
 *     tags: [SystemSettings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                   description: 操作是否成功
 *                 data: 
 *                   type: object
 *                   description: 系统设置数据
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/', [auth, roleAuth(['admin'])], getSystemSettings);

/**
 * @swagger
 * /system/settings:
 *   put:
 *     summary: 更新系统设置
 *     tags: [SystemSettings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               systemName: 
 *                 type: string
 *                 description: 系统名称
 *               systemIcon: 
 *                 type: string
 *                 description: 系统图标
 *               adminEmail: 
 *                 type: string
 *                 description: 管理员邮箱
 *               notificationSettings: 
 *                 type: object
 *                 description: 通知设置
 *               reminderSettings: 
 *                 type: object
 *                 description: 提醒设置
 *     responses:
 *       200: 
 *         description: 更新成功
 *       401: 
 *         description: 未认证
 *       403: 
 *         description: 权限不足
 *       500: 
 *         description: 服务器内部错误
 */
router.put('/', [auth, roleAuth(['admin'])], updateSystemSettings);

export default router;