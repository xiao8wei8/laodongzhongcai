/**
 * @swagger
 * tags:
 *   name: Backup
 *   description: 数据备份相关接口
 */

import express from 'express';
import controller from './controller';
import { auth as authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /backup/export-schema:
 *   get:
 *     summary: 导出表结构
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: 导出成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                   description: 操作是否成功
 *                 message: 
 *                   type: string
 *                   description: 操作消息
 *                 data: 
 *                   type: object
 *                   description: 表结构数据
 *                 exportFile: 
 *                   type: string
 *                   description: 导出文件路径
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/export-schema', authMiddleware, controller.exportSchema);

/**
 * @swagger
 * /backup/sync-schema:
 *   post:
 *     summary: 同步表结构
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - schemaData
 *             properties:
 *               schemaData: 
 *                 type: object
 *                 description: 表结构数据
 *     responses:
 *       200: 
 *         description: 同步成功
 *       400: 
 *         description: 缺少表结构数据
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/sync-schema', authMiddleware, controller.syncSchema);

/**
 * @swagger
 * /backup/backup-database:
 *   post:
 *     summary: 备份数据库
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: 
 *         description: 备份成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                   description: 操作是否成功
 *                 message: 
 *                   type: string
 *                   description: 操作消息
 *                 backupFile: 
 *                   type: string
 *                   description: 备份文件路径
 *                 fileSize: 
 *                   type: string
 *                   description: 文件大小
 *       500: 
 *         description: 服务器内部错误
 */
router.post('/backup-database', authMiddleware, controller.backupDatabase);



/**
 * @swagger
 * /backup/backup-list:
 *   get:
 *     summary: 获取备份列表
 *     tags: [Backup]
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
 *                 message: 
 *                   type: string
 *                   description: 操作消息
 *                 data: 
 *                   type: object
 *                   description: 备份文件列表
 *       500: 
 *         description: 服务器内部错误
 */
router.get('/backup-list', authMiddleware, controller.getBackupList);

export default router;